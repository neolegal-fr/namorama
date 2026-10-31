import { PaymentsService } from './payments.service';

/**
 * Le registre des paiements est la seule source du chiffre d'affaires. Ce qui
 * ne doit jamais arriver : compter une session non payée, compter deux fois la
 * même session (retour navigateur + webhook), ou priver un client de ses
 * crédits parce que l'écriture du registre a échoué.
 */
describe('PaymentsService — registre des paiements', () => {
  const sessionPayee = (surcharges: Record<string, unknown> = {}) => ({
    id: 'cs_test_1',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 990,
    currency: 'eur',
    created: Date.UTC(2026, 2, 2, 17, 45) / 1000,
    metadata: { keycloakId: 'sub-1', type: 'pack', packType: 'decouverte' },
    ...surcharges,
  });

  const fabrique = (options: { echecRegistre?: boolean; session?: any } = {}) => {
    const registre: any[] = [];
    const traitees = new Set<string>();

    // Constructeur de requête minimal : `INSERT IGNORE` sur un `sessionId` unique.
    let valeurs: any;
    const builder: any = {
      insert: () => builder,
      into: () => builder,
      values: (v: any) => { valeurs = v; return builder; },
      orIgnore: () => builder,
      execute: jest.fn(async () => {
        if (options.echecRegistre) throw new Error('Connection lost');
        if (registre.some((p) => p.sessionId === valeurs.sessionId)) return { raw: { affectedRows: 0 } };
        registre.push(valeurs);
        return { raw: { affectedRows: 1 } };
      }),
    };
    const paiementRepo = { createQueryBuilder: jest.fn(() => builder) };
    const stripeEventRepo = {
      find: jest.fn(async () => [...traitees].map((sessionId) => ({ sessionId }))),
      findOne: jest.fn(async ({ where }: any) => (traitees.has(where.sessionId) ? { sessionId: where.sessionId } : null)),
      save: jest.fn(async ({ sessionId }: any) => { traitees.add(sessionId); }),
    };
    const usersService = { addExtraCredits: jest.fn(async () => undefined) };
    const config = { get: jest.fn(() => 'sk_test_x') };

    const svc = new PaymentsService(config as any, usersService as any, stripeEventRepo as any, paiementRepo as any);
    const session = options.session ?? sessionPayee();
    (svc as any).stripe = {
      checkout: { sessions: { retrieve: jest.fn(async () => session) } },
      webhooks: { constructEvent: jest.fn(() => ({ type: 'checkout.session.completed', data: { object: session } })) },
    };
    const erreurs = jest.spyOn((svc as any).logger, 'error').mockImplementation(() => undefined);
    jest.spyOn((svc as any).logger, 'log').mockImplementation(() => undefined);
    return { svc, registre, usersService, erreurs, traitees };
  };

  it('inscrit une session de pack payée, montant en centimes et devise en majuscules', async () => {
    const { svc, registre } = fabrique();
    expect(await svc.enregistrerPaiement(sessionPayee() as any)).toBe(true);
    expect(registre).toEqual([expect.objectContaining({
      sessionId: 'cs_test_1', keycloakId: 'sub-1', pack: 'decouverte', credits: 500,
      montantCentimes: 990, devise: 'EUR',
    })]);
    expect(registre[0].payeLe.toISOString()).toBe('2026-03-02T17:45:00.000Z');
  });

  it("n'inscrit pas une session complète mais non payée", async () => {
    const { svc, registre } = fabrique();
    expect(await svc.enregistrerPaiement(sessionPayee({ payment_status: 'unpaid' }) as any)).toBe(false);
    expect(registre).toHaveLength(0);
  });

  it("n'inscrit pas une session qui n'est pas un pack", async () => {
    const { svc, registre } = fabrique();
    await svc.enregistrerPaiement(sessionPayee({ metadata: { keycloakId: 'sub-1', type: 'abonnement' } }) as any);
    expect(registre).toHaveLength(0);
  });

  it("journalise l'échec du registre avec la session, sans lever", async () => {
    const { svc, erreurs } = fabrique({ echecRegistre: true });
    await expect(svc.enregistrerPaiement(sessionPayee() as any)).resolves.toBe(false);
    expect(erreurs).toHaveBeenCalledWith(expect.stringContaining('payment_record_failed sessionId=cs_test_1'));
  });

  it('retour du navigateur puis webhook : crédits ajoutés une fois, une seule ligne', async () => {
    const { svc, registre, usersService } = fabrique();
    await svc.fulfillSession('cs_test_1', 'sub-1');
    await svc.handleWebhook(Buffer.from('{}'), 'sig');
    expect(usersService.addExtraCredits).toHaveBeenCalledTimes(1);
    expect(registre).toHaveLength(1);
  });

  it('le webhook seul inscrit aussi le paiement', async () => {
    const { svc, registre, usersService } = fabrique();
    await svc.handleWebhook(Buffer.from('{}'), 'sig');
    expect(usersService.addExtraCredits).toHaveBeenCalledWith('sub-1', 500);
    expect(registre).toHaveLength(1);
  });

  it('rattrape les sessions déjà traitées sans ajouter de crédit, et se rejoue sans doublon', async () => {
    const { svc, registre, usersService, traitees } = fabrique();
    traitees.add('cs_mars_1');
    traitees.add('cs_mars_2');
    const sessions: Record<string, any> = {
      cs_mars_1: sessionPayee({ id: 'cs_mars_1', livemode: true, created: Date.UTC(2026, 2, 2) / 1000 }),
      cs_mars_2: sessionPayee({ id: 'cs_mars_2', livemode: true, created: Date.UTC(2026, 2, 15) / 1000, metadata: { keycloakId: 'sub-2', type: 'pack', packType: 'pro' } }),
    };
    (svc as any).stripe.checkout.sessions.retrieve = jest.fn(async (id: string) => sessions[id]);

    const premier = await svc.rattraperPaiements();
    expect(premier.map((l) => l.inscrite)).toEqual([true, true]);
    expect(registre.map((p) => [p.sessionId, p.pack, p.credits])).toEqual([['cs_mars_1', 'decouverte', 500], ['cs_mars_2', 'pro', 2000]]);

    const second = await svc.rattraperPaiements();
    expect(second.map((l) => l.inscrite)).toEqual([false, false]);
    expect(registre).toHaveLength(2);
    expect(usersService.addExtraCredits).not.toHaveBeenCalled();
  });

  it('rapporte une session introuvable chez Stripe sans interrompre les autres', async () => {
    const { svc, registre, traitees } = fabrique();
    traitees.add('cs_disparue');
    traitees.add('cs_test_1');
    (svc as any).stripe.checkout.sessions.retrieve = jest.fn(async (id: string) => {
      if (id === 'cs_disparue') throw new Error('No such checkout.session');
      return sessionPayee();
    });
    const bilan = await svc.rattraperPaiements();
    expect(bilan[0]).toMatchObject({ sessionId: 'cs_disparue', inscrite: false, erreur: 'No such checkout.session' });
    expect(registre).toHaveLength(1);
  });

  it("un registre en panne n'empêche pas l'ajout des crédits", async () => {
    const { svc, usersService } = fabrique({ echecRegistre: true });
    await expect(svc.fulfillSession('cs_test_1', 'sub-1')).resolves.toEqual({ creditsAdded: 500 });
    expect(usersService.addExtraCredits).toHaveBeenCalledWith('sub-1', 500);
  });
});
