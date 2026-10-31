# Tasks

## 1. Consentement : catégorie dédiée, retrait, mesure (web, logs)

- [x] 1.1 Dans `cookie-consent.ts`, ajouter la catégorie `replay` (désactivée par défaut), avec sa section de préférences en FR/EN : finalité, masquage des saisies, hébergement chez Namorama, conservation de 30 jours. Exposer `replayGranted`, un signal initialisé par `acceptedCategory('replay')` et mis à jour dans `onConsent`/`onChange`. Vérifier par un test unitaire (`cookie-consent.spec.ts`, bibliothèque simulée) : le signal passe à vrai à l'acceptation et à faux au retrait.
- [x] 1.2 Ajouter au pied de page de `app.ts` (`:412-449`) un lien « Gérer les cookies » / « Manage cookies » qui appelle `CookieConsent.showPreferences()`, clés i18n dans `fr.json`/`en.json`. Vérifier au navigateur : le lien rouvre les préférences, et décocher la catégorie y est enregistré (cookie `cc_cookie` relu).
  - Vérifié au navigateur (Playwright, front local) le 31/10/2026. Le lien ouvre les préférences, qui portent bien les trois catégories. Décocher « Enregistrement de session » puis « Enregistrer » émet `consent_recorded { replay: false, origine: 'modification' }`, et aucun envoi `/replay` ne part ensuite (15 s d'activité).
  - Piège de test : vanilla-cookieconsent ne s'exécute pas sous `navigator.webdriver` (`hideFromBots`), il faut le masquer dans les scripts Playwright.
- [x] 1.3 Émettre `consent_recorded` (`meta: { analytics, replay, origine }`) depuis `onConsent` et `onChange` via `AnalyticsService.track()`. Vérifier au navigateur, dans l'onglet réseau : un `POST /events` par choix, sans autre donnée.
  - Émis depuis `onFirstConsent` et `onChange`, pas depuis `onConsent`, qui revient à chaque chargement de page. `origine` vaut `premier` ou `modification`.
  - Vérifié au navigateur : un seul `POST /events` par choix, sans autre donnée, dans trois cas :
    - refus → `{analytics:false, replay:false}` ;
    - audience seule → `{analytics:true, replay:false}` ;
    - tout accepter puis retrait → deux événements.
- [x] 1.4 Ajouter à `scripts/analyze-logs.py` le mode `consentement` : répartition « tout accepté / audience seule / refusé », plus « sans réponse » (visites `page_viewed` sans `consent_recorded`). Vérifier en le jouant sur un NDJSON d'exemple qui contient les quatre cas, et ajouter la commande à la liste de CLAUDE.md (« Consulter les logs en prod »).

## 2. Capture dans le navigateur (web)

- [x] 2.1 Ajouter `rrweb@2.1.7` et `@rrweb/rrweb-plugin-console-record@2.1.7` (versions exactes) à `web/package.json`. Vérifier que `npm ci` passe et que `npm run build` ne fait pas grossir le bundle initial : comparer la taille de `main-*.js` avant et après, l'écart doit être nul ou négligeable.
- [x] 2.2 Créer `web/src/app/services/session-replay.ts`. Un `effect()` sur `replayGranted` démarre la capture par `import('rrweb')`, uniquement dans le navigateur, et l'arrête au retrait. Elle est suspendue sous `/admin` (`Router.events`) et ne démarre jamais si le jeton porte le rôle `admin`. Réglages de D4, plugin console au niveau `error`, message borné à 500 caractères. Vérifier par un test unitaire (rrweb simulé) : aucun `import` sans consentement, ni pour un admin ; arrêt au retrait ; suspension sous `/admin`.
- [x] 2.3 Envoi par lots (D5) : toutes les 10 s ou dès 200 événements, et au `pagehide` (`keepalive`). `segment` est tenu dans `sessionStorage` (`nm_replay_seg`), `seq` croît par segment. Un `413` ou un `429` arrête la capture, une erreur réseau abandonne le lot. Vérifier par test unitaire (fetch simulé) : découpage, numérotation, arrêt sur 413, aucune exception remontée.
  - Révisé après mesure (2.4) :
    - l'intervalle passe à **3 s** ;
    - l'instantané complet part **sur-le-champ** ;
    - les lots partent en **`text/plain`**, requête « simple » sans `OPTIONS` préalable ;
    - on envoie aussi au `visibilitychange`.

    Testé dans `session-replay.spec.ts`.
- [x] 2.4 Brancher le service dans `app.ts`, après `CookieConsentService.init()`. Vérifier au navigateur, page d'accueil puis wizard : sans consentement, aucune requête `/replay` et aucun chunk rrweb téléchargé ; après « Tout accepter », des requêtes `/replay` partent sans rechargement. Mesurer et noter sous la tâche la taille du premier lot (instantané complet).
  - Branché après la lecture du rôle admin, et non juste après `init()` : avant, un administrateur aurait été enregistré le temps que Keycloak réponde.
  - Vérifié au navigateur le 31/10/2026 :
    - refus ou audience seule → 0 requête `/replay`, chunk rrweb jamais téléchargé ;
    - « Tout accepter » sur l'accueil → premier lot envoyé sans rechargement.
  - **Premier lot : 700 à 920 ko de JSON** (instantané avec feuilles de style), **75 à 95 ko compressés**. Une visite complète (accueil, wizard, Keycloak, résultats, partage) fait environ 280 ko compressés.
  - Deux défauts corrigés ensuite :
    1. **Le parcours avant Keycloak était perdu.** L'instantané restait dans le tampon à 10 s. Trop gros pour `keepalive` (64 ko), il était annulé par la navigation.
    2. **Le lot de fermeture se perdait une fois sur deux.** Il attendait son `OPTIONS` CORS.

    Après correction, deux passages ont reçu tous leurs lots (10/10 et 11/11).
  - Limite de corps relevée de 1 à 4 Mo : à 920 ko, un instantané plus chargé aurait été refusé, et un seul refus arrête toute la visite.
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
- [x] 3.2 Rejouer en local une session complète (description, mots-clés, recherche, partage, fiche compte) avec le lecteur du groupe 5, des données non vides et une adresse de test. Vérifier, écran par écran, qu'aucune description, aucun mot-clé et aucune adresse n'est lisible, et que les noms de domaine le sont. Noter le résultat sous la tâche.
  - Vérifié le 31/10/2026 de deux façons :
    - **Contrôle mécanique** : tous les lots stockés d'une visite sont décompressés, et l'on y cherche les chaînes repères en clair (description, mot-clé tapé, adresse et prénom du compte, adresse tapée dans le partage).
    - **Contrôle visuel** : le lecteur, mis en pause à plusieurs instants.
  - **Fuite trouvée et corrigée.** La puce PrimeNG d'un mot-clé recopie son libellé dans `aria-label`, et rrweb ne masque pas les attributs : le mot-clé tapé partait en clair. Correctif : `masquage-attributs.ts` masque les attributs textuels des nœuds sous `nm-prive` (instantané, ajouts, modifications), testé par `masquage-attributs.spec.ts`.
  - Au dernier passage (11 lots) :
    - aucune des cinq chaînes repères n'apparaît ;
    - les deux saisies sont rendues en étoiles ;
    - les 16 puces de mots-clés sont masquées au rejeu ;
    - les noms de domaine proposés restent lisibles (28) ;
    - l'extrait de description du tiroir « Mes projets » est absent des lots.
  - La « fiche compte » n'existe qu'en bas d'écran mobile : elle est couverte par le test statique (3.1), pas par ce parcours en 1280 px.
- [x] 3.3 Ajouter à CLAUDE.md, section « CSS / Styles », la règle : tout nouveau texte qui affiche une saisie de l'utilisateur ou une adresse porte `nm-prive`, les saisies étant déjà masquées. Vérifier que la classe citée est celle du code.

## 4. Réception et stockage (API, base)

- [x] 4.1 Écrire `api/migrations/2026-10-31-rejeu-des-sessions.sql` (date du jour d'implémentation). Table `session_replay_chunk` selon D6, `CREATE TABLE IF NOT EXISTS`, collation de `sessionId` alignée **dynamiquement** sur `visitor_session.sessionId` (comme `2026-08-24-journal-des-visites.sql`), en-tête avec la commande d'application et le retour arrière. Vérifier en l'appliquant deux fois sur la base locale : la seconde passe ne change rien.
- [x] 4.2 Créer le module `api/src/replay/` : entité, DTO (D7.1) et `ReplayController` `@Public() POST /replay`. Il vérifie l'existence de la visite, applique les plafonds par visite et par jour (D7.2-3), gzippe, insère en ignorant les doublons (`segment`, `seq`), et journalise `replay_capped` une fois par portée. Vérifier par `replay.controller.spec.ts` : visite inconnue → 4xx sans écriture ; plafond de visite → 413, un seul `replay_capped` ; plafond du jour → 429 ; doublon ignoré ; échec d'écriture → aucune exception remontée.
- [x] 4.3 Dans `main.ts`, monter `json({ limit: '1mb' })` sur le seul chemin `/replay`, avant le parseur global. Vérifier par un test e2e ou `curl` local : un corps de 900 ko est accepté sur `/replay` et refusé (413) sur `/events`.
  - Vérifié le 31/10/2026 au `curl`, sur l'API locale :
    - 900 ko sur `/replay` → 204 ;
    - 900 ko sur `/events` → 413 ;
    - visite inconnue → 404 ;
    - `/admin/replays` sans jeton → 401.
  - Trois défauts trouvés ainsi et corrigés :
    1. **`json()` monté tel quel désactivait le parseur JSON de toute l'API.** Nest saute le sien s'il trouve une couche nommée `jsonParser`, et chaque `POST` arrivait vide. On l'enveloppe désormais dans `parseurDuRejeu()`, et `rejeu-corps.spec.ts` le vérifie.
    2. **Le `@Public()` maison n'est pas lu par la garde Keycloak.** `/replay` répondait 401. On utilise celui de `nest-keycloak-connect`, comme `/events`.
    3. **`AllExceptionsFilter` transformait les erreurs du parseur de corps en 500**, avec pile, et le navigateur ne s'arrête que sur un 4xx. Le filtre respecte maintenant le statut `http-errors` (`expose: true`), testé dans `http-exception.filter.spec.ts`. Cela touche toutes les routes : un corps illisible ou trop gros se journalise désormais en `warn` 4xx, et non plus en `error` 500.
- [x] 4.4 Purge quotidienne de `receivedAt < NOW() - INTERVAL REPLAY_RETENTION_DAYS DAY`, au démarrage puis par `setInterval(24 h).unref()`, en best-effort (modèle `app-logger.service.ts:42-67`). Vérifier par test unitaire : une ligne de 31 jours est supprimée, une de 29 conservée.
- [x] 4.5 Ajouter `REPLAY_RETENTION_DAYS`, `REPLAY_MAX_SESSION_MB` et `REPLAY_MAX_DAY_MB` à `api/.env.example` avec leurs défauts (30, 5, 200). Lancer `cd api && npm test && npm run build` : tout passe.
- [x] 4.6 Ajouter à CLAUDE.md une section « Rejeu des sessions » (sous « Logs et observabilité ») : consentement dédié, masquage côté navigateur, trois plafonds et leur raison (route publique sans throttler), conservation, migration à appliquer avant l'image. Vérifier que les variables et la table citées existent dans le code.

## 5. Administration : liste et lecteur (API, web)

- [x] 5.1 Ajouter `GET /admin/replays` et `GET /admin/replays/:sessionId` (D9), sous `@Roles({ roles: ['realm:admin'] })`. La liste joint `visitor_session` et écarte les comptes par `comptesMesures()`. Vérifier par test du service avec des lignes non vides : filtre `cherche_sans_compte`, exclusion d'un compte interne, tri par segment et seq, 404 sur une visite purgée. Vérifier aussi un 403 pour un jeton sans rôle admin.
  - Le SQL de la liste n'est pas simulable de façon probante. Il a été vérifié **contre MariaDB locale**, avec 6 visites réelles enregistrées :
    - « A cherché, sans compte » → 4 ;
    - « Erreur » → 3 ;
    - compte coché interne → la liste passe de 6 à 1 (drapeau remis à 0 ensuite) ;
    - visite purgée entre liste et lecture → « Enregistrement purgé ou absent. ».
  - Le tri par segment et seq et le 404 sont aussi couverts par `replay.service.spec.ts`.
  - Jeton sans rôle admin : 403 sur `/admin/replays` et sur `/admin/replays/comptes`.
  - Ajouté : `GET /admin/replays/comptes`, pour le raccourci de 5.4.
- [x] 5.2 Ajouter `rrweb-player@2.1.7` à `web/package.json`, chargé dynamiquement par la page admin seulement. Vérifier par `npm run build` qu'il n'apparaît que dans un chunk paresseux.
  - Le lecteur est un chunk paresseux de 48,5 ko compressés. Sa CSS est un bundle à part, non injecté (`angular.json`), chargé à l'ouverture.
  - Piège : `ng serve` ne prend un nouveau bundle de style qu'au redémarrage.
- [x] 5.3 Créer `admin-replays.component.ts` et la route `/admin/replays` (`app.routes.ts:75-85`), avec son entrée dans le menu d'administration. La page propose un `p-table` avec filtres et un `p-dialog` plein écran contenant le lecteur : segments enchaînés, repères d'erreur sur la frise, message « enregistrement purgé ou absent » sur un 404. Respecter les styles en ligne pour la mise en page (CLAUDE.md). Vérifier au navigateur, avec au moins trois visites locales enregistrées dont une passée par Keycloak et une avec une erreur console provoquée : lecture complète, enchaînement des segments, repère d'erreur visible.
  - Vérifié au navigateur sur 6 visites, dont 4 passées par Keycloak et 3 avec une erreur provoquée :
    - les trois segments d'une visite s'enchaînent dans un seul lecteur (`skipInactive` saute l'aller-retour Keycloak) ;
    - le repère d'erreur apparaît en rouge sur la frise, et l'erreur listée sous le lecteur y mène ;
    - l'administrateur n'émet aucune requête `/replay`.
- [x] 5.4 Dans `admin-users.component.ts`, ajouter sur chaque ligne une icône vers `/admin/replays?compte=<sub>`, désactivée sans visite enregistrée. Vérifier au navigateur avec une liste d'utilisateurs non vide (piège de la PR #120).
  - Vérifié sur une liste de 5 utilisateurs : l'icône est active pour le seul compte qui a des visites. Elle ouvre `/admin/replays?compte=…`, qui affiche ses 5 visites.

## 6. Politique de confidentialité (web)

- [x] 6.1 Réécrire la section « 8. Cookies » de `privacy.component.ts` (FR `:88-90`, EN `:184-186`). Elle doit couvrir les cookies nécessaires, GA4 (catégorie analytique) et l'enregistrement de session : finalité, masquage, hébergement sur le serveur de Namorama, 30 jours, retrait par « Gérer les cookies ». Mettre à jour le tableau des cookies du bandeau (`cc_cookie`, `nm_sid` et `nm_replay_seg` en `sessionStorage`). Vérifier au navigateur sur `/privacy` en FR et en EN, et dans le HTML prérendu, qu'il ne reste plus « aucun traceur tiers ».
  - Vérifié au navigateur en FR et en EN, et dans `dist/…/privacy/index.html` prérendu :
    - l'ancienne phrase a disparu ;
    - la section cite les deux catégories facultatives, les 30 jours et « Gérer les cookies ».
  - Date de mise à jour passée à octobre 2026. Tableaux du bandeau complétés (`cc_cookie`, `nm_sid`, `nm_replay_seg`).

## 7. Intégration et livraison

- [x] 7.1 Parcours de bout en bout en local : refuser ; puis accepter ; décrire, chercher, se connecter (aller-retour Keycloak), partager ; retirer le consentement ; rejouer dans l'administration. Vérifier que chaque scénario de `specs/rejeu-des-sessions/spec.md` est observé, et le noter sous la tâche.
  - Joué au navigateur le 31/10/2026, sur le front et l'API du worktree, Keycloak et MariaDB locaux, avec de vrais appels au modèle. Scénario par scénario de la spec :
    - **Consentement**
      - Refus → aucun `/replay`, rrweb non téléchargé.
      - Tout accepter → démarrage sans rechargement.
      - Audience seule → GA consenti, aucun enregistrement.
      - Page prérendue → sans rrweb (2.5).
    - **Retrait** → plus aucun envoi.
    - **Mesure** → `consent_recorded` à chaque choix. Le cas « sans réponse » est vérifié sur NDJSON (1.4).
    - **Masquage**
      - Saisies (description, adresse de partage) → étoiles.
      - Textes personnels (puces, extrait de description) → masqués.
      - Noms de domaine → lisibles.
    - **Exclusions** → l'administrateur n'émet aucun `/replay`. La suspension sous `/admin` est couverte par le test unitaire : un visiteur non admin y est renvoyé à l'accueil par la garde.
    - **Erreur console** → repérée sur la frise.
    - **Réception**
      - Visite inconnue → 404.
      - Plafonds de visite et de jour → `replay.service.spec.ts`.
      - Retour de Keycloak → segment suivant, même visite.
    - **Conservation** → purge testée en unitaire.
    - **Administration**
      - Liste, filtres, compte interne exclu, 403.
      - Rejeu complet.
      - Visite purgée → message.
    - **Confidentialité** → 6.1.
- [x] 7.2 Appliquer la migration de 4.1 sur la base de prod, sauvegarde `mysqldump` datée dans `backups/` d'abord. Vérifier par `SHOW CREATE TABLE session_replay_chunk` que la collation de `sessionId` est celle de `visitor_session`.
  - Fait le 31/10/2026 à 11 h 00.
  - Sauvegarde : `backups/namorama-2026-10-31-1059-avant-rejeu-des-sessions.sql.gz` (1,4 Mo, dump complet).
  - `sessionId` est en `utf8mb4_general_ci`, comme `visitor_session.sessionId`. L'index unique (`sessionId`, `segment`, `seq`) et l'index `receivedAt` sont en place.
- [ ] 7.3 Ouvrir la PR, attendre la CI verte, fusionner, puis attendre le build de `main` et déployer (`docker compose pull api web && docker compose up -d api web`). Vérifier dans les logs de démarrage l'absence d'erreur du module `replay` et le passage de la première purge.

## Workflow follow-up

- Une semaine après le déploiement : `python3 - consentement` pour la part de visites qui acceptent l'enregistrement, et `SELECT COUNT(DISTINCT sessionId), SUM(bytes) FROM session_replay_chunk` pour le volume. Noter les deux chiffres ici, et la taille moyenne d'une visite, afin de décider s'il faut relever `REPLAY_MAX_SESSION_MB`.
- Regarder les visites « a cherché, pas de compte créé » et celles avec erreur. Noter ce que le rejeu a montré et que les logs ne disaient pas : c'est le critère de succès du changement.
- Vérifier `python3 - errors` : aucun `replay_capped { scope: 'day' }` hors abus.
- Archiver le changement, puis vérifier que `openspec/specs/rejeu-des-sessions/` a été créé et que `openspec validate --all` passe.
