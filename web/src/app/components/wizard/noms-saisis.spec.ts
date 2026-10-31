import { lireNomsSaisis } from './noms-saisis';

/** Scénarios de la spécification `recherche/test-manuel`. */
describe('lireNomsSaisis', () => {
  it('liste à virgules et points-virgules', () => {
    expect(lireNomsSaisis('velmora, homiara; vellune')).toEqual({ noms: ['velmora', 'homiara', 'vellune'], refus: [] });
  });

  it('un nom par ligne', () => {
    expect(lireNomsSaisis('velmora\nhomiara\nvellune').noms).toEqual(['velmora', 'homiara', 'vellune']);
  });

  it('un nom en deux mots est collé', () => {
    expect(lireNomsSaisis('Neo Legal')).toEqual({ noms: ['neolegal'], refus: [] });
  });

  it('l’extension saisie est retirée', () => {
    expect(lireNomsSaisis('goldelis.com').noms).toEqual(['goldelis']);
  });

  it('une phrase est refusée, rien n’est vérifié', () => {
    expect(lireNomsSaisis('mon choix se porte sur goldelis')).toEqual({ noms: [], refus: ['mon choix se porte sur goldelis'] });
  });

  it('une liste mêlant un nom et une phrase est refusée en entier, l’entrée fautive signalée', () => {
    const r = lireNomsSaisis('goldelis, je préfère celui-ci à tous les autres');
    expect(r.noms).toEqual([]);
    expect(r.refus).toEqual(['je préfère celui-ci à tous les autres']);
  });

  it('doublons retirés', () => {
    expect(lireNomsSaisis('Velmora, velmora.com').noms).toEqual(['velmora']);
  });
});
