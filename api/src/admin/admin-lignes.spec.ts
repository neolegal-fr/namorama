import { AdminService } from './admin.service';

/**
 * La liste des utilisateurs sur une page NON VIDE.
 *
 * Les tests de tri ne passaient que des pages vides : le 22/09/2026, une
 * variable locale masquant la Map des crédits consommés a mis toute la liste
 * en 500 en production, sans qu'un seul test ne le voie.
 */
describe('AdminService — lignes de la liste des utilisateurs', () => {
  const chaine = (rows: any[]) => {
    const qb: any = {};
    for (const m of ['select', 'addSelect', 'where', 'andWhere', 'groupBy', 'innerJoin', 'orderBy', 'addOrderBy', 'skip', 'take']) {
      qb[m] = jest.fn().mockReturnValue(qb);
    }
    qb.getRawMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  const fabrique = (utilisateur: any) => {
    const qbUsers = chaine([]);
    qbUsers.getManyAndCount = jest.fn().mockResolvedValue([[utilisateur], 1]);
    const dataSource = {
      query: jest.fn(async (sql: string) =>
        sql.includes('domain_suggestion')
          ? [{ userId: utilisateur.id, n: 12 }]
          : [{ keycloakId: utilisateur.keycloakId, n: 50 }]),
    };
    return new AdminService(
      { createQueryBuilder: () => qbUsers } as any,
      { createQueryBuilder: () => chaine([{ userId: utilisateur.id, cnt: '3' }]) } as any,
      {} as any,
      {} as any,
      { createQueryBuilder: () => chaine([{ keycloakId: utilisateur.keycloakId, cnt: '1' }]) } as any,
      dataSource as any,
      { error: jest.fn() } as any,
      { coutsParCompte: jest.fn().mockResolvedValue(new Map([[utilisateur.keycloakId, { costUsd: 0.42, calls: 7, unpricedCalls: 0 }]])) } as any,
    );
  };

  const compte = (champs: Partial<Record<string, any>> = {}) => ({
    id: 5, keycloakId: 'sub-5', email: 'a@b.c', firstName: 'A', lastName: 'B',
    credits: 30, extraCredits: 10, isInternal: false, createdAt: new Date(), lastLogin: new Date(),
    lastFreeReset: new Date(), ...champs,
  });

  it('rend chaque compteur, crédits consommés compris', async () => {
    const { data } = await fabrique(compte()).getUsers(1, 20, '');
    expect(data[0]).toMatchObject({
      projectCount: 3,
      brandReportCount: 1,
      creditsConsumed: 62,
      aiCostUsd: 0.42,
      credits: 30,
      totalCredits: 40,
      freeCreditsRenewalPending: false,
    });
  });

  it('affiche le quota du mois quand son renouvellement reste à écrire', async () => {
    const { data } = await fabrique(compte({ lastFreeReset: new Date(2020, 0, 1) })).getUsers(1, 20, '');
    expect(data[0]).toMatchObject({ credits: 100, totalCredits: 110, freeCreditsRenewalPending: true });
  });
});
