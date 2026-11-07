import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BrandReportController } from './brand-report.controller';
import { BRAND_REPORT_COST } from './brand-report.service';

/**
 * Requête sans en-tête de session : le journal des visites (`FunnelService`)
 * n'a alors rien à marquer, ce qui est le cas nominal côté serveur — un appel
 * hors navigateur ne porte pas d'identifiant de visite.
 */
const requete = { headers: {} } as any;

describe('BrandReportController — crédits (US-052)', () => {
  const dto = { name: 'Qonto' } as any;
  const user = { sub: 'kc-123', email: 'me@example.com' };

  /**
   * Par défaut, le droit au rapport offert est DÉJÀ CONSOMMÉ (`freeAvailable:
   * false`) : ces tests décrivent le parcours payant, celui qui existait avant
   * le rapport offert mensuel. Les cas « offert » sont dans le describe suivant.
   */
  function make(opts: { totalCredits: number; newTotal?: number; freeAvailable?: boolean }) {
    const generate = jest.fn().mockResolvedValue({ name: 'Qonto', score: 80 });
    const decrementCredits = jest.fn().mockResolvedValue(opts.newTotal ?? 0);
    const findOrCreate = jest.fn().mockResolvedValue({ totalCredits: opts.totalCredits });
    const freeAvailable = opts.freeAvailable ?? false;
    const isFreeReportAvailable = jest.fn().mockReturnValue(freeAvailable);
    // Consomme le droit une seule fois, puis répond « plus disponible » :
    // c'est le contrat de la vraie méthode, sous verrou.
    let freeLeft = freeAvailable;
    const consumeFreeReport = jest.fn().mockImplementation(async () => {
      if (!freeLeft) return false;
      freeLeft = false;
      return true;
    });
    const event = jest.fn();
    // transaction(cb) exécute simplement le callback avec un manager factice.
    const dataSource = { transaction: (cb: any) => cb({}) } as any;
    const sendReport = jest.fn().mockResolvedValue(true);
    const find = jest.fn().mockResolvedValue(null); // pas de rapport en cache par défaut
    const save = jest.fn().mockResolvedValue(undefined);
    const ctrl = new BrandReportController(
      { generate } as any,
      { find, save } as any,
      { sendReport } as any,
      { findOrCreate, decrementCredits, isFreeReportAvailable, consumeFreeReport } as any,
      dataSource,
      { event } as any,
      { marquer: jest.fn(), lier: jest.fn(), visite: jest.fn() } as any,
      { accessFor: jest.fn() } as any,
    );
    return { ctrl, generate, decrementCredits, consumeFreeReport, event, sendReport, find, save };
  }

  it('bloque et ne génère pas si crédits < coût', async () => {
    const { ctrl, generate, event } = make({ totalCredits: BRAND_REPORT_COST - 1 });
    await expect(ctrl.full(dto, user, requete)).rejects.toBeInstanceOf(ForbiddenException);
    expect(generate).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith('brand_report_blocked_no_credits', expect.any(Object));
  });

  it('ne débite pas et renvoie le rapport en cache s\'il existe déjà', async () => {
    const { ctrl, generate, decrementCredits, find } = make({ totalCredits: BRAND_REPORT_COST * 2 });
    find.mockResolvedValue({ name: 'Qonto', score: 90 });
    const res: any = await ctrl.full(dto, user, requete);
    expect(res.cached).toBe(true);
    expect(res.score).toBe(90);
    expect(generate).not.toHaveBeenCalled();
    expect(decrementCredits).not.toHaveBeenCalled();
  });

  it('génère puis débite le coût, et renvoie les crédits restants', async () => {
    const { ctrl, generate, decrementCredits, event, sendReport, save } = make({ totalCredits: BRAND_REPORT_COST * 2, newTotal: 200 });
    const res: any = await ctrl.full(dto, user, requete);
    expect(generate).toHaveBeenCalledWith('Qonto', { extensions: undefined, withQuality: true });
    expect(save).toHaveBeenCalled();
    expect(decrementCredits).toHaveBeenCalledWith('kc-123', BRAND_REPORT_COST, expect.anything());
    expect(res.remainingCredits).toBe(200);
    expect(res.score).toBe(80);
    expect(res.emailed).toBe(true);
    expect(sendReport).toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith('brand_report_generated', expect.objectContaining({ cost: BRAND_REPORT_COST }));
  });

  it('annule si les crédits deviennent insuffisants au moment du débit (course)', async () => {
    const { ctrl } = make({ totalCredits: BRAND_REPORT_COST * 2, newTotal: -1 });
    await expect(ctrl.full(dto, user, requete)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('BrandReportController — traçage des demandes', () => {
  const dto = { name: 'Qonto' } as any;
  const user = { sub: 'kc-123', email: 'me@example.com' };

  function make(opts: { totalCredits: number; generate?: jest.Mock; find?: jest.Mock }) {
    const generate = opts.generate ?? jest.fn().mockResolvedValue({ name: 'Qonto', score: 80 });
    const find = opts.find ?? jest.fn().mockResolvedValue(null);
    const event = jest.fn();
    const ctrl = new BrandReportController(
      { generate } as any,
      { find, save: jest.fn().mockResolvedValue(undefined) } as any,
      { sendReport: jest.fn().mockResolvedValue(true) } as any,
      {
        findOrCreate: jest.fn().mockResolvedValue({ totalCredits: opts.totalCredits }),
        decrementCredits: jest.fn().mockResolvedValue(0),
        // Droit gratuit déjà consommé : ces tests portent sur le traçage du
        // parcours payant, pas sur le rapport offert.
        isFreeReportAvailable: jest.fn().mockReturnValue(false),
        consumeFreeReport: jest.fn().mockResolvedValue(false),
      } as any,
      { transaction: (cb: any) => cb({}) } as any,
      { event } as any,
      { marquer: jest.fn(), lier: jest.fn(), visite: jest.fn() } as any,
      { accessFor: jest.fn() } as any,
    );
    return { ctrl, event };
  }

  /** La demande est comptée quelle que soit son issue — sinon l'usage réel est sous-estimé. */
  it('émet brand_report_requested avant tout traitement', async () => {
    const { ctrl, event } = make({ totalCredits: BRAND_REPORT_COST * 2 });
    await ctrl.full(dto, user, requete);
    expect(event).toHaveBeenNthCalledWith(1, 'brand_report_requested', {
      sub: 'kc-123',
      cost: BRAND_REPORT_COST,
      forced: false,
    });
  });

  it('émet brand_report_requested même quand la demande est bloquée faute de crédits', async () => {
    const { ctrl, event } = make({ totalCredits: BRAND_REPORT_COST - 1 });
    await expect(ctrl.full(dto, user, requete)).rejects.toBeInstanceOf(ForbiddenException);
    expect(event).toHaveBeenNthCalledWith(1, 'brand_report_requested', expect.any(Object));
    expect(event).toHaveBeenCalledWith('brand_report_blocked_no_credits', expect.any(Object));
  });

  it('émet brand_report_requested même quand le rapport vient du cache', async () => {
    const { ctrl, event } = make({
      totalCredits: BRAND_REPORT_COST * 2,
      find: jest.fn().mockResolvedValue({ name: 'Qonto', score: 90 }),
    });
    await ctrl.full(dto, user, requete);
    expect(event).toHaveBeenNthCalledWith(1, 'brand_report_requested', expect.any(Object));
    expect(event).toHaveBeenCalledWith('brand_report_cache_hit', expect.any(Object));
  });

  it('marque forced quand la régénération est forcée', async () => {
    const { ctrl, event } = make({ totalCredits: BRAND_REPORT_COST * 2 });
    await ctrl.full({ name: 'Qonto', force: true } as any, user, requete);
    expect(event).toHaveBeenNthCalledWith(1, 'brand_report_requested',
      expect.objectContaining({ forced: true }));
  });

  /** Un échec ne débite rien : sans cet événement, l'écart demandes/rapports est inexpliqué. */
  it('émet brand_report_failed et propage l\'erreur si la génération échoue', async () => {
    const { ctrl, event } = make({
      totalCredits: BRAND_REPORT_COST * 2,
      generate: jest.fn().mockRejectedValue(new Error('INPI injoignable')),
    });
    await expect(ctrl.full(dto, user, requete)).rejects.toThrow('INPI injoignable');
    expect(event).toHaveBeenCalledWith('brand_report_failed',
      expect.objectContaining({ sub: 'kc-123', reason: 'INPI injoignable' }));
    expect(event).not.toHaveBeenCalledWith('brand_report_generated', expect.anything());
  });
});

/**
 * Rapport approfondi offert — un par mois calendaire (étape 9 du handoff).
 *
 * Ces tests protègent la facturation : le droit ne doit ni être oublié (on
 * débiterait un rapport dû), ni être servi deux fois (on offrirait 50 crédits
 * de trop), ni dispenser un second rapport du tarif plein.
 */
describe('BrandReportController — une règle unique de tarification', () => {
  /*
   * Le rapport offert mensuel a été retiré. Ces tests verrouillent ce qui le
   * remplace : un tarif, toujours le même, et aucune comptabilité parallèle.
   */
  const faire = (credits: number) => {
    const decrement = jest.fn().mockResolvedValue(credits - 50);
    const save = jest.fn().mockResolvedValue(undefined);
    const users: any = {
      findOrCreate: jest.fn().mockResolvedValue({ totalCredits: credits, email: 'a@b.c' }),
      decrementCredits: decrement,
    };
    const controller: any = new BrandReportController(
      { generate: jest.fn().mockResolvedValue({ name: 'qonto', score: 70, domains: [], socials: [], trademark: {} }) } as any,
      { find: jest.fn().mockResolvedValue(null), save } as any,
      { sendReport: jest.fn().mockResolvedValue(true) } as any,
      users,
      { transaction: (cb: any) => cb({}) } as any,
      { event: jest.fn(), warn: jest.fn() } as any,
      { marquer: jest.fn(), lier: jest.fn(), visite: jest.fn() } as any,
      { accessFor: jest.fn() } as any,
    );
    return { controller, decrement, save, users };
  };

  it('débite le tarif plein, dès le premier rapport du mois', async () => {
    const { controller, decrement, save } = faire(100);
    await controller.full({ name: 'qonto' }, { sub: 'u1', email: 'a@b.c' }, requete);
    expect(decrement).toHaveBeenCalledWith('u1', 50, expect.anything());
    expect(save.mock.calls[0][3]).toBe(50);
  });

  it("refuse quand le solde ne couvre pas le tarif — plus aucune gratuité n'en dispense", async () => {
    const { controller, decrement } = faire(0);
    await expect(controller.full({ name: 'qonto' }, { sub: 'u1' }, requete)).rejects.toThrow('Crédits insuffisants');
    expect(decrement).not.toHaveBeenCalled();
  });

  it('ne consulte aucun droit gratuit : la méthode a disparu du service', () => {
    const { users } = faire(100);
    expect((users as any).consumeFreeReport).toBeUndefined();
    expect((users as any).isFreeReportAvailable).toBeUndefined();
  });
});

describe('BrandReportController — rafraîchissement gratuit', () => {
  const user = { sub: 'kc-123', email: 'me@example.com' };
  const vieux = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const recent = new Date(Date.now() - 60 * 1000).toISOString();

  function make(opts: { generatedAt: string; credits?: number; freeAvailable?: boolean }) {
    const generate = jest.fn().mockResolvedValue({ name: 'Qonto', score: 80 });
    const decrementCredits = jest.fn().mockResolvedValue(0);
    const consumeFreeReport = jest.fn().mockResolvedValue(!!opts.freeAvailable);
    const save = jest.fn().mockResolvedValue(undefined);
    const find = jest.fn().mockResolvedValue({ name: 'Qonto', score: 70, generatedAt: opts.generatedAt });
    const event = jest.fn();
    const ctrl = new BrandReportController(
      { generate } as any,
      { find, save } as any,
      { sendReport: jest.fn().mockResolvedValue(true) } as any,
      {
        findOrCreate: jest.fn().mockResolvedValue({ totalCredits: opts.credits ?? 0 }),
        decrementCredits,
        isFreeReportAvailable: jest.fn().mockReturnValue(!!opts.freeAvailable),
        consumeFreeReport,
      } as any,
      { transaction: (cb: any) => cb({}) } as any,
      { event } as any,
      { marquer: jest.fn(), lier: jest.fn(), visite: jest.fn() } as any,
      { accessFor: jest.fn() } as any,
    );
    return { ctrl, generate, decrementCredits, consumeFreeReport, save, event };
  }

  it('ne débite rien et ne consomme pas le droit gratuit', async () => {
    const { ctrl, decrementCredits, consumeFreeReport, event } = make({ generatedAt: vieux });
    const res: any = await ctrl.full({ name: 'Qonto', force: true } as any, user, requete);
    expect(decrementCredits).not.toHaveBeenCalled();
    expect(consumeFreeReport).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith('brand_report_generated', expect.objectContaining({ cost: 0, refresh: true }));
    expect(res.cached).toBe(false);
  });

  it('fonctionne à 0 crédit : un rapport payé reste maintenable', async () => {
    const { ctrl, generate } = make({ generatedAt: vieux, credits: 0 });
    await expect(ctrl.full({ name: 'Qonto', force: true } as any, user, requete)).resolves.toBeDefined();
    expect(generate).toHaveBeenCalled();
  });

  it("n'écrase pas le coût d'origine en base", async () => {
    const { ctrl, save } = make({ generatedAt: vieux });
    await ctrl.full({ name: 'Qonto', force: true } as any, user, requete);
    expect(save).toHaveBeenCalledWith('kc-123', 'Qonto', expect.any(Object), undefined);
  });

  it('rend le rapport en cache si le précédent date de moins de 6 h, sans réinterroger', async () => {
    const { ctrl, generate, event } = make({ generatedAt: recent });
    const res: any = await ctrl.full({ name: 'Qonto', force: true } as any, user, requete);
    expect(generate).not.toHaveBeenCalled();
    expect(res.cached).toBe(true);
    expect(event).toHaveBeenCalledWith('brand_report_refresh_throttled', expect.any(Object));
  });
});

describe('BrandReportController — renvoi par e-mail', () => {
  const invite = { sub: 'kc-invite', email: 'invite@example.com' };

  /**
   * `find` ne connaît qu'un rapport : celui de « norvane », rangé sous le
   * propriétaire du projet `p-1`, qui l'a payé.
   */
  function make() {
    const find = jest.fn().mockImplementation(async (sub: string, name: string) =>
      sub === 'kc-proprio' && name === 'norvane' ? { name: 'norvane', shareToken: 'tok' } : null);
    const sendReport = jest.fn().mockResolvedValue(true);
    const generate = jest.fn();
    const decrementCredits = jest.fn();
    const event = jest.fn();
    const accessFor = jest.fn().mockImplementation(async (projectId: string) =>
      projectId === 'p-1' ? { role: 'read', owner: { keycloakId: 'kc-proprio' } } : null);
    const ctrl = new BrandReportController(
      { generate } as any,
      { find, save: jest.fn() } as any,
      { sendReport } as any,
      { findOrCreate: jest.fn().mockResolvedValue({ keycloakId: 'kc-invite' }), decrementCredits } as any,
      { transaction: (cb: any) => cb({}) } as any,
      { event } as any,
      { marquer: jest.fn(), lier: jest.fn(), visite: jest.fn() } as any,
      { accessFor } as any,
    );
    return { ctrl, find, sendReport, generate, decrementCredits, event };
  }

  it("envoie le rapport payé par le propriétaire quand l'invité passe par le projet", async () => {
    const { ctrl, sendReport, generate, decrementCredits, event } = make();
    const res = await ctrl.send({ name: 'norvane', emails: ['associe@example.com'], projectId: 'p-1' }, invite);
    expect(res).toEqual({ sent: true });
    expect(sendReport).toHaveBeenCalledWith(['associe@example.com'], expect.objectContaining({ name: 'norvane' }));
    expect(generate).not.toHaveBeenCalled();
    expect(decrementCredits).not.toHaveBeenCalled();
    expect(event).toHaveBeenCalledWith('brand_report_reshared', { sub: 'kc-invite', sent: true, viaProjet: true });
  });

  it('sans projet, cherche sous le seul appelant, comme avant', async () => {
    const { ctrl, find } = make();
    await expect(ctrl.send({ name: 'norvane', emails: ['a@example.com'] }, invite)).rejects.toBeInstanceOf(NotFoundException);
    expect(find).toHaveBeenCalledWith('kc-invite', 'norvane');
  });

  it('refuse un nom sans rapport, sans rien produire ni débiter', async () => {
    const { ctrl, sendReport, generate, decrementCredits } = make();
    await expect(ctrl.send({ name: 'velvio', projectId: 'p-1' }, invite)).rejects.toBeInstanceOf(NotFoundException);
    expect(sendReport).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(decrementCredits).not.toHaveBeenCalled();
  });
});
