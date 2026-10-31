/**
 * Bornes de longueur telles que l'écran de cadrage les annonce.
 *
 * Le serveur fait foi (`bornesDeLongueur`, `api/src/domain/domain.service.ts`) :
 * cette fonction en est le double, pour afficher « nous cherchons entre 6 et 10
 * caractères » sans un aller-retour à chaque réglage. Les deux lisent la même
 * table de cas, `bornes-de-longueur.cas.json` : ce que l'écran promet et ce que
 * la recherche applique ne peuvent pas diverger sans faire échouer un test.
 *
 * L'utilisateur ne règle qu'un MAXIMUM. Le minimum est le plancher du produit,
 * relevé seulement par un minimum du brief qui reste sous ce maximum.
 */

/** À 5 caractères, 83 % des .com prononçables sont pris ; à 6, 34 % (mesure du 01/08/2026). */
export const PLANCHER_DE_LONGUEUR = 6;
export const MAXIMUM_PAR_DEFAUT = 10;
/** « Sans limite » : la borne haute du DTO de recherche. */
export const SANS_LIMITE = 30;
/** Plafond d'un minimum venu du brief ou d'un ancien onglet. */
const PLAFOND_DU_MINIMUM = 12;

export type OrigineDesBornes = 'utilisateur' | 'brief' | 'defaut';
export interface Bornes { min: number; max: number; origine: OrigineDesBornes }

export function bornesAffichees(
  brief: { min: number | null; max: number | null },
  reglage: { minLength?: number; maxLength?: number } = {},
): Bornes {
  const borne = (n: number) => Math.min(Math.max(Math.round(n), PLANCHER_DE_LONGUEUR), PLAFOND_DU_MINIMUM);
  const maxParDefaut = (min: number) => Math.max(MAXIMUM_PAR_DEFAUT, min + 2);

  if (typeof reglage.maxLength === 'number') {
    const max = Math.max(Math.round(reglage.maxLength), PLANCHER_DE_LONGUEUR);
    const voulu = borne(Math.max(brief.min ?? PLANCHER_DE_LONGUEUR, reglage.minLength ?? PLANCHER_DE_LONGUEUR));
    return { min: voulu <= max ? voulu : PLANCHER_DE_LONGUEUR, max, origine: 'utilisateur' };
  }
  if (typeof reglage.minLength === 'number') {
    const min = borne(reglage.minLength);
    const max = brief.max !== null && brief.max >= min ? brief.max : maxParDefaut(min);
    return { min, max, origine: 'utilisateur' };
  }
  if (brief.min === null && brief.max === null) {
    return { min: PLANCHER_DE_LONGUEUR, max: MAXIMUM_PAR_DEFAUT, origine: 'defaut' };
  }
  const min = borne(brief.min ?? PLANCHER_DE_LONGUEUR);
  const max = brief.max !== null ? Math.max(brief.max, PLANCHER_DE_LONGUEUR) : maxParDefaut(min);
  return { min, max: Math.max(max, min), origine: 'brief' };
}
