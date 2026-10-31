import { aucunEcart, DomainService, respecteLesContraintes } from './domain.service';
import { modeleOpenAiFactice } from '../common/modele-ia/modele-ia.testing';

/**
 * Le filtre garantit le cahier des charges, quoi que rende le modèle.
 * Cas paraphrasés du relevé du 31/10/2026.
 */
const base = { minLength: 7, maxLength: 12, avoidWords: [], avoidEndings: [], requiredWords: [], briefMaxLength: null };

describe('respecteLesContraintes', () => {
  it('« 6 lettres exactement » : bornes exactes pour un nom inventé', () => {
    const c = { ...base, minLength: 6, maxLength: 6, briefMaxLength: 6 };
    expect(respecteLesContraintes('kalvio', 'standard', c)).toBeNull();
    expect(respecteLesContraintes('kalvioz', 'standard', c)).toBe('longueur');
    expect(respecteLesContraintes('kalvi', 'standard', c)).toBe('longueur');
  });

  it('« au plus 10 caractères » : pas de lettre de tolérance au-delà du maximum', () => {
    const c = { ...base, minLength: 6, maxLength: 10 };
    expect(respecteLesContraintes('abcdefghij', 'standard', c)).toBeNull(); // 10
    expect(respecteLesContraintes('abcdefghijk', 'standard', c)).toBe('longueur'); // 11
  });

  it('un nom descriptif n’est borné que par le bas', () => {
    const c = { ...base, minLength: 6, maxLength: 6, briefMaxLength: 6 };
    expect(respecteLesContraintes('microcrecheprivee', 'descriptive', c)).toBeNull();
  });

  it('terminaison interdite, quel que soit le style', () => {
    const c = { ...base, avoidEndings: ['ora', 'ia'] };
    expect(respecteLesContraintes('velmora', 'standard', c)).toBe('terminaison');
    expect(respecteLesContraintes('boulangeria', 'descriptive', c)).toBe('terminaison');
    expect(respecteLesContraintes('velmiro', 'standard', c)).toBeNull();
  });

  it('mot à éviter', () => {
    const c = { ...base, avoidWords: ['cyber'] };
    expect(respecteLesContraintes('cyberlock', 'standard', c)).toBe('mot_a_eviter');
  });

  it('mot imposé', () => {
    const c = { ...base, requiredWords: ['bloom'] };
    expect(respecteLesContraintes('canibloom', 'standard', c)).toBeNull();
    expect(respecteLesContraintes('canirose', 'standard', c)).toBe('mot_impose');
  });
});

describe('generateDomainIdeas applique le filtre et compte les écarts', () => {
  it('écarte et compte par motif', async () => {
    const reponse = JSON.stringify({ names: [
      { name: 'velmora', style: 'standard' },     // terminaison
      { name: 'kalvio', style: 'standard' },      // longueur (6 < 7)
      { name: 'canibloom', style: 'standard' },   // conforme
      { name: 'caniroses', style: 'standard' },   // mot imposé manquant
    ] });
    const modele = modeleOpenAiFactice(async () => ({ choices: [{ message: { content: reponse } }] }));
    const svc = new DomainService({} as any, {} as any, modele);
    const ecartes = aucunEcart();
    const c = { minLength: 7, maxLength: 12, avoidWords: [], referenceBrands: [], avoidEndings: ['ora'], requiredWords: ['bloom'], nameType: null, briefMinLength: null, briefMaxLength: null };
    const noms = await svc.generateDomainIdeas('desc', ['mot'], undefined, [], false, false, [], [], c, [], [], ecartes);
    expect(noms.map((n) => n.name)).toEqual(['canibloom']);
    expect(ecartes).toEqual({ longueur: 1, terminaison: 1, mot_a_eviter: 0, mot_impose: 1 });
  });
});
