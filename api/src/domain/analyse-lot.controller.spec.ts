import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DomainController } from './domain.controller';

/**
 * L'endpoint d'analyse porte trois responsabilités qu'on ne peut pas vérifier
 * depuis le service : les **droits identifiant par identifiant**, le **cache
 * en base** — ce qui ne doit pas être refacturé — et la **répartition** des
 * notes reçues. Les trois précèdent ou suivent l'appel au modèle ; c'est là
 * que l'argent se dépense ou s'économise.
 */

const user = { sub: 'kc-123', email: 'me@example.com' };

type Suggestion = { id: string; domainName: string; analysis: string | null } | null;

function make(suggestions: Record<string, Suggestion>, produites: Record<string, string> = {}) {
  const analyzeNames = jest.fn().mockImplementation(async (noms: string[]) => {
    const m = new Map<string, string>();
    noms.forEach((n) => { if (produites[n]) m.set(n, produites[n]); });
    return m;
  });
  const getSuggestionForUser = jest.fn().mockImplementation(async (id: string) => suggestions[id] ?? null);
  const saveAnalysis = jest.fn().mockResolvedValue(undefined);
  const findOrCreate = jest.fn().mockResolvedValue({ id: 'u1' });
  const ctrl = new DomainController(
    { analyzeNames } as any,
    { findOrCreate } as any,
    { getSuggestionForUser, saveAnalysis } as any,
    {} as any,
    { event: jest.fn() } as any,
    { marquer: jest.fn() } as any,
  );
  return { ctrl, analyzeNames, saveAnalysis, getSuggestionForUser };
}

const note = (nom: string) => JSON.stringify({ lang: 'fr', scores: { memorability: 4 }, origin: nom });

describe('DomainController.analyze — par lot', () => {
  it('note dix suggestions en UN SEUL appel au modèle', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => `id${i}`);
    const suggestions = Object.fromEntries(ids.map((id, i) => [id, { id, domainName: `nom${i}`, analysis: null }]));
    const produites = Object.fromEntries(ids.map((_, i) => [`nom${i}`, note(`nom${i}`)]));
    const { ctrl, analyzeNames, saveAnalysis } = make(suggestions, produites);

    const res = await ctrl.analyze({ suggestionIds: ids, lang: 'fr' } as any, user);

    expect(analyzeNames).toHaveBeenCalledTimes(1);
    expect(analyzeNames.mock.calls[0][0]).toHaveLength(10);
    expect(Object.keys(res.analyses)).toHaveLength(10);
    expect(saveAnalysis).toHaveBeenCalledTimes(10);
  });

  /*
   * Une note déjà en base a déjà été payée. La redemander au modèle, c'est
   * payer deux fois la même chose.
   */
  it('sert le cache sans rien redemander au modèle', async () => {
    const { ctrl, analyzeNames, saveAnalysis } = make({
      a: { id: 'a', domainName: 'velora', analysis: note('velora') },
    });

    const res = await ctrl.analyze({ suggestionIds: ['a'], lang: 'fr' } as any, user);

    expect(analyzeNames).not.toHaveBeenCalled();
    expect(saveAnalysis).not.toHaveBeenCalled();
    expect(res.analyses['a']).toContain('velora');
  });

  it('ne demande au modèle que ce qui manque, dans un lot mixte', async () => {
    const { ctrl, analyzeNames } = make(
      {
        a: { id: 'a', domainName: 'velora', analysis: note('velora') },
        b: { id: 'b', domainName: 'zuvo', analysis: null },
      },
      { zuvo: note('zuvo') },
    );

    const res = await ctrl.analyze({ suggestionIds: ['a', 'b'], lang: 'fr' } as any, user);

    expect(analyzeNames.mock.calls[0][0]).toEqual(['zuvo']);
    expect(Object.keys(res.analyses).sort()).toEqual(['a', 'b']);
  });

  /*
   * Le cache est lié à une LANGUE : une note rendue en français ne sert pas
   * quelqu'un passé à l'anglais.
   */
  it('régénère quand la note en base est dans une autre langue', async () => {
    const { ctrl, analyzeNames } = make(
      { a: { id: 'a', domainName: 'velora', analysis: note('velora') } },
      { velora: JSON.stringify({ lang: 'en' }) },
    );

    await ctrl.analyze({ suggestionIds: ['a'], lang: 'en' } as any, user);

    expect(analyzeNames).toHaveBeenCalled();
  });

  /*
   * La liste vient du navigateur : chaque identifiant passe son propre
   * contrôle de droits, et ce qui est refusé n'atteint jamais le modèle.
   */
  it('écarte une suggestion hors des droits sans la faire analyser', async () => {
    const { ctrl, analyzeNames } = make(
      { a: { id: 'a', domainName: 'velora', analysis: null }, b: null },
      { velora: note('velora') },
    );

    const res = await ctrl.analyze({ suggestionIds: ['a', 'b'], lang: 'fr' } as any, user);

    expect(analyzeNames.mock.calls[0][0]).toEqual(['velora']);
    expect(res.analyses['b']).toBeUndefined();
  });

  /*
   * Une carte supprimée entre-temps ne doit pas emporter les dix-neuf autres :
   * en lot, l'absence se lit dans ce qui manque.
   */
  it('ne lève pas pour un identifiant inconnu au milieu d\'un lot', async () => {
    const { ctrl } = make(
      { a: { id: 'a', domainName: 'velora', analysis: null }, inconnu: null },
      { velora: note('velora') },
    );

    const res = await ctrl.analyze({ suggestionIds: ['a', 'inconnu'] } as any, user);

    expect(res.analyses['a']).toBeDefined();
  });

  it('lève 404 quand le SEUL identifiant demandé est introuvable', async () => {
    const { ctrl } = make({ a: null });

    await expect(ctrl.analyze({ suggestionId: 'a' } as any, user)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lève 400 quand aucun identifiant n\'est fourni', async () => {
    const { ctrl } = make({});

    await expect(ctrl.analyze({} as any, user)).rejects.toBeInstanceOf(BadRequestException);
  });

  /*
   * La forme historique reste servie : un onglet ouvert avant le déploiement
   * continue d'envoyer `suggestionId` seul, et attend `analysis`.
   */
  it('répond aussi sous la forme d\'un nom seul', async () => {
    const { ctrl } = make(
      { a: { id: 'a', domainName: 'velora', analysis: null } },
      { velora: note('velora') },
    );

    const res = await ctrl.analyze({ suggestionId: 'a', lang: 'fr' } as any, user);

    expect(res.analysis).toContain('velora');
  });

  it('ne fait noter qu\'une fois un nom porté par deux suggestions', async () => {
    const { ctrl, analyzeNames, saveAnalysis } = make(
      {
        a: { id: 'a', domainName: 'velora', analysis: null },
        b: { id: 'b', domainName: 'velora', analysis: null },
      },
      { velora: note('velora') },
    );

    const res = await ctrl.analyze({ suggestionIds: ['a', 'b'], lang: 'fr' } as any, user);

    expect(analyzeNames.mock.calls[0][0]).toEqual(['velora']);
    // Une seule note produite, mais les deux suggestions la reçoivent et la gardent.
    expect(res.analyses['a']).toBe(res.analyses['b']);
    expect(saveAnalysis).toHaveBeenCalledTimes(2);
  });

  /*
   * Le modèle peut sauter un nom. La carte doit repasser sur son bouton, pas
   * recevoir une note fabriquée — elle se lirait comme une vraie.
   */
  it('laisse simplement absent un nom que le modèle n\'a pas rendu', async () => {
    const { ctrl, saveAnalysis } = make(
      {
        a: { id: 'a', domainName: 'velora', analysis: null },
        b: { id: 'b', domainName: 'zuvo', analysis: null },
      },
      { velora: note('velora') },
    );

    const res = await ctrl.analyze({ suggestionIds: ['a', 'b'], lang: 'fr' } as any, user);

    expect(res.analyses['a']).toBeDefined();
    expect(res.analyses['b']).toBeUndefined();
    expect(saveAnalysis).toHaveBeenCalledTimes(1);
  });
});
