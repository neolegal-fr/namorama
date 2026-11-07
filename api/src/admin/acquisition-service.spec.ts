import { AdminService } from './admin.service';

/**
 * L'agrégat `acquisition` du tableau de bord : fenêtre bornée par le début de la
 * mesure, population mesurée, et échec isolé.
 */
describe('AdminService — canaux d’acquisition', () => {
  function service(query: jest.Mock) {
    const error = jest.fn();
    const s = new AdminService(
      null as any, null as any, null as any, null as any, null as any,
      { query } as any, { error } as any, null as any, null as any,
    );
    return { acquisition: (d: Date, f: Date) => (s as any).acquisition(d, f), error };
  }
  const debut = new Date(2026, 9, 9);
  const fin = new Date(2026, 10, 7, 23, 59, 59);

  it('avant toute visite mesurée : pas de date, pas de lignes, pas de seconde requête', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ d: null }]);
    const r = await service(query).acquisition(debut, fin);
    expect(r).toEqual({ depuis: null, canaux: [], pages: [] });
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('ne lit que les visites postérieures au début de la mesure, comptes internes écartés', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ d: '2026-11-08' }])
      .mockResolvedValueOnce([
        { utmSource: 'chatgpt.com', referrerHost: null, landingPath: '/generateur-nom-de-marque', visites: '7', sansCompte: '7', comptes: '2', recherches: '3' },
      ]);
    const r = await service(query).acquisition(debut, fin);
    const [sql, params] = query.mock.calls[1];
    expect(sql).toContain('GREATEST(?, (SELECT MIN(firstSeenAt) FROM visitor_session WHERE landingPath IS NOT NULL))');
    expect(sql).toContain('u.keycloakId IS NULL OR');
    expect(params).toEqual([debut, fin]);
    // Les compteurs arrivent en chaînes de MariaDB : ils sont convertis.
    expect(r.canaux).toEqual([{ cle: 'ia', visites: 7, sansCompte: 7, comptes: 2, recherches: 3 }]);
    expect(r.depuis).toBe('2026-11-08');
  });

  it('échoue seule : null, et l’erreur est journalisée', async () => {
    const query = jest.fn().mockRejectedValue(new Error("Illegal mix of collations"));
    const { acquisition, error } = service(query);
    await expect(acquisition(debut, fin)).resolves.toBeNull();
    expect(error).toHaveBeenCalled();
  });
});
