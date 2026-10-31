# Proposal

## Why

Les logs disent **où** un visiteur s'arrête, jamais **ce qu'il a vu**. Sur les 30 jours au
31/10/2026 (`python3 - funnel`, 14 627 lignes) :

- **100 recherches sur 313 (32 %) refusées avant de démarrer**, toutes sur le même motif
  (« Chaque mot-clé ne peut pas dépasser 100 caractères »). Le journal a compté ces refus,
  mais il ne pouvait pas montrer que l'écran restait muet : il a fallu reconstituer le
  parcours après coup (correctif `fa45dd7`). Rejouée, la première session aurait montré le
  clic sur « Rechercher » qui ne produit rien.
- **21 sessions sur 87** entrées dans le wizard ne sont pas allées jusqu'à la recherche, et
  **68 redirections vers la connexion** avant une recherche. Aucun événement ne dit si c'est
  de l'hésitation, une incompréhension ou un blocage.
- **11 `client_error`** et 4 `client_unhandled_rejection` : la pile est journalisée, mais pas
  l'action qui l'a déclenchée.

Le volume rend l'observation directe possible. Avec ~36 `page_viewed` par jour (1 075 sur
30 jours), on peut **regarder chaque visite** qui s'arrête, pas seulement un échantillon.
Les outils du marché ne conviennent pas. Microsoft Clarity envoie les données chez un
tiers. PostHog et OpenReplay auto-hébergés demandent chacun une machine dédiée, au-delà
de ce que fait tourner `namorama-prod`. La bibliothèque sous-jacente, **rrweb** (MIT),
suffit à condition de lui adjoindre un stockage et un lecteur. C'est l'objet de ce
changement.

Deux constats de code conditionnent le périmètre :

- **Le consentement ne se retire pas.** `vanilla-cookieconsent` n'a qu'une catégorie
  `analytics` (GA4), dans `web/src/app/services/cookie-consent.ts:21-32`. Aucun lien
  n'appelle `showPreferences()` : une fois le bandeau fermé, le choix devient définitif.
  Or l'enregistrement de session n'est pas exempté de consentement.
- **La politique de confidentialité contredit le bandeau.** Sa section « 8. Cookies »
  (`web/src/app/components/privacy/privacy.component.ts:88-90` et `:184-186`) affirme
  qu'aucun traceur tiers n'est utilisé, alors que GA4 est chargé
  (`web/src/index.html:78-90`). Ajouter un enregistrement sans corriger ce texte
  aggraverait l'écart.

## What Changes

- **Enregistrement côté navigateur**, uniquement après consentement explicite à une
  catégorie dédiée du bandeau (« Enregistrement de session », désactivée par défaut).
  rrweb est chargé à la demande : rien pour qui refuse, rien au prérendu.
  L'enregistrement s'interrompt dès que le consentement est retiré.
- **Masquage par défaut** : toutes les saisies (`maskAllInputs`), plus le texte des zones
  qui affichent une description, des mots-clés ou une adresse e-mail. Les pages
  `/admin` et les sessions des administrateurs ne sont pas enregistrées.
- **Les erreurs console** (niveau `error`) sont enregistrées dans la session, à la
  position où elles surviennent dans le parcours.
- **`POST /replay`** (public, comme `/events`) : reçoit des lots d'événements rattachés à
  l'identifiant de visite `nm_sid`, déjà connu de `visitor_session`. Le corps est borné
  par requête et par session, et un plafond global quotidien s'y ajoute : la route est
  ouverte à tous et n'a pas de limite de débit.
- **Stockage en base** : une table de lots compressés, jointe à `visitor_session`, purgée
  après `REPLAY_RETENTION_DAYS` (30 jours par défaut), comme les logs.
- **Administration → Sessions** (`/admin/replays`) :
  - la liste des visites enregistrées, avec leurs drapeaux d'entonnoir (recherche, compte
    créé, rapport, tarifs vus) et un filtre « erreur survenue » ;
  - un lecteur (`rrweb-player`) ;
  - les comptes de test sont écartés par `comptesMesures()`.
- **Mesure du consentement** : l'événement `consent_recorded` porte les catégories
  acceptées. La part des visites enregistrables devient connue au lieu d'être supposée.
- **Pied de page** : un lien « Gérer les cookies » rouvre les préférences.
- **Politique de confidentialité** : la section Cookies est réécrite. Elle décrit GA4 et
  l'enregistrement de session, le masquage, la durée de conservation et le retrait du
  consentement.

Hors périmètre :

- les cartes de chaleur et l'agrégation des clics entre sessions ;
- la détection automatique des « rage clicks » et des clics sans effet. On regarde
  d'abord, on automatisera si le volume le justifie ;
- l'enregistrement du réseau (requêtes, réponses) : les corps portent des descriptions et
  des jetons ;
- l'enregistrement sans consentement, y compris en version « réduite » ;
- la pose générale d'un `@nestjs/throttler` sur les routes publiques, qui reste un
  chantier distinct (CLAUDE.md) ;
- le remplacement de GA4 ou du canal `POST /events`. Le rejeu complète la mesure, il ne la
  remplace pas : il ne voit que ceux qui consentent.

## Capabilities

### New Capabilities

- `rejeu-des-sessions` : l'enregistrement consenti et masqué d'une visite, sa conservation
  bornée, et sa relecture par un administrateur. S'y ajoute le consentement qui le
  conditionne : catégorie dédiée, retrait possible, choix mesuré.

### Modified Capabilities

(aucune : `openspec/specs/` ne contient encore aucune capacité)

## Impact

- **Web** :
  - `cookie-consent.ts` : nouvelle catégorie, et un signal de consentement lisible par
    l'application ;
  - `analytics.ts` : `nm_sid` réutilisé ;
  - un nouveau service d'enregistrement, chargé dynamiquement ;
  - `wizard.html` et `app.ts` : classes de masquage ;
  - le pied de page ;
  - `privacy.component.ts` ;
  - une nouvelle page `admin-replays` et sa route.
  - Dépendances : `rrweb` et `@rrweb/rrweb-plugin-console-record` (capture),
    `rrweb-player` (administration seulement), en versions exactes.
- **API** :
  - nouveau module `replay` : contrôleur public, contrôleur admin et purge quotidienne ;
  - limite de corps dédiée à la route dans `main.ts` ;
  - variables `REPLAY_RETENTION_DAYS`, `REPLAY_MAX_SESSION_MB` et `REPLAY_MAX_DAY_MB`.
- **Base** : nouvelle table `session_replay_chunk`. Migration
  `api/migrations/2026-10-31-rejeu-des-sessions.sql`, à appliquer avant de déployer l'image.
  La taille des sauvegardes `mysqldump` augmente du volume conservé.
- **Contrats** :
  - nouvelle route publique `POST /replay` ;
  - nouvelles routes `GET /admin/replays` et `GET /admin/replays/:sessionId` ;
  - nouvel événement journalisé `consent_recorded`, plus `replay_capped` quand un plafond
    est atteint.
  - Aucun contrat existant ne change.
- **Prod** : le `docker-compose.yml`, non versionné, doit recevoir les nouvelles variables
  si l'on s'écarte des valeurs par défaut.
- **Juridique** : nouveau traitement à décrire dans la politique de confidentialité. Les
  données restent sur le serveur, sans sous-traitant.
