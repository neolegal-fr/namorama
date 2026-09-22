/**
 * Le coût d'un appel, calculé en SQL au moment de la lecture.
 *
 * Rien n'est figé en base : les tokens de `model_usage` sont multipliés par le
 * tarif de `model_price` EN VIGUEUR À LA DATE DE L'APPEL. Un changement de prix
 * s'ajoute en ligne, et ni le passé ni le présent n'ont à être réécrits.
 *
 * Alias réservés par ces fragments : `m` (l'appel), `v` (sa visite), `mp` (le
 * tarif du modèle), `wp` (le tarif de l'outil de recherche), `p` (dans les
 * sous-requêtes). L'appelant peut joindre `user u` par-dessus.
 */

/**
 * Le tarif de l'appel, et celui de ses recherches web.
 *
 * Le modèle du tarif est un PRÉFIXE du modèle de l'appel : l'API renvoie un
 * instantané daté (`gpt-5.6-luna-2026-07-01`), et un tarif par instantané
 * obligerait à ajouter une ligne à chaque mise à jour silencieuse d'OpenAI. Le
 * préfixe le plus long l'emporte, puis la date d'effet la plus récente.
 *
 * Une sous-requête scalaire dans le `ON`, plutôt qu'une fenêtre : MariaDB 10.6
 * l'accepte avec `LIMIT`, et le volume (quelques milliers d'appels par mois)
 * ne justifie rien de plus élaboré.
 */
export const TARIFS_DE_L_APPEL = `
  LEFT JOIN model_price mp ON mp.id = (
    SELECT p.id FROM model_price p
     WHERE p.model <> 'web_search'
       AND LEFT(m.model, CHAR_LENGTH(p.model)) = p.model
       AND p.effectiveFrom <= m.createdAt
     ORDER BY CHAR_LENGTH(p.model) DESC, p.effectiveFrom DESC
     LIMIT 1)
  LEFT JOIN model_price wp ON wp.id = (
    SELECT p.id FROM model_price p
     WHERE p.model = 'web_search' AND p.effectiveFrom <= m.createdAt
     ORDER BY p.effectiveFrom DESC
     LIMIT 1)`;

/**
 * Les appels et la visite qui les porte.
 *
 * La visite sert à rattacher un appel anonyme de l'étape 1 au compte que la
 * même session a ouvert ensuite (`visitor_session.keycloakId`).
 */
export const APPELS = `
  FROM model_usage m
  LEFT JOIN visitor_session v ON v.sessionId = m.sessionId
  ${TARIFS_DE_L_APPEL}`;

/** Le compte auquel revient l'appel : le compte débité, ou à défaut celui de la visite. */
export const COMPTE_DE_L_APPEL = 'COALESCE(m.keycloakId, v.keycloakId)';

/**
 * Coût en dollars d'un appel, ou `NULL` si un tarif manque.
 *
 * L'entrée INCLUT sa part en cache, la sortie son raisonnement : la part en
 * cache est retranchée du plein tarif et facturée au sien (à défaut, au plein
 * tarif — une surestimation plutôt qu'un oubli). Le raisonnement n'a pas de
 * tarif propre, il est déjà dans la sortie.
 *
 * `NULL` et non zéro : un modèle ajouté sans son tarif doit se voir « non
 * chiffré », pas passer pour gratuit.
 */
export const COUT_DE_L_APPEL = `
  CASE
    WHEN mp.id IS NULL OR (m.webSearchCalls > 0 AND wp.id IS NULL) THEN NULL
    ELSE ((m.inputTokens - m.cachedInputTokens) * mp.inputPerM
          + m.cachedInputTokens * COALESCE(mp.cachedInputPerM, mp.inputPerM)
          + m.outputTokens * mp.outputPerM) / 1000000
         + m.webSearchCalls * COALESCE(wp.perCall, 0)
  END`;
