import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ModelUsage } from './model-usage.entity';
import { contexteCourant } from './contexte-appel';
import { sessionIdDeLaRequete } from '../funnel/funnel.service';

/**
 * Ce que faisait un appel. Un appel par ligne du relevé de coûts : c'est la
 * granularité à laquelle on décide de changer de modèle.
 */
export type OperationModele =
  | 'refine'
  | 'suggest_name'
  | 'keywords'
  | 'constraints'
  | 'competitors'
  | 'generate_names'
  | 'analyze'
  | 'pick_best'
  | 'name_variants';

/** Consommation lue dans une réponse, quelle que soit l'API qui l'a rendue. */
export interface Consommation {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  webSearchCalls: number;
  /** `false` si la réponse ne portait pas de `usage` : la ligne est écrite quand même, à zéro, et signalée. */
  mesuree: boolean;
}

const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);

/**
 * Lit la consommation d'une réponse OpenAI.
 *
 * Deux API, deux vocabulaires pour la même chose :
 *
 * - Chat Completions : `prompt_tokens` / `completion_tokens`, détails dans
 *   `prompt_tokens_details.cached_tokens` et
 *   `completion_tokens_details.reasoning_tokens` ;
 * - Responses : `input_tokens` / `output_tokens`, détails dans
 *   `input_tokens_details` et `output_tokens_details`. Les recherches web ne
 *   sont pas des tokens : elles se comptent dans `output`, un élément
 *   `web_search_call` par appel d'outil.
 *
 * Dans les deux cas l'entrée INCLUT sa part en cache, et la sortie son
 * raisonnement : les détails sont des sous-ensembles, pas des compléments.
 */
export function lireConsommation(reponse: any): Consommation {
  const u = reponse?.usage;
  const webSearchCalls = Array.isArray(reponse?.output)
    ? reponse.output.filter((o: any) => o?.type === 'web_search_call').length
    : 0;
  const model = typeof reponse?.model === 'string' && reponse.model ? reponse.model : 'inconnu';

  if (!u) {
    return { model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, webSearchCalls, mesuree: false };
  }
  const responses = u.input_tokens !== undefined || u.output_tokens !== undefined;
  return {
    model,
    inputTokens: entier(responses ? u.input_tokens : u.prompt_tokens),
    cachedInputTokens: entier(responses ? u.input_tokens_details?.cached_tokens : u.prompt_tokens_details?.cached_tokens),
    outputTokens: entier(responses ? u.output_tokens : u.completion_tokens),
    reasoningTokens: entier(responses ? u.output_tokens_details?.reasoning_tokens : u.completion_tokens_details?.reasoning_tokens),
    webSearchCalls,
    mesuree: true,
  };
}

/**
 * Relevé des appels au modèle, un par ligne, pour savoir ce que chaque compte
 * coûte — et ce qu'il coûterait sur un autre modèle.
 *
 * Best-effort de bout en bout, comme les logs : l'écriture n'est pas attendue,
 * et son échec ne remonte jamais à la requête qui a payé l'appel.
 */
@Injectable()
export class ModelUsageService {
  private readonly logger = new Logger(ModelUsageService.name);

  constructor(@InjectRepository(ModelUsage) private readonly repo: Repository<ModelUsage>) {}

  /**
   * Laisse passer la réponse d'un appel, et note ce qu'il a consommé.
   *
   * S'utilise en enveloppe, pour que l'oubli se voie à la lecture :
   * `await usage.mesurer('refine', openai.chat.completions.create({…}))`.
   *
   * Un appel qui LÈVE n'est pas noté : une erreur de l'API n'est pas facturée,
   * et l'exception remonte telle quelle. Une réponse tronquée, elle, l'est — et
   * se note comme les autres.
   */
  async mesurer<T>(operation: OperationModele, appel: Promise<T>, items = 1): Promise<T> {
    // Lu AVANT l'attente : le contexte survit à `await`, mais c'est la requête
    // qui a lancé l'appel qui doit être imputée, pas ce qui suit.
    const ctx = contexteCourant();
    const debut = Date.now();
    const reponse = await appel;
    const conso = lireConsommation(reponse);
    if (!conso.mesuree) {
      this.logger.warn(`Réponse sans « usage » pour ${operation} (${conso.model}) : appel noté à zéro`);
    }

    const ligne = this.repo.create({
      keycloakId: ctx?.imputeA ?? ctx?.req.user?.sub ?? null,
      sessionId: ctx ? sessionIdDeLaRequete(ctx.req) ?? null : null,
      projectId: ctx?.projectId ?? null,
      // `route.path` plutôt que l'URL : pas d'identifiant, donc une valeur qui se groupe.
      route: ctx ? String((ctx.req as any).route?.path ?? ctx.req.path ?? '').slice(0, 120) || null : null,
      operation,
      model: conso.model.slice(0, 64),
      inputTokens: conso.inputTokens,
      cachedInputTokens: conso.cachedInputTokens,
      outputTokens: conso.outputTokens,
      reasoningTokens: conso.reasoningTokens,
      webSearchCalls: conso.webSearchCalls,
      items: Math.max(1, Math.min(items, 32767)),
      durationMs: Date.now() - debut,
    });
    this.repo.insert(ligne).catch((e) => this.logger.warn(`Consommation non enregistrée (${operation}) : ${e}`));

    return reponse;
  }
}
