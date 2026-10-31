# Tasks

## 1. Registre des paiements (API, base)

- [x] 1.1 Écrire `api/migrations/2026-10-31-registre-des-paiements.sql` : `CREATE TABLE IF NOT EXISTS paiement` (colonnes de design D2, `sessionId` unique, index sur `keycloakId` et `payeLe`), collation de `keycloakId` alignée dynamiquement sur `user.keycloakId` comme `2026-08-24-journal-des-visites.sql`, commande d'application et `DROP TABLE` de retour arrière en en-tête. Vérifier en l'appliquant deux fois sur la base locale : la seconde passe ne fait rien, et `SHOW CREATE TABLE paiement` montre la même collation que `user.keycloakId`.
  - Vérifié le 31/10/2026 en local : deux passes sans erreur, `paiement.keycloakId` en `utf8mb4_unicode_ci` comme `user`, index unique sur `sessionId`.
- [x] 1.2 Créer l'entité `Paiement` (`api/src/payments/entities/paiement.entity.ts`) et une méthode `enregistrerPaiement(session)` dans `PaymentsService` : écriture seulement si `payment_status === 'paid'`, `INSERT IGNORE` sur `sessionId`, montant `amount_total`, devise, date `created`, et en cas d'échec `logger.error` `payment_record_failed` avec le seul `sessionId`. Vérifier par un nouveau `payments.service.spec.ts` (Stripe et dépôt simulés) : session payée → une ligne ; session `complete` non payée → aucune ligne ; dépôt qui lève → erreur journalisée et pas d'exception.
- [x] 1.3 Appeler `enregistrerPaiement` dans `fulfillSession` et `handleWebhook`, après `addExtraCredits`. Vérifier dans le même spec : retour navigateur puis webhook de la même session → `addExtraCredits` appelé une fois, une seule écriture ; un échec d'écriture n'empêche pas l'ajout des crédits.
- [x] 1.4 Écrire `api/src/scripts/rattraper-paiements.ts` (D3) : parcourt `stripe_event`, relit chaque session, appelle `enregistrerPaiement`, journalise `livemode`, n'appelle jamais `addExtraCredits`. Vérifier par test unitaire (Stripe simulé, deux sessions) : deux écritures, zéro crédit ajouté, et une seconde exécution sans nouvelle ligne ; puis `cd api && npm run build` produit `dist/scripts/rattraper-paiements.js`.
- [x] 1.5 Ajouter à `CLAUDE.md` une section « Registre des paiements » (table, double chemin, `payment_status`, `payment_record_failed`, commande de rattrapage), et noter dans « Système de crédits » que le webhook crédite sans vérifier `payment_status`. Vérifier que la commande citée correspond au chemin compilé de 1.4.

## 2. Indicateurs de période (API, `GET /admin/stats`)

- [x] 2.1 Ajouter à `metriquesPeriode` le bloc `engagement` : jours d'activité, tranches 1 / 2-3 / 4+, nouveaux / récurrents parmi les actifs (création dans la période ou avant), comptes à plusieurs projets, projets de comptes actifs. Extraire le calcul des tranches et du DAU moyen en fonctions pures. Vérifier par un nouveau `indicateurs-periode.spec.ts` : 52 comptes et 63 jours sur 30 jours → DAU 2,1 et DAU/MAU 4 % ; période de 7 jours → DAU/MAU `null`.
- [x] 2.2 Ajouter le bloc `succes` : projets créés dans la période, projets portant au moins un `liked`, comptes ayant noté, retours écrits (`feedback.createdAt`, non rejetés), avec `comptesMesures()` partout. Vérifier par test du calcul de taux : 8 sur 52 → 15,4 % ; 1 sur 3 → `null` (socle 5) ; puis en local, une requête SQL de contrôle écrite à la main rend les mêmes nombres que la réponse de `/admin/stats`.
  - Vérifié le 31/10/2026 sur la base locale peuplée (`seed-dash-*`, avec un compte interne), `getStats(month=2026-10)` appelé dans un contexte Nest : 12 actifs, 19 jours, 10 nouveaux, 13 projets dont 4 réussis par 9 comptes, 2 multi-projets, 2 retours — identiques à la requête de contrôle prise au même instant.
- [x] 2.3 Ajouter le bloc `revenu` depuis `paiement` : montants par devise et nombre de paiements de la période, payants de la période, payants depuis l'origine, comptes mesurés ; parcours tarifs → paiements lancés → paiements aboutis. Vérifier en local avec deux lignes `paiement` insérées à la main (dont une d'un compte interne) : seule l'autre compte.
  - Vérifié : 9,90 € et 2 990 centimes insérés, le second pour le compte interne ; la réponse porte 1 paiement, 990 centimes EUR, 1 payant, `payingUsersEver` 1. Le parcours d'achat réutilise `funnel.pricingViewed` / `checkoutStarted` et `revenu.paiements`.
- [x] 2.4 Accepter la période « mois civil » (`from`/`to` aux bornes du mois, heure de Paris) et comparer au mois civil précédent ; refuser une fenêtre inférieure à 1 jour. Retirer de la réponse les moyennes par projet et les stocks de crédits. Vérifier par test : `2026-09` → du 01/09 00:00 au 30/09 23:59:59, précédent = août entier.
- [x] 2.5 Lancer `cd api && npm test && npm run build` : tout passe.
  - 31 suites, 292 tests ; build sans erreur.

## 3. Rétention et séries mensuelles (API)

- [x] 3.1 Dans `RetentionService`, écrire une fonction pure `decomposer(activites, comptes)` qui classe chaque mois en nouveaux / retenus / réactivés / perdus et construit le triangle de cohortes M+1…M+5 (mois en cours marqué incomplet, mois futurs absents) ; supprimer durée de vie et jours actifs. Vérifier dans `retention.service.spec.ts` sur le cas d'octobre : 51 nouveaux, 1 retenu, 0 réactivé, 39 perdus ; août (début du journal le 23) sans retenus ni perdus.
- [x] 3.2 Remplacer `getSeries(weeks)` par `getSeries(months)` (D7) : actifs décomposés, inscrits, revenu par devise, coût IA total via `cout-sql.ts` (`null` avant le relevé) ; route `GET /admin/series?months=` bornée à 1–24. Vérifier par test du contrôleur que `months=30` est ramené à 24, puis en local que la somme des inscrits mensuels égale le nombre de comptes mesurés créés sur la même fenêtre.
  - Vérifié le 31/10/2026 (`admin.controller.spec.ts` : 30 → 24, 0 → 1). Base locale peuplée : 13 inscrits sur 12 mois = 13 comptes mesurés ; octobre 12 actifs (10 nouveaux, 2 retenus, 1 perdu), 9,90 €, coût IA 0,557 $ ; septembre marqué partiel pour le coût (relevé local commencé le 22).
- [x] 3.3 Mettre à jour la section « Tableau de bord d'administration » de `CLAUDE.md` : définitions (MAU, DAU/MAU, taux de succès, décomposition, cohortes), indicateurs retirés et pourquoi (dont le 👍/👎 à 3,8 % du 31/10/2026), granularité mensuelle. Vérifier que chaque indicateur décrit existe dans la réponse de `/admin/stats` ou `/admin/series`.
- [x] 3.4 Lancer `cd api && npm test && npm run build` : tout passe.
  - 32 suites, 300 tests ; build sans erreur.

## 4. Période partagée et onglet Coûts IA (web)

- [x] 4.1 Créer `admin-periode.component.ts` (7 jours, 30 jours par défaut, mois civil, personnalisé) qui lit et écrit la période dans l'URL (D9). Vérifier au navigateur : choisir « septembre 2026 » donne `?periode=2026-09`, et un rechargement garde le choix.
  - Vérifié le 31/10/2026 (Chrome piloté par Playwright, front 4205 / API 3005 sur la base locale peuplée) : « septembre 2026 » → `?periode=2026-09`, rechargement → toujours septembre, « comparés à août 2026 ».
- [x] 4.2 Créer la route `/admin/costs` (garde admin) et l'entrée « Coûts IA » du menu (`app.ts:497`), qui affiche `admin-model-costs` avec le sélecteur de 4.1 ; retirer ce composant du tableau de bord. Vérifier au navigateur, sur des données de coût non vides : le relevé et le simulateur s'affichent dans l'onglet, la période suit le lien depuis le tableau de bord, et un compte non admin est redirigé.
  - Vérifié : `/admin/costs?periode=2026-09` atteint par « Détail des coûts → », relevé par opération et simulateur affichés ; sans session, `/admin/costs` renvoie à l'accueil sans rien afficher (même garde que tout `/admin`).
- [x] 4.3 Lancer `cd web && npm run build` : il passe, budgets compris.
  - Build de production sans erreur ; seul avertissement : budget CSS de `wizard.css` (16,47 kB pour 16 kB), antérieur à ce changement et hors de son périmètre.

## 5. Tableau de bord refondu (web)

- [x] 5.1 Remplacer `admin-weekly-chart` par `admin-serie-chart` au mois (mois en cours estompé, exclu des moyennes, barre empilée pour la décomposition des actifs). Vérifier au navigateur sur 12 mois avec données : octobre est estompé et la décomposition se lit par couleur avec légende.
  - Écart au plan : le composant est GÉNÉRALISÉ (`admin-serie-chart`, entrée `pas` = `semaine` | `mois`) plutôt que remplacé — le détail des coûts et la fiche d'un utilisateur restent à la semaine. La barre empilée des actifs vit dans le bloc Rétention (couleurs, légende, tableau des valeurs) pour ne pas montrer deux fois la même série ; l'historique porte inscrits, CA et coût IA. Vérifié : octobre estompé, « max » formaté.
- [x] 5.2 Réécrire `admin-dashboard.component.ts` en cinq blocs : bandeau (MAU avec nouveaux / récurrents, inscrits, activation, chiffre d'affaires, taux de succès), Engagement, Satisfaction, Monétisation, Coût résumé, puis l'historique ; supprimer les cartes retirées par la proposition. Vérifier au navigateur sur la base locale peuplée : chaque carte de la spec affiche une valeur ou « — » avec sa raison, « Tarifs consultés » n'apparaît que dans la monétisation, et aucun pourcentage de 👍.
  - Vérifié sur la base locale peuplée : MAU 12 (10 nouveaux · 2 récurrents), activation 80 %, CA 9,90 €, succès 27,8 % ; « tarif » absent avant la monétisation, aucun pourcentage de 👍, aucune erreur console. Corrigé en passant : badge d'écart vide rendu « – » (le `display` du badge écrasait `[hidden]`, déjà le cas avant), pluriel « nouveaux », décimale à la française.
- [x] 5.3 Réécrire `admin-retention.component.ts` : décomposition mensuelle et triangle de cohortes, retours sous 7 et 30 jours conservés. Vérifier au navigateur : le mois en cours est estompé dans le triangle, les mois futurs sont vides.
  - Vérifié : cohorte de septembre, M+1 (octobre, en cours) estompé, M+2 à M+5 vides ; retours sous 7 jours 30 % (3 sur 10).
- [x] 5.4 Passer à 390 px de large : aucun défilement horizontal de page (le triangle défile dans sa carte). Vérifier dans les outils de développement du navigateur.
  - Vérifié à 390 px : `scrollWidth` 390 = `innerWidth` 390 ; le triangle défile dans sa carte.
- [x] 5.5 Lancer `cd web && npm run build` : il passe, budgets compris.
  - Idem 4.3.

## 6. Vérification d'ensemble et déploiement

- [x] 6.1 En local, avec une copie anonymisée des agrégats ou la base de développement peuplée, comparer chaque carte du bandeau aux requêtes de contrôle de 2.2 et 2.3 : écart nul.
  - Vérifié le 31/10/2026, octobre, mesures prises au même instant (la base locale est partagée avec d'autres sessions et bougeait) : API = contrôle sur actifs 11 / 18 jours / 9 nouveaux, projets 12 dont 4 réussis par 8 comptes, 2 multi, 2 retours, 1 paiement 990 c, 9 inscrits, 12 comptes. Le bandeau rend ces champs sans recalcul (vérifié au navigateur en 5.2).
- [ ] 6.2 Appliquer en production la migration de 1.1, après sauvegarde datée dans `backups/`. Vérifier `SHOW CREATE TABLE paiement`.
- [ ] 6.3 Déployer l'image (après le build GitHub Actions), puis lancer le rattrapage de 1.4 deux fois dans le conteneur. Vérifier : 2 lignes dans `paiement` (ou 0 si les sessions de mars sont en mode test, noté ici), soldes de crédits inchangés.

## Workflow follow-up

- Après déploiement, ouvrir le tableau de bord en prod sur « 30 jours » et vérifier contre des requêtes en lecture seule : MAU ≈ 52 dont 1 récurrent, taux de succès ≈ 8 sur 52 (valeurs du 31/10/2026, à réactualiser).
- Au premier achat de pack réel, vérifier qu'une ligne `paiement` apparaît avec le bon montant et qu'aucun `payment_record_failed` n'est journalisé (`python3 - errors`).
- Archiver le changement une fois ces relevés notés ici, puis vérifier `openspec/specs/` et `openspec validate --all`.
