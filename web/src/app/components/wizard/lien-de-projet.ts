/**
 * Ce que devient un lien vers un projet : `/projects/:id`.
 *
 * Jusqu'au 12/11/2026, un échec du chargement laissait un wizard vide, sans un
 * mot. Le 10/11, un visiteur sans session arrivé sur un projet a pris un 401 et
 * il est reparti sans rien faire. Chantier `lien-de-projet-sans-session`.
 *
 * - `connexion` : pas de session. On l'envoie se connecter AVANT de demander le
 *   projet, et il revient sur la même adresse.
 * - `introuvable` : l'API répond 404, qu'il s'agisse d'un projet inexistant ou
 *   d'un projet qui ne lui est pas partagé — elle ne dit pas lequel, exprès
 *   (`projects.service.ts`), et le message non plus.
 * - `echec` : tout le reste (API indisponible, réseau). On reste sur l'adresse
 *   pour pouvoir réessayer.
 */
export type IssueDuLienDeProjet = 'charger' | 'connexion' | 'introuvable' | 'echec';

export function issueDuLienDeProjet(etat: { connecte: boolean; statut?: number }): IssueDuLienDeProjet {
  // Une session expirée en cours de route répond 401 : même remède que l'absence de session.
  if (!etat.connecte || etat.statut === 401) return 'connexion';
  if (etat.statut === undefined) return 'charger';
  if (etat.statut === 404) return 'introuvable';
  return 'echec';
}
