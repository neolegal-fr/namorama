import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Liens signés des demandes de retour (chantier `demande-de-retour-automatique`).
 *
 * Le clic « Oui », « Non » ou « Se désinscrire » agit sans connexion : le lien
 * porte le compte et l'action, signés par HMAC-SHA256 avec
 * `FEEDBACK_LINK_SECRET`. Trois champs, pas de JWT — une dépendance de plus
 * pour rien. Changer le secret invalide tous les liens émis, sans autre effet.
 */
export type ActionDeRetour = 'oui' | 'non' | 'desinscription';
const ACTIONS: readonly ActionDeRetour[] = ['oui', 'non', 'desinscription'];

/** 90 jours : le temps qu'un courriel reste lu, pas davantage. */
export const DUREE_DE_VIE_MS = 90 * 24 * 60 * 60 * 1000;

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const deB64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
const hmac = (secret: string, charge: string) => createHmac('sha256', secret).update(charge).digest('base64url');

export function signerLien(secret: string, keycloakId: string, action: ActionDeRetour, maintenant = Date.now()): string {
  if (!secret) throw new Error('FEEDBACK_LINK_SECRET absent : aucun lien de retour ne peut être signé');
  const charge = b64(`${keycloakId}.${action}.${maintenant + DUREE_DE_VIE_MS}`);
  return `${charge}.${hmac(secret, charge)}`;
}

/**
 * Le compte et l'action d'un lien, ou `null` s'il est altéré, expiré, ou si
 * aucun secret n'est configuré. Comparaison à temps constant.
 */
export function verifierLien(secret: string, jeton: unknown, maintenant = Date.now()): { keycloakId: string; action: ActionDeRetour } | null {
  if (!secret || typeof jeton !== 'string' || jeton.length > 512) return null;
  const [charge, signature, ...reste] = jeton.split('.');
  if (!charge || !signature || reste.length) return null;
  const attendue = Buffer.from(hmac(secret, charge));
  const recue = Buffer.from(signature);
  if (attendue.length !== recue.length || !timingSafeEqual(attendue, recue)) return null;
  const champs = deB64(charge).split('.');
  // Un `sub` Keycloak est un UUID, sans point ; trois champs exactement.
  if (champs.length !== 3) return null;
  const [keycloakId, action, expiration] = champs;
  if (!keycloakId || !ACTIONS.includes(action as ActionDeRetour)) return null;
  if (!(Number(expiration) > maintenant)) return null;
  return { keycloakId, action: action as ActionDeRetour };
}
