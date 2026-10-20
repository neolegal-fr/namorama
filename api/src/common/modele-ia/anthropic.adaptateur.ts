import Anthropic from '@anthropic-ai/sdk';
import type { ModelUsageService, OperationModele } from '../model-usage/model-usage.service';
import { Adaptateur, Demande, ModelesParRole, Raisonnement, Reponse, ReponseWeb } from './modele-ia.types';

/**
 * Majoration du budget de sortie. Le tokeniseur Claude ne compte pas comme
 * celui d'OpenAI, et la réflexion, quand elle a lieu, se prend sur
 * `max_tokens`. À recalibrer sur la comparaison des deux fournisseurs : un
 * budget trop juste tronque le JSON, et un JSON tronqué ne rend rien.
 */
export const MAJORATION_SORTIE = 1.3;

/** Recherches web par repérage du marché : ~3 suffisent, au-delà on paie des tokens de pages. */
export const RECHERCHES_WEB_MAX = 5;

type Parametres = Pick<Anthropic.MessageCreateParamsNonStreaming, 'thinking' | 'output_config'>;

/**
 * Traduit le raisonnement selon ce que le modèle accepte : tous ne savent pas
 * se passer de réflexion, et une valeur refusée rend un 400, pas un appel
 * moins cher. Le raisonnement est facturé en sortie : `none` doit coûter le
 * moins possible là où le modèle le permet.
 */
export function parametresDeRaisonnement(modele: string, r: Raisonnement): Parametres {
  if (r === 'low') return { thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
  if (modele.startsWith('claude-haiku-5-5')) return { thinking: { type: 'disabled' } };
  // `disabled` rend un 400 sur Sonnet 5.5 ; `between_tools` n'accepte aucun autre champ.
  if (modele.startsWith('claude-sonnet-5-5')) return { thinking: { type: 'between_tools' } as any };
  // Opus 5.5 ne désactive pas sa réflexion ; à défaut, la borner.
  return { output_config: { effort: 'low' } };
}

/** L'outil de recherche à filtrage dynamique n'existe que sur Sonnet et Opus récents. */
export function outilRechercheWeb(modele: string): Anthropic.ToolUnion {
  const dynamique = /^claude-(opus-(5|4-[678])|sonnet-(5|4-6))/.test(modele);
  return dynamique
    ? { type: 'web_search_20260209', name: 'web_search', max_uses: RECHERCHES_WEB_MAX }
    : { type: 'web_search_20250305', name: 'web_search', max_uses: RECHERCHES_WEB_MAX };
}

const texteDe = (message: Anthropic.Message): string =>
  message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

const recherchesDe = (message: Anthropic.Message): number =>
  Number((message.usage as any)?.server_tool_use?.web_search_requests ?? 0) || 0;

export class AnthropicAdaptateur implements Adaptateur {
  readonly fournisseur = 'anthropic' as const;

  constructor(
    private readonly client: Pick<Anthropic, 'messages'>,
    readonly modeles: ModelesParRole,
    private readonly usage?: ModelUsageService,
  ) {}

  static depuisCle(apiKey: string, modeles: ModelesParRole, usage?: ModelUsageService): AnthropicAdaptateur {
    return new AnthropicAdaptateur(new Anthropic({ apiKey }), modeles, usage);
  }

  private mesurer<T>(operation: OperationModele, appel: Promise<T>, items = 1): Promise<T> {
    return this.usage ? this.usage.mesurer(operation, appel, items) : appel;
  }

  private reponse(message: Anthropic.Message, modele: string): Reponse {
    const tronque = message.stop_reason === 'max_tokens';
    const refuse = message.stop_reason === 'refusal';
    return {
      texte: tronque || refuse ? '' : texteDe(message),
      tronque,
      refuse,
      fournisseur: this.fournisseur,
      modele: message.model ?? modele,
    };
  }

  async completer(operation: OperationModele, d: Demande): Promise<Reponse> {
    const modele = this.modeles[d.role];
    const { thinking, output_config } = parametresDeRaisonnement(modele, d.raisonnement);
    const format = d.format.type === 'json' ? { type: 'json_schema' as const, schema: d.format.schema } : undefined;
    const config = output_config || format ? { ...output_config, ...(format ? { format } : {}) } : undefined;

    const message = await this.mesurer(operation, this.client.messages.create({
      model: modele,
      max_tokens: Math.ceil(d.maxSortie * MAJORATION_SORTIE),
      ...(d.systeme !== undefined ? { system: d.systeme } : {}),
      messages: [{ role: 'user', content: d.message }],
      ...(thinking ? { thinking } : {}),
      ...(config ? { output_config: config } : {}),
    }), d.items);
    return this.reponse(message, modele);
  }

  /**
   * Repérage du marché. Une erreur de l'outil ne lève pas : elle arrive dans
   * un bloc de résultat, et ne compte pas comme recherche faite. Une boucle
   * serveur interrompue (`pause_turn`) se relance une fois, en renvoyant la
   * réponse partielle telle quelle ; au-delà, l'appelant passe à son repli.
   */
  async chercherSurLeWeb(operation: OperationModele, d: Omit<Demande, 'format'>): Promise<ReponseWeb> {
    const modele = this.modeles[d.role];
    const params = {
      model: modele,
      max_tokens: Math.ceil(d.maxSortie * MAJORATION_SORTIE),
      ...(d.systeme !== undefined ? { system: d.systeme } : {}),
      tools: [outilRechercheWeb(modele)],
      ...parametresDeRaisonnement(modele, d.raisonnement),
    };
    const messages: Anthropic.MessageParam[] = [{ role: 'user', content: d.message }];

    let message = await this.mesurer(operation, this.client.messages.create({ ...params, messages }));
    let recherchesWeb = recherchesDe(message);
    if (message.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: message.content });
      message = await this.mesurer(operation, this.client.messages.create({ ...params, messages }));
      recherchesWeb += recherchesDe(message);
    }
    const reponse = this.reponse(message, modele);
    return {
      ...reponse,
      texte: message.stop_reason === 'pause_turn' ? '' : reponse.texte,
      recherchesWeb,
    };
  }

  /**
   * L'API ne donne pas de code propre au solde épuisé : un 400 dont le message
   * cite le solde de crédits. Fragile, mais c'est le seul signal — d'où
   * l'événement journalisé à chaque bascule, qui montrerait un changement.
   */
  estCreditEpuise(erreur: unknown): boolean {
    const e = erreur as { status?: number; message?: string };
    return e?.status === 400 && /credit balance/i.test(String(e.message ?? ''));
  }
}
