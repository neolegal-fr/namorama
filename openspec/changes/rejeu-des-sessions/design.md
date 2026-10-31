# Design

## Context

Le pourquoi est dans proposal.md, les exigences dans `specs/rejeu-des-sessions/spec.md`.
Voici l'état actuel qui façonne l'approche.

- **Identifiant de visite** : `nm_sid` en `sessionStorage`, créé par
  `web/src/app/services/analytics.ts:36-44`. `POST /events` le reçoit, et `page_viewed`
  crée la ligne `visitor_session` (`api/src/events/events.controller.ts:43-65`,
  `FunnelService.visite()`). Le format est validé par `funnel.service.ts:30`
  (`/^[A-Za-z0-9_-]{8,64}$/`). Le rejeu s'y rattache : il hérite ainsi des drapeaux
  d'entonnoir et du rattachement au compte (`rattacher()`).
- **Consentement** : `vanilla-cookieconsent`, catégories `necessary` et `analytics`
  (`cookie-consent.ts:21-32`). Le choix ne vit que dans le cookie `cc_cookie`, et
  l'application n'a aucun moyen de le lire.
- **Application sans zone** (pas de `zone.js`, Angular 21) : les observateurs DOM de rrweb
  ne déclenchent aucune détection de changements, donc pas besoin de `runOutsideAngular`.
- **Routes publiques sans limite de débit** : ni `@nestjs/throttler`, ni limite de corps
  explicite. Express applique 100 ko par défaut, avec `rawBody: true` (`main.ts:9`).
- **Purge** : modèle existant dans `app-logger.service.ts:42-67`, une passe au démarrage
  puis `setInterval(24 h).unref()`, en best-effort. Le projet n'a pas de `@nestjs/schedule`.
- **Volume** : ~36 visites par jour. La part qui consentira est inconnue : c'est ce que
  mesure `consent_recorded`.

## Goals / Non-Goals

**Goals:**
- Aucun octet téléchargé ni envoyé sans consentement : le code d'enregistrement n'entre
  pas dans le bundle initial.
- Le masquage se fait **dans le navigateur**. Le serveur ne reçoit jamais une saisie en
  clair, même par erreur de configuration côté serveur.
- Un déploiement sans nouveau volume Docker ni nouveau service.

**Non-Goals:**
- Rejouer fidèlement les composants dessinés en canvas : l'application n'en a pas.
- Garder un enregistrement au-delà de la fermeture de l'onglet. Une visite, c'est un
  `nm_sid`, comme pour l'entonnoir.

## Decisions

### D1. rrweb en direct, plutôt que PostHog ou OpenReplay auto-hébergés

On utilise `rrweb` (capture), `@rrweb/rrweb-plugin-console-record` et `rrweb-player`
(lecteur), **en 2.1.7, version exacte**. La 2.2.0 date du 24/10/2026 : on y passera une
fois qu'elle aura deux semaines, après relecture du changelog.

- *Rejeté : PostHog ou OpenReplay auto-hébergés.* Chacun demande ClickHouse et Kafka, ou
  une pile Kubernetes, avec 8 à 16 Go de RAM dédiés. C'est démesuré pour 36 visites par
  jour, et une pile de plus à maintenir et sauvegarder.
- *Rejeté : PostHog Cloud UE.* Gratuit à ce volume, mais avec un sous-traitant et des
  données hors du serveur : c'est ce que l'utilisateur a écarté.

### D2. Une catégorie de consentement dédiée, plutôt que la catégorie `analytics`

On ajoute une catégorie `replay`, désactivée par défaut, avec sa propre description.

- *Rejeté : réutiliser `analytics`.* Le consentement doit être spécifique. Accepter « Google
  Analytics, pages consultées » ne vaut pas accord pour enregistrer ses gestes à l'écran.
  Une seule case ferait aussi accepter le rejeu à qui ne voulait que GA, ou l'inverse.

On ajoute une API d'application : `CookieConsentService.replayGranted`, un signal alimenté
par `onConsent`/`onChange` et initialisé par `acceptedCategory('replay')`. Le service
d'enregistrement le suit par un `effect()`, qui démarre ou arrête la capture.

Le retrait passe par le lien « Gérer les cookies » du pied de page, qui appelle
`CookieConsent.showPreferences()`.

### D3. Chargement à la demande

`import('rrweb')` ne s'exécute qu'une fois le signal vrai, dans le navigateur
(`isPlatformBrowser`).

- *Rejeté : import statique.* Il alourdirait le bundle initial pour tous, y compris pour
  ceux qui refusent et pour les pages prérendues, et pèserait sur les budgets du build.

### D4. Ce qui est masqué, et comment

Réglages de capture :

- `maskAllInputs: true` ;
- `maskTextClass: 'nm-prive'` : classe posée sur la description reformulée, les puces de
  mots-clés, l'extrait de description des projets et toutes les adresses e-mail affichées
  (bannière propriétaire, partages, fiche compte, utilisateurs admin). Les références
  sont dans tasks.md, groupe 3 ;
- `blockClass: 'nm-bloque'`, réservé à ce qui ne doit même pas montrer sa forme. Aucun
  usage n'est prévu pour l'instant ;
- `recordCanvas: false`, `collectFonts: false`, `inlineImages: false` ;
- `sampling` : `mousemove` à 50 ms et `scroll` à 150 ms, pour contenir la taille.

Les noms de domaine générés **restent lisibles** : ce sont des sorties du service, et sans
eux le rejeu ne dit rien.

- *Rejeté : masquer tout le texte (`maskAllText`).* Le rejeu deviendrait une suite de
  rectangles. On ne verrait plus quel message d'erreur s'affiche, ni quel nom a été cliqué,
  alors que c'est la raison d'être de l'outil.

### D5. Lots envoyés par `fetch`, sans balise ni WebSocket

On envoie un lot toutes les 10 s, ou dès 200 événements, et au `pagehide` par
`fetch(..., { keepalive: true })`. Corps :

```json
{ "sessionId": "...", "segment": 0, "seq": 3, "events": [ ... ] }
```

- `segment` s'incrémente à chaque nouveau démarrage dans la même visite : retour de
  Keycloak, rechargement ou consentement donné de nouveau. On le garde dans
  `sessionStorage` (`nm_replay_seg`).
- *Rejeté : `sendBeacon`.* Plafonné à ~64 ko, alors que le premier instantané complet du
  DOM pèse davantage.
- *Rejeté : WebSocket.* Une connexion à tenir derrière nginx pour un gain de latence
  inutile : on relit après coup.
- Un `413` ou un `429` **arrête l'enregistrement** pour la visite. Une erreur réseau fait
  abandonner le lot sans réessai (best-effort, comme `track()`).

### D6. Stockage : une table de lots compressés en base, plutôt que des fichiers

Table `session_replay_chunk` :

- `id` ;
- `sessionId` varchar(64), indexé, collation alignée sur `visitor_session.sessionId`
  (voir le piège des collations dans CLAUDE.md) ;
- `segment`, `seq` ;
- `firstTs` et `lastTs`, l'horodatage rrweb en millisecondes ;
- `eventCount` ;
- `hasError` (bool, posé si un événement du plugin console est de niveau `error`) ;
- `href`, l'URL de la première vue, chemin seul sans requête ;
- `bytes`, la taille compressée ;
- `data` MEDIUMBLOB, le JSON gzippé côté serveur ;
- `receivedAt` datetime, indexé pour la purge.

Contrainte d'unicité sur (`sessionId`, `segment`, `seq`) : un lot renvoyé est ignoré.

- *Rejeté : fichiers sous un volume, sur le modèle de `LOG_DIR`.* Il faudrait un volume de
  plus dans le `docker-compose.yml` de prod, qui n'est pas versionné et se modifie à la
  main, et la jointure avec `visitor_session` se ferait en mémoire. La base est déjà
  sauvegardée et requêtable.
- *Accepté en contrepartie* : les `mysqldump` grossissent du volume conservé, à mesurer en
  suivi de production.

### D7. `POST /replay` : public, borné en trois couches

La route est `@Public()` : la plupart des visiteurs n'ont pas de compte.

1. **Par requête** : `json({ limit: '1mb' })` monté **sur ce seul chemin** dans `main.ts`.
   Les 100 ko par défaut restent en vigueur partout ailleurs. Le DTO valide le format de
   `sessionId`, `segment` ≤ 50, `seq` ≤ 5 000, et `events` en tableau non vide d'au plus
   5 000 éléments.
2. **Par visite** : l'identifiant doit exister dans `visitor_session`, et la somme des
   `bytes` doit rester sous `REPLAY_MAX_SESSION_MB` (5 Mo par défaut). Au-delà : `413` et
   `replay_capped { scope: 'session' }`, journalisé une fois par visite. Un cache mémoire
   des totaux évite un `SUM` par lot.
3. **Par jour** : un compteur mémoire des octets acceptés depuis minuit (heure de Paris),
   rechargé depuis la base au démarrage. Au-delà de `REPLAY_MAX_DAY_MB` (200 Mo par
   défaut) : `429` et `replay_capped { scope: 'day' }`, au plus une fois par jour.

Aucune réponse ne renvoie de contenu, et toute erreur d'écriture est avalée (`204` ou
refus) : un rejeu ne doit jamais faire échouer l'application.

- *Rejeté : poser `@nestjs/throttler` ici.* C'est le bon outil, mais pour toutes les routes
  publiques à la fois. Le CLAUDE.md le tient pour un chantier à part. Le plafond quotidien
  borne le coût dans l'intervalle : au pire, 200 Mo par jour, purgés à 30 jours.

### D8. Exclusions : décidées par le navigateur, vérifiées par la liste

Le navigateur ne démarre pas l'enregistrement si le jeton Keycloak porte le rôle `admin`,
et il le suspend sous `/admin`. Les comptes **internes** ne se reconnaissent pas côté
navigateur, et le drapeau peut être coché après coup : la liste admin les écarte par
`comptesMesures()` (`api/src/admin/predicats.ts`), joint par `visitor_session.keycloakId`.

- *Rejeté : refuser côté serveur les lots des comptes internes.* Le lot ne porte pas de
  jeton (route publique, comme `/events`), et un compte coché interne après coup garderait
  ses lots de toute façon.

### D9. Administration

- **`GET /admin/replays?filtre=&page=`** renvoie une ligne par visite enregistrée :
  - début, durée (`max(lastTs) - min(firstTs)`), nombre de segments, taille, `hasError`,
    chemin d'entrée ;
  - les drapeaux de `visitor_session` et l'âge du compte rattaché ;
  - filtres : `cherche_sans_compte`, `erreur`, `tarifs_vus`, `rapport`.
- **`GET /admin/replays/:sessionId`** renvoie les événements de tous les lots, décompressés
  et triés par (`segment`, `seq`), en un tableau par segment. Il répond `404` si rien
  n'existe, et l'interface affiche « enregistrement purgé ou absent ».
- La protection vient de `@Roles({ roles: ['realm:admin'] })`, comme
  `admin.controller.ts:97-98`.
- **Page `/admin/replays`** : un `p-table`, avec le lecteur dans un `p-dialog` plein écran.
  `rrweb-player` est chargé dynamiquement à l'ouverture, avec sa CSS. Les segments
  s'enchaînent : à la fin de l'un, le suivant se charge. La frise marque les événements
  console d'erreur (`tags`/`insertStyleRules` du lecteur, ou des repères calculés).
- **Raccourci** : sur la ligne d'un utilisateur dans Administration → Utilisateurs, une
  icône mène aux visites de ce compte (`?compte=`).

### D10. `consent_recorded`

Émis par `onConsent` et `onChange` via `AnalyticsService.track()`, avec
`meta: { analytics: bool, replay: bool, origine: 'premier' | 'modification' }`. `onConsent` revient à chaque
chargement de page : on mesure donc `onFirstConsent` et `onChange`, pas `onConsent`. C'est le
canal anonyme habituel, sans cookie. Il est nécessaire pour mesurer la portée de l'outil
lui-même. Le résumé `python3 - consentement` affiche la répartition : accepté tout,
audience seule, refusé, et « sans réponse » (visites `page_viewed` sans `consent_recorded`).

**Contrats ajoutés** :
- `POST /replay` ;
- `GET /admin/replays` et `GET /admin/replays/:sessionId` ;
- les événements `consent_recorded` et `replay_capped` ;
- trois variables d'environnement.

Aucun contrat existant ne change. La parité des requêtes OpenAI et les événements SSE ne
sont pas concernés.

## Risks / Trade-offs

- **[Un champ personnel oublié dans le masquage]** → Toutes les saisies sont masquées par
  défaut, donc seul le texte **affiché** est à risque. Un test unitaire vérifie la présence
  de `nm-prive` sur chaque élément de la liste du groupe 3. Avant le déploiement, on rejoue
  une session locale complète et on relit chaque écran.
- **[Peu de consentements, donc peu de sessions]** → C'est le biais déjà connu de GA.
  `consent_recorded` le chiffre en une semaine. S'il est trop faible, la réponse est un
  texte de bandeau plus clair, pas un enregistrement sans accord.
- **[Instantané initial lourd (PrimeNG, styles en ligne)]** → On le mesure en local au
  groupe 2. Si un lot dépasse 1 Mo, l'instantané est découpé (ou on passe `slimDOMOptions`)
  avant tout relèvement de la limite.
- **[Le lecteur ne restitue pas les styles PrimeNG]** → rrweb capture les feuilles de style
  en ligne. On vérifie au navigateur, avec des données non vides, que les cartes de
  résultats et les dialogues sont fidèles.
- **[Bas débit chez le visiteur]** → Lots asynchrones, sans réessai, abandonnés en cas
  d'échec. L'interface n'attend jamais l'envoi.
- **[Remplissage de la base par un tiers]** → Plafond quotidien et purge à 30 jours :
  6 Go au pire, très en deçà du disque. Une alerte `replay_capped { scope: 'day' }`
  remonte dans `python3 - errors`.

## Migration Plan

1. Appliquer `api/migrations/2026-10-31-rejeu-des-sessions.sql` (création de table
   idempotente). Retour arrière : `DROP TABLE session_replay_chunk`.
2. Déployer l'image. Le rejeu reste inactif tant que personne n'a accepté la nouvelle
   catégorie.
3. Rollback : redéployer l'image précédente. La table est inerte, on la garde ou on la
   supprime.

## Open Questions

- Le format de date d'effet de la purge : `receivedAt` du lot, ou début de la visite ?
  On part sur `receivedAt` (spec : « après leur réception »). Une visite à cheval sur la
  limite perd ses premiers lots un jour avant les derniers, ce qui est sans effet pratique.
- La taille moyenne d'une visite enregistrée, qui décidera s'il faut relever
  `REPLAY_MAX_SESSION_MB`. Elle se mesure en suivi de production.
