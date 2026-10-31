import { AdminController } from './admin.controller';
import { AdminMailService } from './admin-mail.service';

/** Les bornes que la route impose avant d'atteindre le service. */
describe('AdminController — séries et période', () => {
  const fabrique = () => {
    const adminService = {
      getSeries: jest.fn(async () => ({ months: [] })),
      getStats: jest.fn(async () => ({})),
    };
    const ctrl = new AdminController(adminService as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    return { ctrl, adminService };
  };

  it('ramène une série de 30 mois à 24', async () => {
    const { ctrl, adminService } = fabrique();
    await ctrl.getSeries(30);
    expect(adminService.getSeries).toHaveBeenCalledWith(24);
  });

  it('ramène une série de 0 mois à 1', async () => {
    const { ctrl, adminService } = fabrique();
    await ctrl.getSeries(0);
    expect(adminService.getSeries).toHaveBeenCalledWith(1);
  });

  it('transmet le mois civil demandé', async () => {
    const { ctrl, adminService } = fabrique();
    await ctrl.getStats(undefined, undefined, '2026-09');
    expect(adminService.getStats).toHaveBeenCalledWith(undefined, undefined, '2026-09');
  });

  it('ignore un mois vide', async () => {
    const { ctrl, adminService } = fabrique();
    await ctrl.getStats(undefined, undefined, '');
    expect(adminService.getStats).toHaveBeenCalledWith(undefined, undefined, undefined);
  });
});

/** Chantier `demande-de-retour-automatique`. */
describe('AdminController — demande de retour', () => {
  it('refuse l\'envoi manuel à un compte désinscrit (409)', async () => {
    const adminMail = Object.create(AdminMailService.prototype) as any;
    adminMail.users = { findOne: jest.fn().mockResolvedValue({ id: 3, email: 'x@y.z', desinscritRetoursAt: new Date() }) };
    adminMail.mail = { send: jest.fn() };
    const ctrl = new AdminController({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, adminMail, {} as any);
    await expect(ctrl.sendMail(3, { subject: 'Une question', body: 'Bonjour' } as any, { sub: 'admin', name: 'Nicolas Riousset' }))
      .rejects.toMatchObject({ status: 409 });
    expect(adminMail.mail.send).not.toHaveBeenCalled();
  });

  it('déclenche un passage à la demande, ou dit ce qui manque', async () => {
    const demandes = {
      configurationManquante: jest.fn().mockReturnValue([]),
      passage: jest.fn().mockResolvedValue({ eligibles: 1, envoyes: 1, echecs: 0 }),
    };
    const ctrl = new AdminController({} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, demandes as any);
    await expect(ctrl.passageDemandesDeRetour()).resolves.toEqual({ eligibles: 1, envoyes: 1, echecs: 0 });
    demandes.configurationManquante.mockReturnValue(['FEEDBACK_AUTO_DEPUIS']);
    await expect(ctrl.passageDemandesDeRetour()).resolves.toEqual({ inactive: ['FEEDBACK_AUTO_DEPUIS'] });
  });
});
