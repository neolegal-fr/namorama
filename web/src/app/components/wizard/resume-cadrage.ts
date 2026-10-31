import { SANS_LIMITE, PLANCHER_DE_LONGUEUR } from './bornes-affichees';

/**
 * La phrase qui ouvre l'écran de cadrage : ce que la recherche va chercher,
 * en une lecture. « Des noms inventés de 10 caractères au plus, sans
 * « bank », libres en .com ou .fr. »
 *
 * Sept réglages empilés ne disaient pas qu'ils étaient presque tous déjà
 * remplis d'après la description : on les lisait tous avant d'oser lancer.
 * La phrase dit l'essentiel ; les blocs dessous servent à le corriger.
 * Chantier `refondre-l-ecran-de-cadrage`.
 */
export interface ParametresDuResume {
  style: 'inventes' | 'descriptifs' | 'culturels';
  bornes: { min: number; max: number };
  eviter: string[];
  fins: string[];
  avec: string[];
  extensions: string[];
  toutes: boolean;
}

type Traduire = (cle: string, params?: Record<string, unknown>) => string;

const P = 'WIZARD.STEP2.';

export function composerResume(p: ParametresDuResume, t: Traduire): string {
  const { min, max } = p.bornes;
  const longueur = max >= SANS_LIMITE ? t(P + 'RESUME_LENGTH_MIN', { min })
    : min === max ? t(P + 'RESUME_LENGTH_EXACT', { n: min })
    : min > PLANCHER_DE_LONGUEUR ? t(P + 'RESUME_LENGTH_RANGE', { min, max })
    : t(P + 'RESUME_LENGTH_MAX', { max });

  const citer = (mots: string[]) => mots.map((mot) => t(P + 'RESUME_QUOTE', { mot })).join(', ');
  const fragments = [`${t(P + 'RESUME_STYLE_' + p.style.toUpperCase())} ${longueur}`];
  if (p.eviter.length) fragments.push(t(P + 'RESUME_AVOID', { mots: citer(p.eviter) }));
  if (p.fins.length) fragments.push(t(P + 'RESUME_ENDINGS', { fins: p.fins.map((f) => `-${f}`).join(', ') }));
  if (p.avec.length) fragments.push(t(P + 'RESUME_REQUIRED', { mots: citer(p.avec) }));
  if (p.extensions.length) {
    const conj = t(P + (p.toutes ? 'RESUME_AND' : 'RESUME_OR'));
    const liste = p.extensions.length === 1
      ? p.extensions[0]
      : `${p.extensions.slice(0, -1).join(', ')} ${conj} ${p.extensions[p.extensions.length - 1]}`;
    fragments.push(t(P + 'RESUME_EXTENSIONS', { liste }));
  }
  return fragments.join(', ') + '.';
}
