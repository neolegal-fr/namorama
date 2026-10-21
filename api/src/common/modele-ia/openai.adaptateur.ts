import OpenAI from 'openai';
import type { ModelUsageService, OperationModele } from '../model-usage/model-usage.service';
import { Adaptateur, Demande, ModelesParRole, Reponse, ReponseWeb } from './modele-ia.types';

/**
 * Les appels OpenAI tels qu'ils étaient avant le chantier, paramètre pour
 * paramètre : Chat Completions, `json_object`, `max_completion_tokens`,
 * `reasoning_effort` ; API Responses pour la recherche web.
 */
export class OpenAiAdaptateur implements Adaptateur {
  readonly fournisseur = 'openai' as const;

  constructor(
    private readonly client: Pick<OpenAI, 'chat' | 'responses'>,
    readonly modeles: ModelesParRole,
    private readonly usage?: ModelUsageService,
  ) {}

  static depuisCle(apiKey: string, modeles: ModelesParRole, usage?: ModelUsageService): OpenAiAdaptateur {
    return new OpenAiAdaptateur(new OpenAI({ apiKey }), modeles, usage);
  }

  private mesurer<T>(operation: OperationModele, appel: Promise<T>, items = 1): Promise<T> {
    return this.usage ? this.usage.mesurer(operation, appel, items) : appel;
  }

  async completer(operation: OperationModele, d: Demande): Promise<Reponse> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (d.systeme !== undefined) messages.push({ role: 'system', content: d.systeme });
    messages.push({ role: 'user', content: d.message });

    const response = await this.mesurer(operation, this.client.chat.completions.create({
      model: this.modeles[d.role],
      messages,
      max_completion_tokens: d.maxSortie,
      reasoning_effort: d.raisonnement,
      ...(d.format.type === 'json' ? { response_format: { type: 'json_object' as const } } : {}),
    }), d.items);

    const choix = response.choices?.[0];
    const tronque = choix?.finish_reason === 'length';
    const refuse = !!choix?.message?.refusal;
    return {
      texte: tronque || refuse ? '' : choix?.message?.content ?? '',
      tronque,
      refuse,
      fournisseur: this.fournisseur,
      modele: response.model ?? this.modeles[d.role],
    };
  }

  async chercherSurLeWeb(operation: OperationModele, d: Omit<Demande, 'format'>): Promise<ReponseWeb> {
    const response: any = await this.mesurer(operation, this.client.responses.create({
      model: this.modeles[d.role],
      tools: [{ type: 'web_search' }],
      input: d.message,
      max_output_tokens: d.maxSortie,
      reasoning: { effort: d.raisonnement },
    }));
    const tronque = response.status === 'incomplete' && response.incomplete_details?.reason === 'max_output_tokens';
    return {
      texte: tronque ? '' : response.output_text ?? '',
      tronque,
      refuse: false,
      fournisseur: this.fournisseur,
      modele: response.model ?? this.modeles[d.role],
      recherchesWeb: Array.isArray(response.output)
        ? response.output.filter((o: any) => o?.type === 'web_search_call').length
        : 0,
    };
  }

  /** 429 `insufficient_quota` : le compte n'a plus de solde, pas une limite de débit. */
  estCreditEpuise(erreur: unknown): boolean {
    const e = erreur as { status?: number; code?: string; error?: { code?: string } };
    return e?.status === 429 && (e.code === 'insufficient_quota' || e.error?.code === 'insufficient_quota');
  }
}
