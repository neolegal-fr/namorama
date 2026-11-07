import { Canal, canalDe } from '../common/funnel/origine';

/**
 * Canaux d'acquisition et pages d'arrivée d'une période.
 *
 * Fonction pure : la requête rend des groupes (source, référent, page) avec
 * leurs compteurs, et c'est ici qu'ils deviennent des canaux. Le classement se
 * fait donc à la lecture — une liste de domaines corrigée dans `origine.ts`
 * vaut aussi pour les visites déjà enregistrées.
 *
 * Les taux ne sont PAS calculés ici : l'interface les dérive des comptes, avec
 * le socle de 5 visites commun à tout le tableau de bord.
 */

/** Un groupe tel que le rend la requête. */
export interface GroupeDeVisites {
  utmSource: string | null;
  referrerHost: string | null;
  landingPath: string | null;
  visites: number;
  /** Visites arrivées sans compte ouvert : dénominateur du taux d'inscription. */
  sansCompte: number;
  comptes: number;
  recherches: number;
}

/** Une ligne d'un des deux tableaux. */
export interface LigneAcquisition {
  /** Canal (`ia`, `moteurs`…), chemin d'arrivée, `autres` ou `inconnue`. */
  cle: string;
  visites: number;
  sansCompte: number;
  comptes: number;
  recherches: number;
}

export interface Acquisition {
  /**
   * Première visite dont l'origine a été enregistrée (`AAAA-MM-JJ`), ou `null`
   * si aucune ne l'a encore été. Quand la période commence avant cette date,
   * l'interface dit « mesuré depuis le … » : les visites antérieures n'ont pas
   * d'origine, et la requête ne les compte pas. `null` n'est pas « zéro
   * visite » : c'est « pas encore de mesure ».
   */
  depuis: string | null;
  canaux: LigneAcquisition[];
  pages: LigneAcquisition[];
}

/** Pages d'arrivée affichées une à une ; au-delà, une ligne « autres pages ». */
export const PAGES_AFFICHEES = 8;

/** Clés des lignes de regroupement du tableau des pages. */
export const AUTRES_PAGES = 'autres';
export const PAGE_INCONNUE = 'inconnue';

function vide(cle: string): LigneAcquisition {
  return { cle, visites: 0, sansCompte: 0, comptes: 0, recherches: 0 };
}

function ajouter(l: LigneAcquisition, g: GroupeDeVisites | LigneAcquisition): void {
  l.visites += g.visites;
  l.sansCompte += g.sansCompte;
  l.comptes += g.comptes;
  l.recherches += g.recherches;
}

/** Plus de visites d'abord ; à égalité, ordre alphabétique pour rester stable. */
function parVisites(a: LigneAcquisition, b: LigneAcquisition): number {
  return b.visites - a.visites || a.cle.localeCompare(b.cle);
}

export function regrouperAcquisition(groupes: GroupeDeVisites[], depuis: string | null): Acquisition {
  const canaux = new Map<Canal, LigneAcquisition>();
  const pages = new Map<string, LigneAcquisition>();
  for (const g of groupes) {
    if (!g.visites) continue;
    const canal = canalDe(g);
    if (!canaux.has(canal)) canaux.set(canal, vide(canal));
    ajouter(canaux.get(canal)!, g);

    const page = g.landingPath ?? PAGE_INCONNUE;
    if (!pages.has(page)) pages.set(page, vide(page));
    ajouter(pages.get(page)!, g);
  }

  // « Inconnue » n'est pas une page : elle ne prend pas une des huit places,
  // et vient après les autres.
  const inconnue = pages.get(PAGE_INCONNUE);
  pages.delete(PAGE_INCONNUE);
  const triees = [...pages.values()].sort(parVisites);
  const lignesPages = triees.slice(0, PAGES_AFFICHEES);
  const reste = triees.slice(PAGES_AFFICHEES);
  if (reste.length) {
    const autres = vide(AUTRES_PAGES);
    reste.forEach((l) => ajouter(autres, l));
    lignesPages.push(autres);
  }
  if (inconnue) lignesPages.push(inconnue);

  return { depuis, canaux: [...canaux.values()].sort(parVisites), pages: lignesPages };
}
