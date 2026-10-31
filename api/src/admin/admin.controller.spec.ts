import { AdminController } from './admin.controller';

/** Les bornes que la route impose avant d'atteindre le service. */
describe('AdminController — séries et période', () => {
  const fabrique = () => {
    const adminService = {
      getSeries: jest.fn(async () => ({ months: [] })),
      getStats: jest.fn(async () => ({})),
    };
    const ctrl = new AdminController(adminService as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
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
