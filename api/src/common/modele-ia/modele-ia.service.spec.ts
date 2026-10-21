import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ModelUsageService } from '../model-usage/model-usage.service';
import { AnthropicAdaptateur } from './anthropic.adaptateur';
import { MODELES_ANTHROPIC_TEST, MODELES_OPENAI_TEST, reponseAnthropic, reponseOpenAi } from './modele-ia.testing';
import { ModeleIA } from './modele-ia.service';
import { Demande } from './modele-ia.types';
import { OpenAiAdaptateur } from './openai.adaptateur';

/**
 * Le secours n'existe que pour un cas : les crédits du mois épuisés. Il ne
 * doit ni manquer ce cas — l'utilisateur verrait une panne —, ni en déborder —
 * une saturation passagère doublerait les appels payants.
 */

/*
 * La forme de l'erreur « solde épuisé » est épinglée ici. Elle sera
 * confirmée sur une réponse réelle (tâche 6.2) ; si elle change, ce test le
 * dira avant la production.
 */
const soldeEpuise = () =>
  new Anthropic.BadRequestError(
    400,
    { type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.' } },
    undefined,
    new Headers(),
  );
const limiteDeDebit = () =>
  new Anthropic.RateLimitError(429, { type: 'error', error: { type: 'rate_limit_error', message: 'Number of request tokens has exceeded your per-minute rate limit' } }, undefined, new Headers());
const requeteInvalide = () =>
  new Anthropic.BadRequestError(400, { type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens: must be positive' } }, undefined, new Headers());

const demande: Demande = { role: 'simple', message: 'desc', format: { type: 'texte' }, maxSortie: 500, raisonnement: 'none' };

function montage(erreurAnthropic: () => Error) {
  const lignes: any[] = [];
  const repo = { create: (x: any) => x, insert: jest.fn(async (x: any) => { lignes.push(x); }) };
  const usage = new ModelUsageService(repo as any);
  const anthropic = jest.fn(async () => { throw erreurAnthropic(); });
  const openai = jest.fn(async () => reponseOpenAi('servi par OpenAI', { usage: { prompt_tokens: 10, completion_tokens: 4 } }));
  const modele = ModeleIA.avec(
    new AnthropicAdaptateur({ messages: { create: anthropic } } as any, MODELES_ANTHROPIC_TEST, usage),
    new OpenAiAdaptateur({ chat: { completions: { create: openai } }, responses: { create: openai } } as any, MODELES_OPENAI_TEST, usage),
  );
  const warn = jest.spyOn((modele as any).logger, 'warn').mockImplementation(() => undefined);
  return { modele, anthropic, openai, lignes, warn };
}

describe('ModeleIA — secours sur crédits épuisés', () => {
  it('rejoue l\'appel chez le secours, avec le modèle du même rôle', async () => {
    const { modele, openai, warn } = montage(soldeEpuise);
    const r = await modele.completer('refine', demande);
    expect(r).toMatchObject({ texte: 'servi par OpenAI', fournisseur: 'openai' });
    expect((openai.mock.calls[0] as any[])[0].model).toBe(MODELES_OPENAI_TEST.simple);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ai_provider_fallback'));
    expect(warn.mock.calls[0][0]).toContain('anthropic');
  });

  it('écrit une seule ligne de relevé, au nom du fournisseur qui a servi', async () => {
    const { modele, lignes } = montage(soldeEpuise);
    await modele.completer('refine', demande);
    await new Promise((r) => setImmediate(r));
    expect(lignes).toHaveLength(1);
    expect(lignes[0]).toMatchObject({ provider: 'openai', operation: 'refine', inputTokens: 10 });
  });

  it('journalise la bascule au plus une fois par heure', async () => {
    const { modele, warn } = montage(soldeEpuise);
    await modele.completer('refine', demande);
    await modele.completer('keywords', demande);
    expect(warn.mock.calls.filter(([m]) => String(m).includes('ai_provider_fallback'))).toHaveLength(1);
  });

  it('vaut aussi pour la recherche web', async () => {
    const { modele, openai } = montage(soldeEpuise);
    openai.mockResolvedValueOnce({ output_text: '{"competitors": []}', output: [{ type: 'web_search_call' }] } as any);
    const r = await modele.chercherSurLeWeb('competitors', { role: 'creatif', message: 'p', maxSortie: 1500, raisonnement: 'low' });
    expect(r).toMatchObject({ fournisseur: 'openai', recherchesWeb: 1 });
  });

  it.each([
    ['une limite de débit', limiteDeDebit],
    ['une requête invalide', requeteInvalide],
  ])('ne bascule pas sur %s : l\'erreur remonte', async (_, erreur) => {
    const { modele, openai } = montage(erreur);
    await expect(modele.completer('refine', demande)).rejects.toBeInstanceOf(Anthropic.APIError);
    expect(openai).not.toHaveBeenCalled();
  });

  it('sans secours, un solde épuisé échoue comme toute erreur', async () => {
    const anthropic = jest.fn(async () => { throw soldeEpuise(); });
    const modele = ModeleIA.avec(new AnthropicAdaptateur({ messages: { create: anthropic } } as any, MODELES_ANTHROPIC_TEST));
    await expect(modele.completer('refine', demande)).rejects.toBeInstanceOf(Anthropic.BadRequestError);
  });

  it('reconnaît le quota OpenAI épuisé, et lui seul', () => {
    const a = new OpenAiAdaptateur({} as any, MODELES_OPENAI_TEST);
    const quota = new OpenAI.RateLimitError(429, { message: 'You exceeded your current quota', type: 'insufficient_quota', code: 'insufficient_quota' }, undefined, new Headers());
    const debit = new OpenAI.RateLimitError(429, { message: 'Rate limit reached', type: 'requests', code: 'rate_limit_exceeded' }, undefined, new Headers());
    expect(a.estCreditEpuise(quota)).toBe(true);
    expect(a.estCreditEpuise(debit)).toBe(false);
  });
});

describe('ModeleIA — réponses inexploitables', () => {
  it('journalise une réponse refusée avec son opération', async () => {
    const create = jest.fn(async () => reponseAnthropic('', { stop_reason: 'refusal', content: [] }));
    const modele = ModeleIA.avec(new AnthropicAdaptateur({ messages: { create } } as any, MODELES_ANTHROPIC_TEST));
    const warn = jest.spyOn((modele as any).logger, 'warn').mockImplementation(() => undefined);
    await modele.completer('refine', demande);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^refine : réponse refusée par anthropic/));
  });
});
