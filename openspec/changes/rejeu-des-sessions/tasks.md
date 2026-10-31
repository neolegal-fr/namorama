# Tasks

## 1. Consentement : catégorie dédiée, retrait, mesure (web, logs)

- [x] 1.1 Dans `cookie-consent.ts`, ajouter la catégorie `replay` (désactivée par défaut), avec sa section de préférences en FR/EN : finalité, masquage des saisies, hébergement chez Namorama, conservation de 30 jours. Exposer `replayGranted`, un signal initialisé par `acceptedCategory('replay')` et mis à jour dans `onConsent`/`onChange`. Vérifier par un test unitaire (`cookie-consent.spec.ts`, bibliothèque simulée) : le signal passe à vrai à l'acceptation et à faux au retrait.
- [ ] 1.2 Ajouter au pied de page de `app.ts` (`:412-449`) un lien « Gérer les cookies » / « Manage cookies » qui appelle `CookieConsent.showPreferences()`, clés i18n dans `fr.json`/`en.json`. Vérifier au navigateur : le lien rouvre les préférences, et décocher la catégorie y est enregistré (cookie `cc_cookie` relu).
- [ ] 1.3 Émettre `consent_recorded` (`meta: { analytics, replay, origine }`) depuis `onConsent` et `onChange` via `AnalyticsService.track()`. Vérifier au navigateur, dans l'onglet réseau : un `POST /events` par choix, sans autre donnée.
- [x] 1.4 Ajouter à `scripts/analyze-logs.py` le mode `consentement` : répartition « tout accepté / audience seule / refusé », plus « sans réponse » (visites `page_viewed` sans `consent_recorded`). Vérifier en le jouant sur un NDJSON d'exemple qui contient les quatre cas, et ajouter la commande à la liste de CLAUDE.md (« Consulter les logs en prod »).

## 2. Capture dans le navigateur (web)

- [x] 2.1 Ajouter `rrweb@2.1.7` et `@rrweb/rrweb-plugin-console-record@2.1.7` (versions exactes) à `web/package.json`. Vérifier que `npm ci` passe et que `npm run build` ne fait pas grossir le bundle initial : comparer la taille de `main-*.js` avant et après, l'écart doit être nul ou négligeable.
- [x] 2.2 Créer `web/src/app/services/session-replay.ts`. Un `effect()` sur `replayGranted` démarre la capture par `import('rrweb')`, uniquement dans le navigateur, et l'arrête au retrait. Elle est suspendue sous `/admin` (`Router.events`) et ne démarre jamais si le jeton porte le rôle `admin`. Réglages de D4, plugin console au niveau `error`, message borné à 500 caractères. Vérifier par un test unitaire (rrweb simulé) : aucun `import` sans consentement, ni pour un admin ; arrêt au retrait ; suspension sous `/admin`.
- [x] 2.3 Envoi par lots (D5) : toutes les 10 s ou dès 200 événements, et au `pagehide` (`keepalive`). `segment` est tenu dans `sessionStorage` (`nm_replay_seg`), `seq` croît par segment. Un `413` ou un `429` arrête la capture, une erreur réseau abandonne le lot. Vérifier par test unitaire (fetch simulé) : découpage, numérotation, arrêt sur 413, aucune exception remontée.
- [ ] 2.4 Brancher le service dans `app.ts`, après `CookieConsentService.init()`. Vérifier au navigateur, page d'accueil puis wizard : sans consentement, aucune requête `/replay` et aucun chunk rrweb téléchargé ; après « Tout accepter », des requêtes `/replay` partent sans rechargement. Mesurer et noter sous la tâche la taille du premier lot (instantané complet).
- [x] 2.5 Vérifier que le prérendu n'embarque rien : `npm run build`, puis `grep -L rrweb` sur les HTML de `dist/` prérendus (`/guides/...`, `/privacy`). Aucun ne doit contenir rrweb.

## 3. Masquage des textes personnels (web)

- [x] 3.1 Poser `nm-prive` sur les textes affichés qui reprennent une saisie ou une adresse :
  - `wizard.html` : bannière propriétaire `:56`, description reformulée `:155`, puces de mots-clés `:224`, extrait de description `:710`, partagé par `:745`, destinataires `:811-819`, adresses des rapports `:970` et des partages `:1012` ;
  - `app.ts` : adresse du compte `:164` ;
  - `admin-users.component.ts` : `:104`, `:216`, `:278`.

  Les références de lignes sont celles du 31/10/2026, à relocaliser. Vérifier par un test (`masquage.spec.ts`) qui rend le wizard avec un projet et un partage non vides, et contrôle que chaque élément listé porte la classe.
  - Fait le 31/10/2026. `masquage.spec.ts` lit les gabarits eux-mêmes (`wizard.html` en texte, gabarits en ligne lus dans la source) plutôt que de rendre le wizard, qui demande une vingtaine de services. Il vérifie que chaque interpolation personnelle est sous `nm-prive`. Contre-épreuve faite : la classe retirée de la description reformulée fait échouer le test. Le rendu réel est vérifié en 3.2.
  - Écarts avec la liste prévue :
    - `admin-users` n'a pas reçu la classe : les pages `/admin` ne sont jamais enregistrées.
    - Les champs de saisie (`:970`, `:1012`, partage) sont déjà masqués par `maskAllInputs`.
    - Ajoutés en chemin : le prénom du menu de profil (`styleClass`), la description citée dans le rapport (`brand-report-view.ts`), et `nm-bloque` sur le bouton « retirer un partage », dont l'`aria-label` porte l'adresse (rrweb ne masque pas les attributs).
- [ ] 3.2 Rejouer en local une session complète (description, mots-clés, recherche, partage, fiche compte) avec le lecteur du groupe 5, des données non vides et une adresse de test. Vérifier, écran par écran, qu'aucune description, aucun mot-clé et aucune adresse n'est lisible, et que les noms de domaine le sont. Noter le résultat sous la tâche.
- [x] 3.3 Ajouter à CLAUDE.md, section « CSS / Styles », la règle : tout nouveau texte qui affiche une saisie de l'utilisateur ou une adresse porte `nm-prive`, les saisies étant déjà masquées. Vérifier que la classe citée est celle du code.

## 4. Réception et stockage (API, base)

- [x] 4.1 Écrire `api/migrations/2026-10-31-rejeu-des-sessions.sql` (date du jour d'implémentation). Table `session_replay_chunk` selon D6, `CREATE TABLE IF NOT EXISTS`, collation de `sessionId` alignée **dynamiquement** sur `visitor_session.sessionId` (comme `2026-08-24-journal-des-visites.sql`), en-tête avec la commande d'application et le retour arrière. Vérifier en l'appliquant deux fois sur la base locale : la seconde passe ne change rien.
- [x] 4.2 Créer le module `api/src/replay/` : entité, DTO (D7.1) et `ReplayController` `@Public() POST /replay`. Il vérifie l'existence de la visite, applique les plafonds par visite et par jour (D7.2-3), gzippe, insère en ignorant les doublons (`segment`, `seq`), et journalise `replay_capped` une fois par portée. Vérifier par `replay.controller.spec.ts` : visite inconnue → 4xx sans écriture ; plafond de visite → 413, un seul `replay_capped` ; plafond du jour → 429 ; doublon ignoré ; échec d'écriture → aucune exception remontée.
- [ ] 4.3 Dans `main.ts`, monter `json({ limit: '1mb' })` sur le seul chemin `/replay`, avant le parseur global. Vérifier par un test e2e ou `curl` local : un corps de 900 ko est accepté sur `/replay` et refusé (413) sur `/events`.
- [x] 4.4 Purge quotidienne de `receivedAt < NOW() - INTERVAL REPLAY_RETENTION_DAYS DAY`, au démarrage puis par `setInterval(24 h).unref()`, en best-effort (modèle `app-logger.service.ts:42-67`). Vérifier par test unitaire : une ligne de 31 jours est supprimée, une de 29 conservée.
- [x] 4.5 Ajouter `REPLAY_RETENTION_DAYS`, `REPLAY_MAX_SESSION_MB` et `REPLAY_MAX_DAY_MB` à `api/.env.example` avec leurs défauts (30, 5, 200). Lancer `cd api && npm test && npm run build` : tout passe.
- [x] 4.6 Ajouter à CLAUDE.md une section « Rejeu des sessions » (sous « Logs et observabilité ») : consentement dédié, masquage côté navigateur, trois plafonds et leur raison (route publique sans throttler), conservation, migration à appliquer avant l'image. Vérifier que les variables et la table citées existent dans le code.

## 5. Administration : liste et lecteur (API, web)

- [ ] 5.1 Ajouter `GET /admin/replays` et `GET /admin/replays/:sessionId` (D9), sous `@Roles({ roles: ['realm:admin'] })`. La liste joint `visitor_session` et écarte les comptes par `comptesMesures()`. Vérifier par test du service avec des lignes non vides : filtre `cherche_sans_compte`, exclusion d'un compte interne, tri par segment et seq, 404 sur une visite purgée. Vérifier aussi un 403 pour un jeton sans rôle admin.
- [ ] 5.2 Ajouter `rrweb-player@2.1.7` à `web/package.json`, chargé dynamiquement par la page admin seulement. Vérifier par `npm run build` qu'il n'apparaît que dans un chunk paresseux.
- [ ] 5.3 Créer `admin-replays.component.ts` et la route `/admin/replays` (`app.routes.ts:75-85`), avec son entrée dans le menu d'administration. La page propose un `p-table` avec filtres et un `p-dialog` plein écran contenant le lecteur : segments enchaînés, repères d'erreur sur la frise, message « enregistrement purgé ou absent » sur un 404. Respecter les styles en ligne pour la mise en page (CLAUDE.md). Vérifier au navigateur, avec au moins trois visites locales enregistrées dont une passée par Keycloak et une avec une erreur console provoquée : lecture complète, enchaînement des segments, repère d'erreur visible.
- [ ] 5.4 Dans `admin-users.component.ts`, ajouter sur chaque ligne une icône vers `/admin/replays?compte=<sub>`, désactivée sans visite enregistrée. Vérifier au navigateur avec une liste d'utilisateurs non vide (piège de la PR #120).

## 6. Politique de confidentialité (web)

- [ ] 6.1 Réécrire la section « 8. Cookies » de `privacy.component.ts` (FR `:88-90`, EN `:184-186`). Elle doit couvrir les cookies nécessaires, GA4 (catégorie analytique) et l'enregistrement de session : finalité, masquage, hébergement sur le serveur de Namorama, 30 jours, retrait par « Gérer les cookies ». Mettre à jour le tableau des cookies du bandeau (`cc_cookie`, `nm_sid` et `nm_replay_seg` en `sessionStorage`). Vérifier au navigateur sur `/privacy` en FR et en EN, et dans le HTML prérendu, qu'il ne reste plus « aucun traceur tiers ».

## 7. Intégration et livraison

- [ ] 7.1 Parcours de bout en bout en local : refuser ; puis accepter ; décrire, chercher, se connecter (aller-retour Keycloak), partager ; retirer le consentement ; rejouer dans l'administration. Vérifier que chaque scénario de `specs/rejeu-des-sessions/spec.md` est observé, et le noter sous la tâche.
- [ ] 7.2 Appliquer la migration de 4.1 sur la base de prod, sauvegarde `mysqldump` datée dans `backups/` d'abord. Vérifier par `SHOW CREATE TABLE session_replay_chunk` que la collation de `sessionId` est celle de `visitor_session`.
- [ ] 7.3 Ouvrir la PR, attendre la CI verte, fusionner, puis attendre le build de `main` et déployer (`docker compose pull api web && docker compose up -d api web`). Vérifier dans les logs de démarrage l'absence d'erreur du module `replay` et le passage de la première purge.

## Workflow follow-up

- Une semaine après le déploiement : `python3 - consentement` pour la part de visites qui acceptent l'enregistrement, et `SELECT COUNT(DISTINCT sessionId), SUM(bytes) FROM session_replay_chunk` pour le volume. Noter les deux chiffres ici, et la taille moyenne d'une visite, afin de décider s'il faut relever `REPLAY_MAX_SESSION_MB`.
- Regarder les visites « a cherché, pas de compte créé » et celles avec erreur. Noter ce que le rejeu a montré et que les logs ne disaient pas : c'est le critère de succès du changement.
- Vérifier `python3 - errors` : aucun `replay_capped { scope: 'day' }` hors abus.
- Archiver le changement, puis vérifier que `openspec/specs/rejeu-des-sessions/` a été créé et que `openspec validate --all` passe.
