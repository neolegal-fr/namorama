import { AdminService } from './admin.service';

/**
 * Le tri de la liste des utilisateurs vient de l'URL et finit dans un
 * `ORDER BY`, là où aucun paramètre lié ne protège. Ces tests vérifient la
 * seule défense qui vaille : la liste blanche.
 */
describe('AdminService — tri de la liste des utilisateurs', () => {
  function fabrique() {
    const qb: any = {
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    const service = new AdminService(
      { createQueryBuilder: () => qb } as any, // user
      { count: jest.fn() } as any,             // project
      {} as any,                               // domain_suggestion
      { create: jest.fn(), save: jest.fn() } as any, // credit_adjustment
      { count: jest.fn() } as any,             // brand_report_record
      {} as any,                               // dataSource
      { error: jest.fn() } as any,             // journalisation
      { coutsParCompte: jest.fn().mockResolvedValue(new Map()) } as any, // coûts du modèle
    );
    // Les deux compteurs ne sont pas appelés quand la page est vide.
    return { service, qb };
  }

  it('trie par dernière activité quand on le demande', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'lastLogin', 'DESC');
    expect(qb.orderBy).toHaveBeenCalledWith('u.lastLogin', 'DESC');
  });

  it('accepte les compteurs, calculés par sous-requête', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'projectCount', 'ASC');
    expect(qb.orderBy).toHaveBeenCalledWith(expect.stringContaining('SELECT COUNT(*) FROM project'), 'ASC');
  });

  it('trie par coût du modèle, calculé au tarif de chaque appel', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'aiCostUsd', 'DESC');
    expect(qb.orderBy).toHaveBeenCalledWith(expect.stringContaining('FROM model_usage m'), 'DESC');
  });

  it('REFUSE une colonne inconnue et retombe sur la date de création', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'u.email; DROP TABLE user', 'DESC');
    expect(qb.orderBy).toHaveBeenCalledWith('u.createdAt', 'DESC');
  });

  it('refuse un sens de tri fantaisiste', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'email', 'DESC; DELETE FROM user' as any);
    expect(qb.orderBy).toHaveBeenCalledWith('u.email', 'DESC');
  });

  it('départage toujours par identifiant, pour une pagination stable', async () => {
    const { service, qb } = fabrique();
    await service.getUsers(1, 20, '', 'totalCredits', 'DESC');
    expect(qb.addOrderBy).toHaveBeenCalledWith('u.id', 'DESC');
  });
});
