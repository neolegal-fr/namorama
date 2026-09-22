import { FREE_MONTHLY_QUOTA } from '../users/users.service';

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
 * Crédits gratuits RÉELLEMENT disponibles pour un compte, en SQL.
 *
 * `user.credits` n'est renouvelé qu'au premier passage du mois
 * (`renouvellementDu`) : un compte absent depuis le mois dernier y affiche
 * encore son solde d'alors, alors qu'il retrouvera 100 crédits en revenant.
 * Même règle qu'en TypeScript — solde renouvelé si la dernière remise à zéro
 * précède le 1er du mois courant — pour que l'administration montre ce que
 * l'utilisateur verra, et non ce que la base a retenu.
 *
 * Le 1er du mois est pris dans le fuseau de la BASE (`NOW()`), qui est aussi
 * celui de l'API depuis le 22/09/2026 (`TZ=Europe/Paris`).
 */
export function creditsGratuitsSql(alias = 'u'): string {
  return `(CASE WHEN ${alias}.lastFreeReset IS NULL OR ${alias}.lastFreeReset < DATE_FORMAT(NOW(), '%Y-%m-01')`
    + ` THEN ${FREE_MONTHLY_QUOTA} ELSE ${alias}.credits END)`;
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
