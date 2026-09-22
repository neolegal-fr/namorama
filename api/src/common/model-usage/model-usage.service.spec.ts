import { defer, lastValueFrom } from 'rxjs';
import { ModelUsageService, lireConsommation } from './model-usage.service';
import { ContexteAppelInterceptor, imputer } from './contexte-appel';

/**
 * Le relevé ne vaut que par deux promesses : lire les tokens là où chaque API
 * les range, et imputer l'appel au bon compte. Une erreur sur l'une ou l'autre
 * ne se voit nulle part — le chiffre reste plausible, il est simplement faux.
 */

describe('lireConsommation', () => {
  it('lit Chat Completions, cache et raisonnement compris', () => {
    const c = lireConsommation({
      model: 'gpt-5.6-luna-2026-07-01',
      usage: {
        prompt_tokens: 420,
        completion_tokens: 90,
        prompt_tokens_details: { cached_tokens: 128 },
        completion_tokens_details: { reasoning_tokens: 12 },
      },
    });
    expect(c).toEqual({
      model: 'gpt-5.6-luna-2026-07-01',
      inputTokens: 420,
      cachedInputTokens: 128,
      outputTokens: 90,
      reasoningTokens: 12,
      webSearchCalls: 0,
      mesuree: true,
    });
  });

  it('lit Responses, et compte les recherches web dans la sortie', () => {
    const c = lireConsommation({
      model: 'gpt-5.6-terra',
      usage: {
        input_tokens: 5000,
        output_tokens: 700,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens_details: { reasoning_tokens: 300 },
      },
      output: [{ type: 'reasoning' }, { type: 'web_search_call' }, { type: 'web_search_call' }, { type: 'message' }],
    });
    expect(c.inputTokens).toBe(5000);
    expect(c.outputTokens).toBe(700);
    expect(c.reasoningTokens).toBe(300);
    expect(c.webSearchCalls).toBe(2);
  });

  it('signale une réponse sans usage au lieu d\'inventer des tokens', () => {
    const c = lireConsommation({ model: 'x', choices: [] });
    expect(c.mesuree).toBe(false);
    expect(c.inputTokens + c.outputTokens).toBe(0);
  });
});

describe('ModelUsageService.mesurer', () => {
  const fabrique = () => {
    const inserts: any[] = [];
    const repo = { create: (x: any) => x, insert: jest.fn(async (x: any) => { inserts.push(x); }) };
    return { svc: new ModelUsageService(repo as any), inserts, repo };
  };
  const reponse = { model: 'gpt-5.6-luna', usage: { prompt_tokens: 10, completion_tokens: 5 } };

  /**
   * Exécute `corps` comme le ferait un gestionnaire de route derrière
   * l'intercepteur : Nest l'invoque à la souscription, d'où le `defer`.
   */
  const dansUneRequete = (req: any, corps: () => Promise<unknown>) => {
    const ctx: any = { getType: () => 'http', switchToHttp: () => ({ getRequest: () => req }) };
    return lastValueFrom(new ContexteAppelInterceptor().intercept(ctx, { handle: () => defer(corps) }));
  };

  it('rend la réponse intacte et note la consommation', async () => {
    const { svc, inserts } = fabrique();
    const r = await svc.mesurer('refine', Promise.resolve(reponse));
    expect(r).toBe(reponse);
    expect(inserts[0]).toMatchObject({ operation: 'refine', model: 'gpt-5.6-luna', inputTokens: 10, outputTokens: 5, keycloakId: null });
  });

  it('ne note rien quand l\'appel échoue, et laisse passer l\'erreur', async () => {
    const { svc, inserts } = fabrique();
    await expect(svc.mesurer('refine', Promise.reject(new Error('429')))).rejects.toThrow('429');
    expect(inserts).toHaveLength(0);
  });

  it('ne fait jamais échouer la requête si l\'écriture échoue', async () => {
    const { svc, repo } = fabrique();
    repo.insert.mockRejectedValueOnce(new Error('table absente'));
    await expect(svc.mesurer('refine', Promise.resolve(reponse))).resolves.toBe(reponse);
  });

  it('impute au compte du jeton, avec la session et la route', async () => {
    const { svc, inserts } = fabrique();
    const req = { user: { sub: 'sub-A' }, headers: { 'x-session-id': 'session-12345' }, route: { path: '/domain/analyze' } };
    await dansUneRequete(req, () => svc.mesurer('analyze', Promise.resolve(reponse), 7));
    expect(inserts[0]).toMatchObject({ keycloakId: 'sub-A', sessionId: 'session-12345', route: '/domain/analyze', items: 7 });
  });

  it('impute au PAYEUR quand un contrôleur l\'a désigné', async () => {
    const { svc, inserts } = fabrique();
    const req = { user: { sub: 'collaborateur' }, headers: {}, route: { path: '/domain/search/stream' } };
    await dansUneRequete(req, async () => {
      imputer('proprietaire', 'projet-1');
      return svc.mesurer('generate_names', Promise.resolve(reponse));
    });
    expect(inserts[0]).toMatchObject({ keycloakId: 'proprietaire', projectId: 'projet-1' });
  });

  it('laisse sans compte un appel public, rattachable par sa session', async () => {
    const { svc, inserts } = fabrique();
    const req = { headers: { 'x-session-id': 'visite-anonyme-1' }, route: { path: '/domain/keywords' } };
    await dansUneRequete(req, () => svc.mesurer('keywords', Promise.resolve(reponse)));
    expect(inserts[0]).toMatchObject({ keycloakId: null, sessionId: 'visite-anonyme-1' });
  });
});
