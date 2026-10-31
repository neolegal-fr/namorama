import { ParamMap, Params } from '@angular/router';
import { PeriodeAdmin } from '../../services/admin.service';

/**
 * La période du tableau de bord, telle que l'URL la porte.
 *
 * `?periode=7j` ou `30j` (fenêtre glissante, défaut 30j), `?periode=2026-09`
 * (mois civil), `?periode=plage&du=2026-10-01&au=2026-10-15` (plage libre).
 * Dans l'URL plutôt qu'en mémoire : le lien « Détail des coûts » garde la
 * période, un rechargement aussi, et une vue se partage.
 */
export const PERIODE_DEFAUT: PeriodeAdmin = { type: 'glissante', jours: 30 };

const MOIS = /^\d{4}-(0[1-9]|1[0-2])$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;

export function lirePeriode(q: ParamMap): PeriodeAdmin {
  const p = q.get('periode');
  if (p === '7j') return { type: 'glissante', jours: 7 };
  if (p && MOIS.test(p)) return { type: 'mois', mois: p };
  const du = q.get('du');
  const au = q.get('au');
  if (p === 'plage' && du && au && JOUR.test(du) && JOUR.test(au) && du <= au) return { type: 'plage', du, au };
  return PERIODE_DEFAUT;
}

export function ecrirePeriode(p: PeriodeAdmin): Params {
  switch (p.type) {
    case 'glissante': return { periode: `${p.jours}j`, du: null, au: null };
    case 'mois': return { periode: p.mois, du: null, au: null };
    case 'plage': return { periode: 'plage', du: p.du, au: p.au };
  }
}

/** Ce que l'API attend : un mois civil par `month`, le reste par `from`/`to`. */
export function bornesPeriode(p: PeriodeAdmin, maintenant = new Date()): { from?: Date; to?: Date; month?: string } {
  switch (p.type) {
    case 'glissante':
      return { from: new Date(maintenant.getTime() - p.jours * 86_400_000), to: maintenant };
    case 'mois':
      return { month: p.mois };
    case 'plage':
      return { from: new Date(`${p.du}T00:00:00`), to: new Date(`${p.au}T23:59:59.999`) };
  }
}

/**
 * Bornes explicites, pour les routes qui ne connaissent que `from`/`to` (le
 * relevé des coûts) : un mois civil y devient du 1er à 00:00 au dernier jour
 * à 23:59:59.999, à l'heure du navigateur — celle de Paris pour l'admin.
 */
export function bornesExplicites(p: PeriodeAdmin, maintenant = new Date()): { from: Date; to: Date } {
  if (p.type === 'mois') {
    const [a, m] = p.mois.split('-').map(Number);
    return { from: new Date(a, m - 1, 1), to: new Date(new Date(a, m, 1).getTime() - 1) };
  }
  const b = bornesPeriode(p, maintenant);
  return { from: b.from!, to: b.to! };
}

/** Durée en jours, pour savoir si la période se lit comme un mois (≥ 28 jours). */
export function dureeEnJours(p: PeriodeAdmin): number {
  switch (p.type) {
    case 'glissante': return p.jours;
    case 'mois': {
      const [a, m] = p.mois.split('-').map(Number);
      return new Date(a, m, 0).getDate();
    }
    case 'plage':
      return Math.round((new Date(`${p.au}T00:00:00`).getTime() - new Date(`${p.du}T00:00:00`).getTime()) / 86_400_000) + 1;
  }
}

export function libelleMois(mois: string): string {
  return new Date(`${mois}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Ce qu'on compare : « aux 30 jours qui précèdent », « à septembre 2026 »… */
export function libelleComparaison(p: PeriodeAdmin): string {
  switch (p.type) {
    case 'glissante': return `comparés aux ${p.jours} jours qui précèdent`;
    case 'mois': {
      const [a, m] = p.mois.split('-').map(Number);
      const prec = `${new Date(a, m - 2, 1).getFullYear()}-${String(new Date(a, m - 2, 1).getMonth() + 1).padStart(2, '0')}`;
      return `comparés à ${libelleMois(prec)}`;
    }
    case 'plage': return `comparés aux ${dureeEnJours(p)} jours qui précèdent`;
  }
}

/** Les douze derniers mois civils, le plus récent en tête. */
export function moisProposes(maintenant = new Date(), n = 12): { valeur: string; libelle: string }[] {
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - k, 1);
    const valeur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { valeur, libelle: libelleMois(valeur) + (k === 0 ? ' (en cours)' : '') };
  });
}

export function jourISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
