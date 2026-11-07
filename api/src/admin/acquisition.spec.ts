import { GroupeDeVisites, regrouperAcquisition } from './acquisition';

/**
 * Canaux et pages d'arrivée du tableau de bord.
 * Scénarios de `specs/tableau-de-bord/spec.md` (chantier `mesurer-les-canaux-d-acquisition`).
 */
describe('regrouperAcquisition', () => {
  const g = (o: Partial<GroupeDeVisites> & { visites: number }): GroupeDeVisites => ({
    utmSource: null, referrerHost: null, landingPath: '/', sansCompte: o.visites, comptes: 0, recherches: 0, ...o,
  });

  it('sept jours dominés par un assistant : ChatGPT en tête, direct ensuite', () => {
    const r = regrouperAcquisition([
      g({ utmSource: 'chatgpt.com', landingPath: '/generateur-nom-de-marque', visites: 25, comptes: 6, recherches: 7 }),
      g({ referrerHost: 'chatgpt.com', landingPath: '/generateur-nom-saas', visites: 15, comptes: 4, recherches: 5 }),
      g({ visites: 15, comptes: 1, recherches: 2 }),
    ], null);
    expect(r.canaux).toEqual([
      { cle: 'ia', visites: 40, sansCompte: 40, comptes: 10, recherches: 12 },
      { cle: 'direct', visites: 15, sansCompte: 15, comptes: 1, recherches: 2 },
    ]);
  });

  it('omet un canal sans visite', () => {
    const r = regrouperAcquisition([g({ referrerHost: 'google.fr', visites: 3 }), g({ referrerHost: 'linkedin.com', visites: 0 })], null);
    expect(r.canaux.map((l) => l.cle)).toEqual(['moteurs']);
  });

  it('huit pages, puis « autres pages » qui totalise le reste', () => {
    const groupes = Array.from({ length: 12 }, (_, i) =>
      g({ landingPath: `/page-${String(i).padStart(2, '0')}`, visites: 20 - i, comptes: 1, recherches: 1 }));
    const r = regrouperAcquisition(groupes, null);
    expect(r.pages).toHaveLength(9);
    expect(r.pages.slice(0, 8).map((l) => l.cle)).toEqual(
      ['/page-00', '/page-01', '/page-02', '/page-03', '/page-04', '/page-05', '/page-06', '/page-07']);
    // Les quatre dernières : 12 + 11 + 10 + 9 visites.
    expect(r.pages[8]).toEqual({ cle: 'autres', visites: 42, sansCompte: 42, comptes: 4, recherches: 4 });
  });

  it('une visite sans page d’arrivée compte dans « inconnue », après les autres', () => {
    const r = regrouperAcquisition([g({ landingPath: null, visites: 50 }), g({ landingPath: '/', visites: 3 })], null);
    expect(r.pages.map((l) => l.cle)).toEqual(['/', 'inconnue']);
    expect(r.canaux).toEqual([{ cle: 'direct', visites: 53, sansCompte: 53, comptes: 0, recherches: 0 }]);
  });

  it('additionne les visites arrivées sans compte séparément', () => {
    const r = regrouperAcquisition([g({ referrerHost: 'google.fr', visites: 20, sansCompte: 16, comptes: 4 })], null);
    expect(r.canaux[0]).toMatchObject({ visites: 20, sansCompte: 16, comptes: 4 });
  });

  it('transmet la date de début de mesure', () => {
    expect(regrouperAcquisition([], '2026-11-08')).toEqual({ depuis: '2026-11-08', canaux: [], pages: [] });
  });
});
