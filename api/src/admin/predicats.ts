/**
 * Fragments SQL partagés par les services du tableau de bord.
 *
 * Ils vivent ici plutôt que dans `AdminService` pour que le relevé des coûts du
 * modèle (`ModelCostsService`) s'en serve sans importer `AdminService` — qui,
 * lui, importe le relevé : un cycle d'import laisserait l'un des deux
 * `undefined` au moment où Nest lit les dépendances.
 */

/**
 * Les comptes retenus dans les statistiques : ni admin, ni interne.
 * Voir `AdminService.comptesMesures` pour l'histoire de cette règle unique.
 */
export function comptesMesures(alias = 'u'): string {
  return `${alias}.isAdmin = false AND ${alias}.isInternal = false`;
}

/**
 * Semaine ISO en SQL : `WEEKDAY()` vaut 0 le lundi, on recule d'autant.
 * `DATE_FORMAT` plutôt que le type DATE brut — le pilote rendrait sinon un
 * objet Date dont le fuseau dépend de la connexion, là où on veut une clé.
 */
export const semaineSql = (col: string): string =>
  `DATE_FORMAT(DATE_SUB(DATE(${col}), INTERVAL WEEKDAY(${col}) DAY), '%Y-%m-%d')`;

/** `AAAA-MM-JJ` dans le fuseau du serveur — celui où les dates sont stockées. */
export function jourISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine contenant `d` (semaine ISO, comme `WEEKDAY()` en SQL). */
export function lundiDe(d: Date): Date {
  const j = new Date(d);
  j.setHours(0, 0, 0, 0);
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return j;
}
