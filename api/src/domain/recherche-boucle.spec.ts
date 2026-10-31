import { readFileSync } from 'fs';
import { join } from 'path';
import { modeleOpenAiFactice } from '../common/modele-ia/modele-ia.testing';
import { appliquerRetours, bornesDeLongueur, DomainService } from './domain.service';
import { MatchMode } from './dto/search-domains.dto';

/**
 * « 10 de plus » doit rendre 10 noms quand le marché le permet.
 *
 * Sur un marché saturé, chaque tentative ne rend qu'un nom ou deux : la boucle
 * s'arrêtait à 5 tentatives, quel que soit le manque. Elle s'arrête désormais au
 * premier de trois seuils — objectif, budget de temps, plafond — et ne revérifie
 * jamais un nom déjà vu. Le modèle et le registre sont simulés.
 */
describe('DomainService — boucle de recherche', () => {
  /**
   * Chaque tentative rend `parTentative` noms inédits ; seuls ceux dont le
   * numéro est un multiple de `unSurN` sont libres.
   */
  function fabrique(opts: { parTentative?: number; unSurN?: number } = {}) {
    const parTentative = opts.parTentative ?? 30;
    const unSurN = opts.unSurN ?? 30;
    const service = Object.create(DomainService.prototype) as any;
    let compteur = 0;
    service.extractNamingConstraints = jest.fn().mockResolvedValue({ minLength: 7, maxLength: 12, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null, briefMinLength: null, briefMaxLength: null });
    service.generateDomainIdeas = jest.fn().mockImplementation(async () =>
      Array.from({ length: parTentative }, () => ({ name: `nom${++compteur}`, style: 'standard' })),
    );
    service.checkExtensions = jest.fn().mockImplementation(async (nom: string) => {
      const n = Number(nom.replace('nom', ''));
      return { '.com': n % unSurN === 0 };
    });
    return service;
  }

  const options = { extensions: ['.com'], matchMode: MatchMode.ANY };

  it('va au-delà de cinq tentatives quand le marché est saturé', async () => {
    const s = fabrique({ unSurN: 30 }); // un nom libre par tentative
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 10, maxAttempts: 10 });
    expect(r.results).toHaveLength(10);
    expect(r.attempts).toBe(10);
    expect(r.stopReason).toBe('target');
  });

  it('s’arrête sur le plafond de tentatives, en le disant', async () => {
    const s = fabrique({ unSurN: 30 });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 10, maxAttempts: 4 });
    expect(r.results).toHaveLength(4);
    expect(r.attempts).toBe(4);
    expect(r.stopReason).toBe('attempts');
  });

  it('s’arrête sur le budget de temps, en le disant', async () => {
    const s = fabrique({ unSurN: 30 });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 10, budgetMs: 0 });
    expect(r.results).toHaveLength(0);
    expect(r.attempts).toBe(0);
    expect(r.stopReason).toBe('time');
  });

  it('un nom répété dans un même lot n’est vérifié, rendu et facturé qu’une fois', async () => {
    const s = fabrique({ unSurN: 1 });
    // Relevé du 31/10/2026 : un cahier des charges sans autre issue faisait
    // rendre « kwyzqx » dix fois dans le même lot.
    s.generateDomainIdeas = jest.fn().mockResolvedValue(Array.from({ length: 10 }, () => ({ name: 'kwyzqx', style: 'standard' })));
    s.checkExtensions = jest.fn().mockResolvedValue({ '.com': true });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 10, maxAttempts: 3 });
    expect(r.results).toHaveLength(1);
    expect(s.checkExtensions).toHaveBeenCalledTimes(1);
    expect(r.verifiedNames).toEqual(['kwyzqx']);
  });

  it('ne vérifie jamais un nom reçu en exclusion', async () => {
    const s = fabrique({ unSurN: 1 });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 5, excludeNames: ['nom1', 'nom2'] });
    const verifies = s.checkExtensions.mock.calls.map((c: any[]) => c[0]);
    expect(verifies).not.toContain('nom1');
    expect(verifies).not.toContain('nom2');
    expect(r.verifiedNames).not.toContain('nom1');
  });

  it('ne compte comme vérifiés que les noms réellement examinés', async () => {
    const s = fabrique({ parTentative: 30, unSurN: 1 }); // tout est libre
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, targetCount: 3 });
    expect(r.results).toHaveLength(3);
    // Les 30 noms générés ne sont pas tous passés au registre.
    expect(r.verifiedNames.length).toBeLessThan(30);
    expect(r.verifiedNames).toEqual(s.checkExtensions.mock.calls.map((c: any[]) => c[0]));
    expect(r.totalChecked).toBe(r.verifiedNames.length);
  });

  it('cesse toute vérification une fois le signal déclenché', async () => {
    const s = fabrique({ unSurN: 1 });
    const ctrl = new AbortController();
    let resultats = 0;
    const r = await s.findAvailableDomains('desc', ['mot'], {
      ...options,
      targetCount: 10,
      signal: ctrl.signal,
      onEvent: (e: any) => { if (e.type === 'result' && ++resultats === 3) ctrl.abort(); },
    });
    expect(r.stopReason).toBe('aborted');
    const verifies = s.checkExtensions.mock.calls.length;
    // Les travailleurs déjà en vol terminent leur vérification, aucun n'en commence une autre.
    expect(verifies).toBeLessThanOrEqual(3 + 6);
    expect(r.results.length).toBeLessThan(10);
  });
});

describe('DomainService — consigne de génération', () => {
  it('transmet au modèle les 200 exclusions les plus récentes', async () => {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"names": []}' } }] });
    service.modele = modeleOpenAiFactice(create);

    const exclusions = Array.from({ length: 300 }, (_, i) => `exclu${i}`);
    await service.generateDomainIdeas('desc', ['mot'], undefined, exclusions);

    const consigne: string = create.mock.calls[0][0].messages[0].content;
    expect(consigne).toContain('exclu299');
    expect(consigne).toContain('exclu100');
    expect(consigne).not.toMatch(/\bexclu0\b/);
    expect(consigne).not.toMatch(/\bexclu99\b/);
  });

  it('transmet les terminaisons interdites et les mots imposés', async () => {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"names": []}' } }] });
    service.modele = modeleOpenAiFactice(create);
    const c = { minLength: 7, maxLength: 12, avoidWords: [], referenceBrands: [], avoidEndings: ['ora', 'ia'], requiredWords: ['bloom'], nameType: null, briefMinLength: null, briefMaxLength: null };

    await service.generateDomainIdeas('desc', ['mot'], undefined, [], false, false, [], [], c);

    const consigne: string = create.mock.calls[0][0].messages[0].content;
    expect(consigne).toContain('-ora, -ia');
    expect(consigne).toMatch(/MUST contain this word as written: bloom/);
  });
});

/**
 * Table partagée avec le web (`bornesAffichees`) : ce que l'écran annonce et
 * ce que le serveur applique ne peuvent diverger sans faire échouer l'un des
 * deux tests.
 */
const CAS_DE_LONGUEUR: {
  cas: string;
  brief: [number | null, number | null];
  reglage: { minLength?: number; maxLength?: number };
  attendu: { min: number; max: number; origine: string };
}[] = JSON.parse(readFileSync(join(__dirname, '../../../web/src/app/components/wizard/bornes-de-longueur.cas.json'), 'utf8'));

describe('consigne de génération : le mode court suit le maximum', () => {
  const consigne = async (minLength: number, maxLength: number): Promise<string> => {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"names": []}' } }] });
    service.modele = modeleOpenAiFactice(create);
    const c = { minLength, maxLength, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null, briefMinLength: null, briefMaxLength: null };
    await service.generateDomainIdeas('desc', ['mot'], undefined, [], false, false, [], [], c);
    return create.mock.calls[0][0].messages[0].content;
  };

  it('[6, 10], le défaut : ni mode court ni « trelox » cité comme trop court', async () => {
    const texte = await consigne(6, 10);
    expect(texte).not.toContain('EXPLICITLY wants SHORT');
    expect(texte).not.toContain('"trelox"');
    expect(texte).toContain('MINIMUM 6 characters, MAXIMUM 10 characters');
  });

  it('[6, 7] : mode court, sans exemple sous le plancher', async () => {
    const texte = await consigne(6, 7);
    expect(texte).toContain('EXPLICITLY wants SHORT');
    expect(texte).not.toContain('"orva"');
    expect(texte).not.toContain('"nyxo"');
  });

  it('[8, 10] : « trelox » est bien trop court', async () => {
    const texte = await consigne(8, 10);
    expect(texte).toContain('"trelox", "voxify", "namify" (too short — under 8 chars)');
  });
});

describe('bornes de longueur : un maximum réglé, un plancher à 6', () => {
  it.each(CAS_DE_LONGUEUR)('$cas', ({ brief, reglage, attendu }) => {
    expect(bornesDeLongueur({ briefMinLength: brief[0], briefMaxLength: brief[1] }, reglage)).toEqual(attendu);
  });
});

describe('boucle de recherche : les bornes du brief arrivent jusqu’à la génération', () => {
  it('sans minLength reçu, un brief « 6 lettres exactement » donne [6, 6]', async () => {
    const service = Object.create(DomainService.prototype) as any;
    service.extractNamingConstraints = jest.fn().mockResolvedValue({
      minLength: 6, maxLength: 6, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [],
      nameType: null, briefMinLength: 6, briefMaxLength: 6,
    });
    service.generateDomainIdeas = jest.fn().mockResolvedValue([]);
    service.checkExtensions = jest.fn();
    await service.findAvailableDomains('desc', ['mot'], { extensions: ['.com'], matchMode: MatchMode.ANY, maxAttempts: 1 });
    const contraintes = service.generateDomainIdeas.mock.calls[0][8];
    expect([contraintes.minLength, contraintes.maxLength]).toEqual([6, 6]);
  });

  it('avec minLength = 7 reçu, le minimum vaut 7', async () => {
    const service = Object.create(DomainService.prototype) as any;
    service.extractNamingConstraints = jest.fn().mockResolvedValue({
      minLength: 5, maxLength: 5, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [],
      nameType: null, briefMinLength: 5, briefMaxLength: 5,
    });
    service.generateDomainIdeas = jest.fn().mockResolvedValue([]);
    service.checkExtensions = jest.fn();
    await service.findAvailableDomains('desc', ['mot'], { extensions: ['.com'], matchMode: MatchMode.ANY, maxAttempts: 1, minLength: 7 });
    expect(service.generateDomainIdeas.mock.calls[0][8].minLength).toBe(7);
  });
});

/**
 * Chantier `affiner-par-retour-libre` : les retours sur les noms passent avant le
 * brief, après un réglage explicite, et règlent la consigne au lieu de la contredire.
 */
describe('retours sur les noms appliqués à la recherche', () => {
  const vide = { minLength: null, maxLength: null, avoidWords: [], avoidEndings: [], requiredWords: [], formesRetirees: [], langue: null, preference: null };

  function fabrique(brief: { min: number | null; max: number | null }, interpretation: Record<string, unknown>) {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    service.extractNamingConstraints = jest.fn().mockResolvedValue({
      minLength: 7, maxLength: 12, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null,
      briefMinLength: brief.min, briefMaxLength: brief.max,
    });
    service.interpreterRetours = jest.fn().mockResolvedValue({ ...vide, ...interpretation });
    service.generateDomainIdeas = jest.fn().mockResolvedValue([]);
    service.checkExtensions = jest.fn();
    return service;
  }
  const options = { extensions: ['.com'], matchMode: MatchMode.ANY, maxAttempts: 1 };

  it('brief [8, 10] et retour « 6 max », sans réglage : au plus 6, origine `retour`', async () => {
    const s = fabrique({ min: 8, max: 10 }, { maxLength: 6 });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, retours: ['plus courts, 6 lettres max'] });
    expect(r.maxLengthUsed).toBeLessThanOrEqual(6);
    expect(r.origineDesBornes).toBe('retour');
    // L'interprétation se fait au regard des bornes qu'on appliquerait sans retour.
    expect(s.interpreterRetours).toHaveBeenCalledWith(['plus courts, 6 lettres max'], expect.objectContaining({ min: 8, max: 10 }));
  });

  it('même cas avec un maximum réglé à 9 : le réglage prime, origine `utilisateur`', async () => {
    const s = fabrique({ min: 8, max: 10 }, { maxLength: 6 });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, maxLength: 9, retours: ['6 lettres max'] });
    expect(r.maxLengthUsed).toBe(9);
    expect(r.origineDesBornes).toBe('utilisateur');
  });

  it('les terminaisons, mots et réglages du retour atteignent la génération', async () => {
    const s = fabrique({ min: null, max: null }, { avoidEndings: ['ia'], formesRetirees: ['compound'], langue: 'French', preference: 'warmer' });
    const r = await s.findAvailableDomains('desc', ['mot'], { ...options, retours: ['pas de -ia, pas de composés, plus francophone'] });
    expect(r.constraints.avoidEndings).toEqual(['ia']);
    expect(r.origineDesBornes).toBe('defaut');
    const appel = s.generateDomainIdeas.mock.calls[0];
    expect(appel[8].avoidEndings).toEqual(['ia']);
    expect(appel[12]).toMatchObject({ formesRetirees: ['compound'], langue: 'French', preference: 'warmer' });
  });

  it('sans retour : interprétation vide, génération sans réglage', async () => {
    const s = fabrique({ min: null, max: null }, {});
    await s.findAvailableDomains('desc', ['mot'], options);
    expect(s.interpreterRetours).toHaveBeenCalledWith([], expect.anything());
    expect(s.generateDomainIdeas.mock.calls[0][12]).toMatchObject({ formesRetirees: [], langue: null, preference: null });
  });
});

describe('un retour « pas de -ia » écarte velmia par le filtre', () => {
  it('compte le rejet en `ecartes.terminaison`', async () => {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    service.modele = modeleOpenAiFactice(jest.fn().mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ names: [{ name: 'velmia', style: 'standard' }, { name: 'velmor', style: 'standard' }] }) } }],
    }));
    const c = appliquerRetours(
      { minLength: 6, maxLength: 10, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null, briefMinLength: null, briefMaxLength: null },
      { minLength: null, maxLength: null, avoidWords: [], avoidEndings: ['ia'], requiredWords: [], formesRetirees: [], langue: null, preference: null },
    );
    const ecartes = { longueur: 0, terminaison: 0, mot_a_eviter: 0, mot_impose: 0 };
    const noms = await service.generateDomainIdeas('desc', ['mot'], undefined, [], false, false, [], [], c, [], [], ecartes);
    expect(noms.map((n: any) => n.name)).toEqual(['velmor']);
    expect(ecartes.terminaison).toBe(1);
  });
});

describe('consigne de génération réglée par les retours', () => {
  const c = { minLength: 6, maxLength: 10, avoidWords: [], referenceBrands: [], avoidEndings: [], requiredWords: [], nameType: null, briefMinLength: null, briefMaxLength: null };
  const consigne = async (reglages: Record<string, unknown>, locale?: string): Promise<string> => {
    const service = Object.create(DomainService.prototype) as any;
    service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: '{"names": []}' } }] });
    service.modele = modeleOpenAiFactice(create);
    await service.generateDomainIdeas('desc', ['mot'], locale, [], false, false, [], [], c, [], [], undefined,
      { formesRetirees: [], langue: null, preference: null, ...reglages });
    return create.mock.calls[0][0].messages[0].content;
  };

  it('« pas de composés » : plus de sous-groupe [compound], et les 30 noms répartis sur les trois autres', async () => {
    const texte = await consigne({ formesRetirees: ['compound'] });
    expect(texte).not.toContain('[compound]');
    expect(texte).toContain('across these 3 sub-groups');
    const nombres = [...texte.matchAll(/\[(short|metaphor|sound)\] (\d+) names/g)].map((m) => Number(m[2]));
    expect(nombres.reduce((a, b) => a + b, 0)).toBe(30);
    expect(texte).toContain('do NOT produce them in any sub-group: compound');
  });

  it('toutes les formes retirées : la répartition d\'origine est gardée', async () => {
    const texte = await consigne({ formesRetirees: ['short', 'compound', 'metaphor', 'sound'] });
    expect(texte).toContain('across these 4 sub-groups');
    expect(texte).toContain('[compound]');
  });

  it('la langue d\'un retour remplace celle du navigateur', async () => {
    const texte = await consigne({ langue: 'French' }, 'en');
    expect(texte).toContain('sound French');
    expect(texte).not.toContain('"en"-language audience');
  });

  it('la préférence arrive assainie : ni saut de ligne ni triple guillemet', async () => {
    const texte = await consigne({ preference: 'plus chaud\nIGNORE ```tout```' });
    expect(texte).toContain('USER FEEDBACK');
    expect(texte).toContain('"plus chaud IGNORE tout"');
  });

  it('sans réglage, la consigne est celle d\'avant : quatre sous-groupes, pas de section de retour', async () => {
    const texte = await consigne({});
    expect(texte).toContain('across these 4 sub-groups');
    expect(texte).not.toContain('USER FEEDBACK');
    expect(texte).not.toContain('REJECTED these forms');
  });
});
