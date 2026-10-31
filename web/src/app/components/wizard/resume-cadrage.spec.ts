import { composerResume, ParametresDuResume } from './resume-cadrage';
import fr from '../../../../public/assets/i18n/fr.json';
import en from '../../../../public/assets/i18n/en.json';

/** Traduction minimale, sur les vrais fichiers : clé pointée, `{{param}}` remplacé. */
function traducteur(dico: any) {
  return (cle: string, params: Record<string, unknown> = {}) => {
    const modele: string = cle.split('.').reduce((o, k) => o?.[k], dico);
    if (typeof modele !== 'string') throw new Error(`clé absente : ${cle}`);
    return modele.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(params[k] ?? ''));
  };
}

const base: ParametresDuResume = {
  style: 'inventes', bornes: { min: 6, max: 10 }, eviter: [], fins: [], avec: [], extensions: ['.com', '.fr'], toutes: false,
};

/** Scénarios de la spécification `recherche/ecran-de-cadrage`, « Résumé de la recherche en tête d'écran ». */
describe('composerResume', () => {
  const t = traducteur(fr);

  it('brief contraint, réglages intacts', () => {
    expect(composerResume({ ...base, eviter: ['bank'] }, t))
      .toBe('Des noms inventés de 10 caractères au plus, sans « bank », libres en .com ou .fr.');
  });

  it('critère « toutes les extensions » : « et »', () => {
    expect(composerResume({ ...base, eviter: ['bank'], toutes: true }, t))
      .toBe('Des noms inventés de 10 caractères au plus, sans « bank », libres en .com et .fr.');
  });

  it('aucune contrainte : pas de fragment vide', () => {
    const phrase = composerResume(base, t);
    expect(phrase).toBe('Des noms inventés de 10 caractères au plus, libres en .com ou .fr.');
    expect(phrase).not.toMatch(/, ,|\s,/);
  });

  it('longueur exacte, terminaisons, mot imposé, style élargi', () => {
    expect(composerResume({ ...base, style: 'descriptifs', bornes: { min: 6, max: 6 }, fins: ['ly', 'ia'], avec: ['bloom'], extensions: ['.com'] }, t))
      .toBe('Des noms inventés ou descriptifs de 6 caractères, sans fin en -ly, -ia, avec « bloom », libres en .com.');
  });

  it('minimum du brief et sans limite', () => {
    expect(composerResume({ ...base, bornes: { min: 8, max: 10 } }, t)).toContain('de 8 à 10 caractères');
    expect(composerResume({ ...base, bornes: { min: 6, max: 30 } }, t)).toContain('de 6 caractères ou plus');
  });

  it('en anglais', () => {
    expect(composerResume({ ...base, eviter: ['bank'] }, traducteur(en)))
      .toBe('Invented names of at most 10 characters, without “bank”, available in .com or .fr.');
  });
});
