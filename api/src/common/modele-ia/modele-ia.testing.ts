import { AnthropicAdaptateur } from './anthropic.adaptateur';
import { ModeleIA } from './modele-ia.service';
import { ModelesParRole } from './modele-ia.types';
import { OpenAiAdaptateur } from './openai.adaptateur';

/** Pour les tests : jamais d'appel réseau, on regarde ce qui serait parti. */
export const MODELES_OPENAI_TEST: ModelesParRole = { simple: 'gpt-simple', creatif: 'gpt-creatif', analyse: 'gpt-analyse' };
export const MODELES_ANTHROPIC_TEST: ModelesParRole = {
  simple: 'claude-haiku-5-5',
  creatif: 'claude-sonnet-5-5',
  analyse: 'claude-haiku-5-5',
};

type Create = (params: any) => Promise<any>;

/** Un `ModeleIA` servi par OpenAI, dont le client est remplacé par `create`. */
export function modeleOpenAiFactice(create: Create, web: Create = create): ModeleIA {
  const client = { chat: { completions: { create } }, responses: { create: web } } as any;
  return ModeleIA.avec(new OpenAiAdaptateur(client, MODELES_OPENAI_TEST));
}

/** Un `ModeleIA` servi par Anthropic, dont le client est remplacé par `create`. */
export function modeleAnthropicFactice(create: Create): ModeleIA {
  return ModeleIA.avec(new AnthropicAdaptateur({ messages: { create } } as any, MODELES_ANTHROPIC_TEST));
}

/** Une réponse Chat Completions minimale. */
export const reponseOpenAi = (content: string, extra: Record<string, unknown> = {}) => ({
  model: 'gpt-simple',
  choices: [{ message: { content }, finish_reason: 'stop' }],
  ...extra,
});

/** Une réponse Messages minimale. */
export const reponseAnthropic = (text: string, extra: Record<string, unknown> = {}) => ({
  type: 'message',
  model: 'claude-haiku-5-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
  usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  ...extra,
});
