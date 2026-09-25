# Namespoter

SaaS pour trouver des noms de marque et domaines disponibles à partir d'une description produit, via IA + vérification de disponibilité réelle (RDAP, repli WHOIS).

## Stack

- **Frontend** : Angular 21, PrimeNG 21 (Aura theme), Tailwind CSS 4
- **Backend** : NestJS, TypeORM, MariaDB 10.6
- **Auth** : Keycloak SSO (realm `namorama`, auto-importé depuis `infra/keycloak/realm-export.json`)
- **IA** : OpenAI GPT-5.6 — voir « Coût des appels au modèle »
- **Infra** : Docker Compose (`infra/docker-compose.yml`), orchestration via `justfile`

## Commandes

- `just start` : lance Docker + API + Web en dev
- `just stop` : arrête tout
- `just build` : compile API + Web
- `just clean` : supprime node_modules, dist, volumes Docker
- `just dev-api-url` : sous WSL, pointe `config.json` sur l'IP de la distribution
  et **masque le fichier du diff** (`--skip-worktree`). Le navigateur Windows
  n'atteint pas le `localhost` de WSL ; cette IP change à chaque redémarrage et
  n'a rien à faire dans le dépôt. `just dev-api-url-reset` réarme le suivi.

## Architecture

```
web/src/
├── app/
│   ├── app.ts                  # Composant racine (menubar, routing, dialog crédits)
│   ├── app.config.ts           # Providers Angular (Keycloak, i18n, PrimeNG)
│   ├── app.routes.ts           # Routes (/ et /projects/:id)
│   ├── components/wizard/      # Wizard 3 étapes (Description → Mots-clés → Domaines)
│   └── services/               # domain.ts, project.ts, user.ts
├── styles.css                  # Tailwind + styles globaux
└── index.html
api/src/
├── domain/                     # Recherche domaines, disponibilité (rdap.service.ts + repli whois)
├── projects/                   # CRUD projets
├── users/                      # Crédits, profil
└── common/                     # Guards, DTOs, utilitaires
```

## Conventions importantes

### CSS / Styles
- **PrimeNG écrase les classes Tailwind** dans ses composants (Card, Table, Drawer, Dialog, etc.). Utiliser des **inline styles** pour les propriétés de layout critiques (`display`, `flex-direction`, `align-items`, `justify-content`, `gap`, `text-align`, `margin`, `max-width`).
- Tailwind reste utilisable pour les éléments hors PrimeNG et pour les propriétés décoratives.
- Les hover effects nécessitent des classes CSS dans `styles.css` (pas d'inline styles possibles).

### Angular
- Composants standalone avec **signals** (`signal()`, `.set()`, `.update()`)
- **Ce qui coûte un appel au modèle se déclenche à la visibilité, pas au chargement.**
  L'analyse d'un nom partait pour toute la liste dès la fin d'une recherche : sur les
  sept jours suivant le 05/09/2026, `POST /domain/analyze` pesait **69 % des appels au
  modèle et 61,5 % du temps passé dedans**, loin devant la recherche elle-même — un
  compte a enchaîné neuf recherches en trois minutes et demie, soit 90 analyses pour une
  liste survolée. `VisibleOnceDirective` déclenche désormais au moment où la carte
  approche de l'écran ; une carte qu'on regarde porte toujours ses étoiles, une carte
  qu'on n'atteint pas ne coûte rien.
- **Ce qui se déclenche carte par carte s'envoie en un seul appel.** La visibilité a
  moins mordu qu'espéré — dix résultats tiennent à l'écran, donc 10,3 analyses par
  recherche avant le correctif et 8,1 après. Les identifiants dus sont regroupés
  pendant `REGROUPEMENT_MS` (250 ms) puis partent en **un lot** vers `/domain/analyze` :
  la consigne et le barème ne dépendent pas du nom, un lot de dix les paie une fois au
  lieu de dix. Un clic explicite sur « Analyser » court-circuite le regroupement — on
  ne fait pas attendre quelqu'un qui vient de demander.
- Services utilisent RxJS Observables (convention suffixe `$`)
- i18n : FR/EN via `@ngx-translate`, fichiers dans `web/public/assets/i18n/`
- Auth Keycloak avec bearer token via interceptor HTTP

### Une seule horloge : l'heure de Paris

La base date elle-même, à l'heure de Paris, tout ce qui passe par `CURRENT_TIMESTAMP`
ou `NOW()` (`createdAt` des comptes, projets, rapports ; visites). L'API date le reste
avec `new Date()`, que le pilote sérialise **dans le fuseau du processus**. Jusqu'au
22/09/2026, le conteneur n'avait pas de `TZ` : ces dates-là étaient en UTC, et 66
comptes sur 79 avaient une dernière activité antérieure à leur création. La fenêtre
« 24h » du tableau de bord perdait aussi ses deux dernières heures.

- L'image de l'API pose `ENV TZ=Europe/Paris`. Node embarque les fuseaux (ICU), pas
  besoin de `tzdata`.
- `HorlogeService` compare les deux horloges au démarrage et journalise une erreur si
  elles divergent : une date fausse reste plausible, rien d'autre ne le signalerait.
- En développement, le processus hérite du fuseau du poste : il doit être celui de la
  base locale.
- Les valeurs écrites en UTC avant la bascule ont été ramenées à l'heure de Paris par
  `2026-09-22-une-seule-horloge.sql`, sauf `user_activity_day`, qui ne garde que le
  jour : une activité de 0 h à 2 h avant cette date peut y figurer la veille.

### Schéma de base de données

`synchronize` est un **opt-in explicite** (`DB_SYNCHRONIZE=true`), pas un défaut. Non
définie, la variable vaut « non » : la production ne synchronise donc jamais.

Le garde ne peut pas reposer sur `NODE_ENV` — il n'est défini nulle part dans ce projet,
donc un test `NODE_ENV !== 'production'` laisserait la synchronisation active en prod,
c'est-à-dire précisément là où elle est dangereuse.

> Conséquence : **un changement d'entité ne se propage plus tout seul en production.**
> Toute colonne ajoutée ou retypée demande un `ALTER` appliqué à la main, ou une
> migration TypeORM. Ne jamais « débloquer » un déploiement en activant
> `DB_SYNCHRONIZE` sur le serveur : la base y porte des comptes et des paiements, et la
> synchronisation supprime ou retype des colonnes sans relecture.

Les scripts SQL à appliquer vivent dans `api/migrations/`, datés, idempotents
(`ADD COLUMN IF NOT EXISTS`), avec la commande d'application et le retour arrière en
en-tête. **Ordre impératif : appliquer le SQL avant de déployer l'image qui en dépend.**

### Tarification du rapport de marque

Une règle, une seule : **un rapport coûte `BRAND_REPORT_COST` crédits**. Les 100 crédits
offerts chaque mois couvrent environ 50 suggestions de domaines et un rapport — de quoi
essayer le produit sans mécanique supplémentaire à expliquer.

Le **rapport offert mensuel a été retiré** (20/08/2026). Il demandait une comptabilité
parallèle : période de référence, horodatage de consommation, verrou pessimiste pour
éviter qu'une double requête n'obtienne deux gratuités, coût réel mémorisé sur chaque
enregistrement, et un champ `freeThisMonth` que le front devait interroger avant
d'afficher un prix. Tout cela pour un avantage que le solde mensuel accordait déjà.

Ce qui subsiste et reste utile :

- `brand_report_record.costCredits` porte le débit **réel** — 0 sur une actualisation,
  déjà payée une fois. L'historique reste juste après un changement de tarif.
- Les colonnes `user.freeReportPeriod` et `user.freeReportUsedAt` ont été **supprimées** :
  elles n'avaient jamais été déployées en production, la migration qui les créait a donc
  simplement été amputée plutôt que compensée par un `ALTER … DROP`.
- `GET /brand-report/offer?name=` décrit l'offre sans verdict : `deepReport.purchased`,
  `priceCredits`, `account.credits`.
- La confirmation avant débit est **inconditionnelle** : 50 crédits, la moitié de la
  réserve mensuelle, partent en un clic.

### Système de crédits
- 1 suggestion de domaine = 1 crédit
- Crédits initiaux : 100
- **Renouvellement mensuel paresseux** : le quota de 100 s'écrit au **premier appel
  authentifié du mois** (`renouvellementDu`), pas le 1er à minuit. Un compte absent
  depuis le mois dernier garde en base son solde d'alors — relevé le 22/09/2026 : 46
  comptes sur 79 sous 100, tous absents en septembre. L'utilisateur n'y perd rien ;
  l'administration, elle, lit le solde **disponible** (`creditsGratuitsSql`) et marque
  d'un ↻ les comptes dont le renouvellement reste à écrire.
- Vérification de disponibilité : **RDAP d'abord, WHOIS en repli**

### Coût des appels au modèle

Un crédit se paie en euros. Relevé sur les 30 jours au 16/09/2026 — 142 recherches,
37 comptes actifs — la facture OpenAI tenait à **trois postes sur neuf appels** :
l'analyse des noms (64 %), le repérage du marché (18 %), la génération de noms (17 %).
Tout le reste pesait 1 %.

**Trois modèles, trois rôles.** Les identifiants sont configurables ; les valeurs par
défaut sont dans `api/.env.example`.

| variable | usage | tarif (in / out par M) |
|---|---|---|
| `OPENAI_MODEL` | reformulation, mots-clés, contraintes, nom de projet | luna — 0,20 $ / 1,20 $ |
| `OPENAI_MODEL_CREATIVE` | génération de noms, pick-best, repérage du marché | terra — 2,00 $ / 12,00 $ |
| `OPENAI_MODEL_ANALYSIS` | notation des noms. **Non définie ⇒ `OPENAI_MODEL`** | luna |

Trois règles, chacune tirée d'une dépense qu'on a vraiment payée :

- **Ce qui ne dépend pas de l'entrée se paie une fois.** La consigne de notation pèse
  ~165 tokens et ne change pas d'un nom à l'autre : la payer par nom, c'était acheter
  dix fois la même chose. `analyzeNames` groupe, `ANALYSES_PAR_APPEL` borne le lot — et
  le borne parce que la **sortie** l'est : au-delà du budget, le modèle tronque son
  JSON, et un JSON tronqué ne rend pas un nom de moins, il ne rend rien.
- **Le rattachement d'une note à son nom ne se devine jamais.** La réponse est
  rapprochée par le nom recopié, à la casse près, et rien d'autre. Pas de repli sur la
  position dans la liste : il donnerait à un nom les qualités d'un autre, le panneau
  s'afficherait quand même, et l'erreur serait invisible — tout en étant facturée.
- **Un appel outillé ne se déclenche pas tout seul.** `web_search` coûte **10 $ les
  mille appels** *en plus* du contenu web facturé au tarif du modèle. Mesuré le
  24/09/2026 : un repérage fait ~3 recherches et ramène **~25 000 tokens d'entrée**,
  soit **~0,09 $ l'appel** sur terra — ce sont les tokens, plus que les frais d'outil,
  qui pèsent — contre 0,0008 $ pour un appel luna ordinaire. Aucun réglage de modèle ne réduit des
  frais d'outil — le seul levier est de ne pas appeler. Le repérage du marché attend
  donc son bouton, et son résultat est mis en cache 24 h par description
  (`COMPETITORS_CACHE_TTL_MS`).

> **`reasoning_effort` est facturé en sortie.** Un raisonnement à `low` sur terra
> doublait le coût d'une notation à barème fixe. Tous les appels sont à `none`, sauf
> `pickBestDomain` (il compare dix candidats) et le repérage du marché, à `low` : c'est
> le modèle qui décide d'appeler `web_search`, et sans raisonnement il s'en dispense —
> on paierait un appel outillé qui ne cherche rien.

#### Relevé de consommation : des tokens, jamais des montants

Chaque appel au modèle écrit une ligne dans `model_usage` (depuis le 22/09/2026) :
entrée, part en cache, sortie, part de raisonnement, appels `web_search`, opération,
modèle, compte, session. Le **coût n'est jamais stocké** : il se calcule à la lecture,
tokens × tarif de `model_price` **en vigueur à la date de l'appel** (`cout-sql.ts`).

- **Changer un tarif = ajouter un tarif daté**, depuis l'écran **Administration → Tarifs
  IA** (`/admin/prices`), jamais modifier l'existant : le passé garde son prix. Une date
  d'effet passée recalcule les appels qu'elle couvre (l'écran le signale). La
  suppression ne sert qu'à corriger une saisie. Tarifs vérifiés le 22/09/2026 sur
  [la page tarifs d'OpenAI](https://developers.openai.com/api/docs/pricing) ; le tarif
  « long contexte » (> 272k tokens d'entrée) n'est pas modélisé, nos appels en sont loin. Le modèle d'un tarif est un **préfixe** (`gpt-5.6-luna` couvre
  l'instantané daté que l'API renvoie). Un modèle sans tarif est « non chiffré » —
  signalé au tableau de bord, jamais compté à zéro.
- **Tout appel passe par `ModelUsageService.mesurer(operation, appel)`**. Un appel OpenAI
  ajouté sans cette enveloppe est une dépense invisible. Un appel servi par un cache n'en
  écrit pas : il n'a rien coûté.
- **Imputation** : le compte du jeton, ou le **payeur** désigné par `imputer()` (le
  propriétaire d'un projet partagé, comme pour les crédits). Le contexte suit la requête
  par `AsyncLocalStorage`, ouvert par un **intercepteur** et non un middleware — posé
  avant `body-parser`, un middleware perd le contexte dès la lecture du corps.
- Les routes `@Public()` n'ont pas de compte : l'appel porte la session, rattachée au
  compte par `visitor_session.keycloakId`. Ce qui n'est jamais rattaché s'affiche à part,
  « visiteurs sans compte ».
- **Projection** : le simulateur du tableau de bord applique le tarif courant d'un autre
  modèle aux mêmes tokens. Juste à `reasoning_effort: none` ; ordre de grandeur pour
  `pick_best` et `competitors`, dont le raisonnement dépend du modèle.

> Contrôle de complétude : une fois par mois, comparer le total du tableau de bord à la
> facture OpenAI. Un écart de plus de quelques pour cent signale un appel non enveloppé.

> **Les cinq endpoints de l'étape 1 sont `@Public()`**, sans crédit ni limite de débit.
> Toute dépense qu'on y branche est une dépense que n'importe qui peut déclencher en
> boucle. C'est la raison d'être du plafond `ANALYZE_BATCH_MAX` et du bornage du cache
> marché — et il reste à poser un `@nestjs/throttler` sur ces routes.

### Disponibilité des domaines

La disponibilité a **trois états** : libre, pris, et **non vérifiable** (`null`). Le troisième n'est pas un raffinement : sans lui, une panne de registre se déguise en verdict — c'est ainsi que `.app` a été déclaré pris pendant des semaines (serveur port 43 retiré), et que `.de`, `.it`, `.ch`, `.nl` ont été déclarés libres alors qu'ils étaient pris (aucun motif reconnu ⇒ ancien repli « libre »).

- **Pré-filtre DNS** avant tout appel de registre : un domaine qui a des serveurs de
  noms est enregistré — la délégation vient de la zone du registre, on n'y figure pas
  autrement. Verdict en ~20 ms au lieu de 300 à 1 300. La réciproque est fausse (un
  domaine déposé mais non configuré n'a pas de NS), donc l'absence de délégation ne
  conclut rien et retourne au registre : **le pré-filtre ne produit jamais un
  « libre »**. Un nom témoin aléatoire est testé une fois par extension : si le registre
  y répond (joker de zone), le pré-filtre est désactivé pour cette extension, sans quoi
  tout y paraîtrait pris. `search_completed` porte `viaDns` / `viaRegistre` — s'il tombe
  à zéro sur une extension, c'est que le registre a changé de comportement.
- **RDAP** (`RdapService`) est la source primaire des appels restants : le verdict est un code HTTP — **404 = libre, 200 = pris** — au lieu d'un texte à interpréter registre par registre. Serveur découvert via l'annuaire IANA (`data.iana.org/rdap/dns.json`), mis en cache 24 h, rechargement retenté au plus une fois par minute en cas de panne.
- **WHOIS** reste le repli pour les TLD sans serveur RDAP déclaré — les ccTLD n'y sont pas obligés (`.de`, `.it`, `.be`, `.at`, `.io`, `.co`, `.jp`…). `readWhois()` normalise les alignements (espaces, tabulations, points de conduite) avant de chercher les motifs.
- Ce qu'aucune des deux sources ne couvre reste `null` : `.es` (aucun serveur WHOIS), `.ch` (le registre refuse nos requêtes), et ponctuellement `.nl`/`.hu`/`.shop` (quota dépassé). L'interface affiche « ? », et `search_completed` porte un décompte `unresolved` par extension.
- Le mode « toutes les extensions » ne porte que sur celles réellement vérifiées : un registre en panne ne doit pas vider une recherche.

> **Le RDAP de l'AFNIC ralentit avec le volume** : mesuré depuis la production, 12
> domaines `.fr` à quatre requêtes parallèles passent de 1,2 s au premier essai à 15,6 s
> au troisième, son limiteur se refermant au fil des requêtes. C'est ce qui rend le coût
> d'une recherche superlinéaire — 30 candidats en 21 s, 161 en 193 s. Le WHOIS de
> l'AFNIC, lui, reste stable à ~290 ms par domaine, et le DNS répond en 20 ms. Toute
> optimisation de la durée d'une recherche commence par là.

> Ne jamais faire retomber un doute sur `true` ou `false` : « pris » masque des noms libres, « libre » fait payer un crédit pour un domaine inachetable.

## Partage d'un projet

Un projet se partage **par adresse e-mail**, en lecture (défaut) ou en écriture,
avec un mot d'accompagnement facultatif.

- La cible est une **adresse**, pas un compte : on partage souvent avec quelqu'un
  qui n'en a pas encore. L'API provisionne alors le compte Keycloak et déclenche
  le courriel « définissez votre mot de passe ». Conséquence à connaître :
  **changer l'adresse d'un compte lui fait perdre les partages reçus**.
- **Les crédits sont toujours débités au propriétaire du projet**, y compris quand
  c'est un collaborateur en écriture qui lance une recherche ou achète un rapport
  (décision produit du 21/08/2026). Le rapport acheté est rangé sous le compte du
  propriétaire — il l'a payé — et reste lisible par les invités *via le projet*.
- Un rapport n'est jamais retrouvé par son nom seul : le rapprochement passe par
  le `projectId`, sans quoi deviner un nom suffirait à lire le rapport d'un tiers.
- L'interface masque en lecture seule ce que le serveur refuse déjà (notation,
  réactualisation, achat) : proposer un bouton qui échouera est une façon de mentir.

### L'invité choisit son mot de passe — on ne provisionne rien

Une invitation envoie **un seul courriel**, et son bouton mène à l'écran adapté,
adresse pré-remplie : **inscription** si l'adresse n'a pas encore de compte,
**connexion** sinon (`?invite=<adresse>[&nouveau=1]`).

La première version créait le compte Keycloak d'office. C'était une erreur : un
compte créé ainsi **n'a pas de mot de passe**, si bien que la porte d'entrée
reposait sur un second courriel — celui de Keycloak, avec son lien signé. Deux
messages pour une invitation, une dépendance au SMTP du realm, un compte
fantôme par invitation sans suite, et surtout un invité qui tente de s'inscrire
et s'entend répondre que son adresse est déjà prise.

Il reste un appel à Keycloak, en lecture seule : savoir si le compte existe,
pour choisir l'écran. Il demande le rôle `realm-management` → `view-users` sur
le compte de service `namorama-api` ; `manage-users` reste nécessaire, mais pour
la **suppression de compte**, qui la précède.

> Le SMTP du realm reste utile en dehors du partage : sans lui, « mot de passe
> oublié » échoue en silence pour tout le monde.

## Déploiement en production

Le serveur de prod est accessible via SSH à `192.168.1.95` (user `nicolas`) **depuis le LAN uniquement**.
Depuis l'extérieur : `namorama.com` port `12345`. Un alias `namorama-prod` est défini dans `~/.ssh/config`
et fonctionne dans les deux cas — préférer `ssh namorama-prod` à l'IP en dur.

Les images Docker sont buildées automatiquement par **GitHub Actions** et poussées sur le registry `git.neolegal.fr/neolegal/`.

Le docker-compose de prod est dans `/var/snap/docker/common/namorama/docker-compose.yml`.

### Mettre à jour la prod (après un push sur `main`)

```bash
ssh nicolas@192.168.1.95 "cd /var/snap/docker/common/namorama && docker compose pull api web && docker compose up -d api web"
```

> Attendre que GitHub Actions ait terminé le build avant de lancer cette commande.

### Vérifier l'état des conteneurs

```bash
ssh nicolas@192.168.1.95 "docker compose -f /var/snap/docker/common/namorama/docker-compose.yml ps"
```

## Logs et observabilité

### Principe

Les logs servent à répondre à deux questions : **quelle erreur un utilisateur a-t-il rencontrée ?** et **où s'est-il arrêté ?** Tout ce qui ne sert ni à l'une ni à l'autre est du bruit.

### Format et destination

- Format **NDJSON** : une ligne = un objet JSON (`ts`, `kind`, `level`, `context`, …). Grepable tel quel, analysable avec `scripts/analyze-logs.py`, importable dans n'importe quel outil.
- Trois types (`kind`) : `http` (une par requête), `log` (trace technique ou erreur), `event` (étape de parcours ou fait métier).
- Écriture simultanée sur **stdout** (pour `docker logs`) et dans **`LOG_DIR`** (défaut `/app/logs` en prod, monté depuis l'hôte).
- **Pourquoi le fichier est indispensable** : `docker compose up -d` après un `pull` recrée le conteneur, et le journal `json-file` de Docker vit dans le répertoire du conteneur — il disparaît donc à **chaque déploiement**. Sans `LOG_DIR`, aucun historique ne survit à une mise à jour.
- Rétention : `LOG_RETENTION_DAYS` (défaut 30), purge automatique quotidienne. Rotation Docker configurée en prod (20 Mo × 5 fichiers).

### Règles d'écriture

- Utiliser `AppLoggerService` (module global) : `logger.event('nom_evenement', { … })` pour le métier, `logger.error(...)` pour les erreurs.
- **Ne jamais journaliser de secret** : jeton JWT, mot de passe, clé API, contenu de token. Le niveau `verbose` est volontairement muet, car `nest-keycloak-connect` y recrache le JWT complet à chaque requête — un jeton en clair dans un log est rejouable jusqu'à son expiration.
- Journaliser les **4xx autant que les 5xx** : ce sont les 4xx qui révèlent les blocages vécus (crédits épuisés, validation refusée, session expirée).
- Pas de données personnelles au-delà de l'identifiant Keycloak (`sub`). Jamais d'e-mail ni de description de projet en clair.
- Borner ce qui vient du navigateur (taille, nombre de clés) avant de l'écrire.
- Un log ne doit **jamais** faire échouer une requête : toute écriture est best-effort.

### Nommage des événements

`snake_case`, verbe au passé, préfixé par le domaine : `search_started`, `search_completed`, `search_blocked_no_credits`, `wizard_step_viewed`, `login_required_before_search`, `client_error`. Ajouter un événement quand il répond à une question qu'on se pose vraiment — pas « au cas où ».

Deux parcours coexistent et ne partagent aucun repère, d'où deux entonnoirs :

- **générer un nom** (`python3 - funnel`) : décrire → cadrer → chercher → vérifier ;
- **tester un nom qu'on a** (`python3 - nom`) : `public_report_requested` →
  `public_report_shown` → `name_test_project_created`, avec les deux sorties possibles
  (`public_report_signup_clicked` pour approfondir, `public_report_project_clicked` pour
  chercher autre chose).

`report_locked_abandoned` mérite une mention à part : il marque un départ du rapport sans
achat. C'est le seul endroit où le prix se discute vraiment, et le seul moyen de le voir.

Le **parcours d'achat de crédits** n'émettait rien du tout — Stripe configuré, trois packs,
et aucun moyen de distinguer « personne n'a vu l'offre » de « tout le monde l'a refusée ».
Trois événements le couvrent depuis le 12/09/2026 : `credits_dialog_opened` (avec
`origine` — pastille, solde, rapport, recherche refusée — et le `solde` au moment de
l'ouverture), `pack_checkout_started` et `pack_checkout_failed`.

Le dialogue des packs est la **seule page de tarifs** du produit. Son ouverture est aussi
marquée sur la visite (`visitor_session.pricingViewed`, et `checkoutStarted` côté
serveur à la création de la session Stripe) : le tableau de bord la compte au-delà des
30 jours de logs. Relevé du 24/09/2026 : **une seule ouverture** du 12 au 24/09.

`name_analysis_opened` répond à une question que `name_analysis_requested` ne pouvait pas
poser : ce dernier ne part qu'au clic sur « Analyser », donc uniquement quand l'analyse
n'a PAS été pré-calculée. Un seul exemplaire en sept jours pour 409 analyses produites —
l'absence de signal mesurait l'efficacité du pré-calcul, pas la lecture.

### Parcours utilisateur

Deux canaux complémentaires :

- **`POST /events`** (public, anonyme) : appelé systématiquement, sans cookie, avec un identifiant de session éphémère en `sessionStorage`. C'est le seul canal qui mesure ceux qui refusent les cookies — donc ceux qui abandonnent le plus tôt. `page_viewed` y tient une place à part : c'est le seul événement qui compte une **visite**, et donc le dénominateur de l'entonnoir du tableau de bord.
- **Google Analytics** : uniquement si consentement (Consent Mode v2), pour les tableaux de bord d'audience.

Côté front, passer par `AnalyticsService.track()`, qui alimente les deux et n'échoue jamais.

### Consulter les logs en prod

Le serveur n'a **pas** `jq`, mais il a python3. Un script d'analyse est fourni et s'envoie par stdin :

```bash
# Tunnel de conversion : volumétrie par étape, taux d'aboutissement, abandons
ssh namorama-prod "python3 - funnel" < scripts/analyze-logs.py

# Erreurs et avertissements, regroupés par fréquence
ssh namorama-prod "python3 - errors" < scripts/analyze-logs.py

# Rapports de marque : demandes, issues, et détail par compte (sub)
ssh namorama-prod "python3 - rapports" < scripts/analyze-logs.py

# Quota INPI : évolution du compteur dans le temps, et remises à zéro
ssh namorama-prod "python3 - quota"    < scripts/analyze-logs.py

# Parcours « j'ai déjà un nom » : de la page publique au projet créé
ssh namorama-prod "python3 - nom"      < scripts/analyze-logs.py

# Requêtes les plus lentes / codes de statut par route / lignes brutes
ssh namorama-prod "python3 - slow"   < scripts/analyze-logs.py
ssh namorama-prod "python3 - http"   < scripts/analyze-logs.py
ssh namorama-prod "python3 - raw"    < scripts/analyze-logs.py
```

Les fichiers appartiennent à root (écrits par le conteneur) mais sont lisibles par tous : pas besoin de `sudo`, qui échouerait d'ailleurs en SSH non interactif.

> Le `docker-compose.yml` de prod n'est pas versionné dans ce dépôt. Toute modification (volume de logs, rotation) est à reporter à la main sur le serveur, et une sauvegarde datée est créée avant chaque changement.

### Journal d'accès nginx de l'hôte

Le serveur sert vingt-trois vhosts dans **un seul** `/var/log/nginx/access.log`, au
format `combined` — qui ne contient pas `$host`. Un « GET / » n'était donc attribuable
à aucun domaine, et les seules mesures possibles passaient par des chemins d'actifs
propres à l'application (`/assets/config.json`), ce qui ne tient pas dans la durée.

`infra/nginx/journaliser-le-vhost.sh` ajoute le nom d'hôte **en fin de ligne** — les
positions des champs existants ne bougent pas, ce qui lit déjà ce fichier continue de
fonctionner. Idempotent, sauvegarde datée, `nginx -t` avant rechargement. À lancer en
root sur le serveur : `sudo bash journaliser-le-vhost.sh` (le `sudo` demande un mot de
passe, il ne passe pas en SSH non interactif).

> Rotation à 14 jours : ce journal reste une source d'appoint. Le compte durable des
> visites vit en base (`visitor_session`), pas ici.

### Pages prérendues : les URL d'actifs sont ABSOLUES

Angular émet `<script src="main-XXXX.js">` en relatif et compte sur
`<base href="/">`. C'est juste, et les navigateurs le suivent. Les robots, non :
relevé le 05/09/2026, **GPTBot** résolvait le chemin contre le répertoire de la
page et demandait `/guides/main-CRXNHNPF.js`, `/guides/styles-FCJEBA4K.css`,
`/guides/media/primeicons-*.woff` — tous en 404. Sur les pages sans slash, la
résolution était une pure concaténation :
`/verifier-disponibilite-nom-de-marquefavicon.svg`. Une page de contenu SEO
servie sans style ni script à un robot d'indexation, c'est exactement ce que le
prérendu devait éviter.

- Ce que **nous** écrivons est absolu à la source : favicons dans `index.html`,
  logo dans `app.ts`.
- Ce que **le build** génère est repris après coup par
  `web/scripts/absolutiser-les-assets.mjs`, branché sur `npm run build`. Il ne
  réécrit une référence que si le fichier visé existe réellement à la racine de
  la sortie — une URL qu'on ne sait pas résoudre est laissée telle quelle plutôt
  que transformée en lien mort.
- Les `url(...)` des feuilles de style n'ont rien à corriger : une fois la CSS
  chargée depuis `/styles-XXXX.css`, ses chemins relatifs repartent de la racine.

## Fonctionnalités

- Wizard : Description → Reformulation IA → Mots-clés → Recherche domaines
- Tableau matriciel de disponibilité par extension
- Favoris (coups de cœur) avec tri prioritaire
- Projets : sauvegarde, historique, restauration via drawer
- Persistence état wizard avant redirection login (localStorage)
- Accès hybride : public pour le test, connexion requise pour les résultats
- Rapport de marque complet (domaines + réseaux + INPI), facturé `BRAND_REPORT_COST` crédits

### Tableau de bord d'administration

Chaque indicateur de période s'affiche avec son **écart à la période précédente** —
même durée, immédiatement avant — et six **historiques hebdomadaires** sur six mois.
Un **entonnoir de conversion** rapporte le tout au trafic (voir plus bas).

Quatre règles, chacune posée contre une façon précise de faire mentir un chiffre :

- **`user.lastLogin` ne fait pas d'historique.** C'est un scalaire écrasé à chaque
  passage : un compte actif deux semaines de suite n'apparaît que dans la seconde.
  Il ne répond juste que pour une fenêtre **se terminant maintenant**, et sous-estime
  donc systématiquement la période à laquelle on se compare. D'où `user_activity_day`
  (une ligne par compte et par jour, écrite dans `findOrCreate`, best-effort). Avant
  le premier jour du journal, « comptes actifs » vaut **`null`**, jamais zéro —
  l'interface affiche « — » et la courbe un creux hachuré.
- **Pas de pourcentage sous 5 sur la période précédente.** À une poignée
  d'événements par semaine, 1 → 4 s'afficherait « +300 % » et 0 → 1 n'aurait pas de
  pourcentage du tout. En dessous du socle, l'écart s'affiche en absolu. Sur un
  indicateur déjà en pourcentage (taux d'activation), l'écart se compte en **points**.
- **La semaine en cours est incomplète.** Affichée pleine, elle simule une chute
  hebdomadaire : elle est estompée, annoncée comme telle, et exclue des moyennes.
- **« Visiteurs déjà inscrits » se rapporte aux visites IDENTIFIÉES, pas aux
  visites.** Parmi les visites qu'un appel authentifié a rattachées à un compte
  encore existant, la part de celles dont le compte est **antérieur au début de
  la fenêtre**. Le reste — l'écrasante majorité des visites — est anonyme et n'a
  pas d'âge de compte : le mettre au dénominateur ferait lire « peu de
  revenants » là où il n'y a surtout aucune information. Une visite dont le
  compte a été supprimé depuis est écartée du numérateur ET du dénominateur : on
  ne sait plus quand il a été créé. Sous 5 visites identifiées, pas de taux du
  tout (`null`, affiché « — ») : à 2 sur 3, une visite de plus déplace le
  chiffre de 17 points, que le badge d'écart annoncerait comme une tendance.

Les **crédits consommés** sont reconstitués, faute de journal de débits :
suggestions × 1 + `costCredits` réel des rapports. Deux angles morts assumés et
affichés dans l'interface — les suggestions antérieures au 23/08/2026 n'ont pas de
`createdAt` et retombent sur la date de leur projet (`COALESCE`), et les rapports
antérieurs au 19/08/2026 n'ont pas gardé leur coût.

Le **taux d'activation** (inscrits de la période ayant créé au moins un projet) se
calcule rétroactivement sur tout l'historique : c'est le seul indicateur de fond qui
n'attendait aucune nouvelle colonne.

#### Fidélité : qui revient, et combien de temps on reste

Section du tableau de bord **indépendante de la période** (`GET /admin/retention`) : à
quelques inscriptions par semaine, une fenêtre de sept jours ne contient presque jamais
d'inscrit assez ancien pour avoir un J+7.

- **« Revenir » = une activité un autre jour que l'inscription** (`user_activity_day`).
  Ouvrir l'application avec une session ouverte suffit : la mesure dit « est revenu »,
  pas « s'en est resservi ».
- **Un taux à J+N ne compte que les inscrits dont le J+N est passé.** Un compte d'hier
  n'a pas échoué à revenir, il n'en a pas eu le temps ; le compter ferait baisser le
  taux à chaque inscription. Avant le premier J+N, l'interface dit « pas encore
  mesurable » avec la date, pas 0 %.
- Retours et jours d'activité ne portent que sur les comptes nés **après le début du
  journal** (23/08/2026) : un compte plus ancien a pu revenir avant, sans trace.
- La **durée de vie** (création → dernière activité, via `lastLogin`) couvre tout
  l'historique, mais ne connaît que la dernière activité. Médiane rendue en minutes :
  relevée à ~3 min le 22/09/2026, « 0,0 jour » aurait effacé l'information.
- Cohortes **au mois**, pas à la semaine : chaque case vaudrait sinon 0, 20 ou 50 %.

> Relevé du 22/09/2026 : 70 comptes sur 75 sans aucune activité après leur premier
> jour ; 3 retours sous 7 jours sur 23 inscrits éligibles.

#### Comptes écartés des statistiques

Deux drapeaux, qui ne se recouvrent pas :

- `user.isAdmin`, recopié du token Keycloak, ne couvre que les porteurs du rôle realm.
- `user.isInternal` se coche **à la main** depuis le tableau admin (icône drapeau,
  badge « interne » sur la ligne). Rien dans les données ne trahit un compte de test :
  relevé sur les 47 comptes de production, aucun alias `+`, et 28 sur 47 chez
  gmail.com, comptes de test compris. Ni motif d'adresse, ni liste en dur ne
  tiendraient.

Le défaut est « mesuré » : oublier de cocher gonfle les chiffres, ce qui se remarque ;
l'inverse les viderait en silence.

> Le prédicat vit à **un seul endroit** — `comptesMesures()` dans `admin/predicats.ts`. Il apparaît
> dix-neuf fois dans le fichier, une par agrégat : écrit à la main partout, il suffisait
> d'en oublier un pour qu'un indicateur compte les comptes de test sans que rien ne le
> signale. Le chiffre reste plausible, il est simplement faux.

> Sept migrations à appliquer **avant** de déployer l'image :
> `2026-08-23-journal-d-activite-quotidienne.sql`,
> `2026-08-23-date-de-creation-des-suggestions.sql`,
> `2026-08-23-comptes-internes.sql`,
> `2026-08-24-journal-des-visites.sql`,
> `2026-09-12-inscriptions-manquees.sql`,
> `2026-09-22-consommation-du-modele.sql` (relevé des coûts du modèle) et
> `2026-09-24-tarifs-consultes.sql` (suivi de `scripts/rattraper-tarifs-consultes.py`
> pour rattraper les ouvertures depuis les logs).

La **satisfaction** est la part de 👍 parmi les noms notés (👍 ou 👎), rangés à la
**date de génération du nom** — la note n'est pas horodatée, et la question est « les
noms de cette période plaisent-ils ». Les noms laissés neutres sont hors du calcul, et
sous 5 notes il n'y a pas de taux. La carte dit par combien de comptes : sur les 30
jours au 24/09/2026, les 117 👎 venaient d'un seul.

Les coûts IA s'affichent **au centime** (`usd()`) ; seuls les coûts unitaires — par
crédit, par nom — gardent quatre décimales (`usdUnitaire()`), faute de quoi ils
vaudraient tous « < 0,01 $ ».

#### Entonnoir de conversion : le dénominateur qui manquait

Le produit savait compter ses comptes, ses projets et ses rapports. Il ne savait pas
**sur combien de visiteurs** — aucune des sources existantes ne pouvait le dire :

- **Google Analytics** (`G-0PRN6V9ZL7`, posé le 02/03/2026) est conditionné au
  consentement, `denied` par défaut. Il ne voit donc pas ceux qui repartent tout de
  suite, c'est-à-dire précisément la population qu'un entonnoir mesure. À ce volume,
  la modélisation cookieless de GA4 ne se déclenche pas non plus.
- **Les logs NDJSON** tournent sur 30 jours, et **aucun événement n'était émis au
  simple affichage d'une page** : lire et repartir ne laissait aucune trace.
- **Les journaux nginx de l'hôte** tournent sur 14 jours et, jusqu'au 24/08/2026, ne
  portaient pas `$host` — vingt-trois vhosts dans un seul fichier, sans moyen de les
  distinguer.

D'où **`visitor_session`** : une ligne par session de navigateur (`sessionStorage`,
éphémère, sans cookie), créée au premier affichage et complétée au fil des étapes.

- L'unité est la **visite**, et les colonnes sont des **drapeaux, pas des compteurs** :
  la question est « cette visite a-t-elle lancé une recherche », pas « combien de
  fois ». Compter les répétitions ferait dire au taux ce qu'il ne dit pas.
- Les quatre marches viennent de deux canaux, et c'est voulu. La **visite** arrive par
  `POST /events` (`page_viewed`, balise anonyme, sans jeton). Les trois autres —
  **recherche**, **compte créé**, **rapport demandé** — sont marquées **côté serveur**
  par les contrôleurs concernés, à partir de l'en-tête `X-Session-Id` posé par
  `SessionIdInterceptor`. Le `sub` y est celui du jeton : le navigateur ne peut ni
  s'attribuer le compte d'un autre, ni se soustraire aux chiffres en se déclarant
  interne. Le flux SSE de recherche pose l'en-tête **à la main** — c'est un `fetch`
  brut, il ne passe pas par l'intercepteur.
- Une étape marquée **crée la visite si elle manque** : une balise peut être bloquée
  par une extension là où l'appel métier, lui, passe forcément. Sans ce repli,
  l'entonnoir afficherait plus d'étapes que de visiteurs.
- **L'inscription ne se déduit pas de « quel appel a créé la ligne ».** Au chargement de
  l'application, une dizaine d'appels authentifiés partent ensemble et passent tous par
  `findOrCreate` sur un `sub` inconnu : n'importe lequel des vingt appelants peut gagner,
  et seuls les deux de `UsersController` relayaient l'information. Relevé sur les comptes
  créés du 05 au 12/09/2026 : **2 marqués sur 9**, le compte étant créé par
  `GET /brand-report/summaries` quelques dizaines de millisecondes avant
  `GET /users/credits`. Le critère est donc un fait daté — `user.createdAt >=
  visitor_session.firstSeenAt` — appliqué dans `FunnelService.rattacher()`, et
  rétroactivement par `2026-09-12-inscriptions-manquees.sql` (20 visites, 20 comptes
  distincts, exactement les 20 comptes créés depuis le début du journal).
- **L'inscription se rapporte aux visites arrivées SANS compte ouvert**, pas au total.
  Quelqu'un déjà connecté ne peut pas s'inscrire : le compter au dénominateur ferait
  baisser le taux à mesure que les habitués reviennent — le chiffre chuterait quand le
  produit marche. D'où la colonne `loggedInAtStart`.
- Une demande de rapport **refusée faute de crédits compte quand même** : l'entonnoir
  mesure des intentions, et confondre un refus avec un abandon masquerait exactement le
  blocage qu'on cherche à voir. Même règle pour la recherche, marquée avant le contrôle
  de crédits.
- **La collation de `visitor_session.keycloakId` doit suivre celle de
  `user.keycloakId`.** MariaDB refuse de comparer deux collations différentes : la
  jointure n'a pas renvoyé un chiffre faux, elle a mis **tout** le tableau de bord à
  500 le 24/08/2026. Le piège ne se voit pas en développement — `DEFAULT CHARSET=utf8mb4`
  sans `COLLATE` prend la collation de la base, `unicode_ci` en local, `general_ci` en
  production. La migration aligne donc la colonne **dynamiquement** sur celle de `user`.
  Depuis, l'entonnoir et la courbe des visites **échouent seuls** (`funnel: null`,
  `visits: null`) : une carte nouvelle n'emporte plus les quinze autres.
- Avant la première visite enregistrée, l'interface dit **« mesuré depuis le … »**
  plutôt que d'afficher 0 %. Une période antérieure au journal n'invalide pas les
  **taux** — numérateur et dénominateur manquent des mêmes jours — mais sous-estime les
  **volumes** ; c'est dit sous l'entonnoir.

> **Rien n'est rétroactif.** Les visites d'avant le 24/08/2026 n'existent nulle part :
> ni GA (consentement), ni logs (aucun `page_viewed`), ni nginx (14 jours, sans vhost).
> Le seul ordre de grandeur reconstituable pour août 2026, à partir des requêtes
> `/assets/config.json` du journal nginx : **3 à 12 chargements d'application par
> jour**, pour 9 inscriptions du 10 au 24.

### Demander un retour à un utilisateur

Depuis **Administration → Utilisateurs**, l'enveloppe d'une ligne ouvre un courriel
de demande de retour, **rédigé par le modèle à partir de l'activité du compte** —
projets et descriptions, noms aimés, rapports achetés, retours déjà donnés,
courriels déjà reçus. Un destinataire à la fois, relu et confirmé avant chaque
envoi ; **rien ne part automatiquement**, et c'est voulu.

- **De la correspondance, pas de la prospection.** Un message qui pourrait partir
  tel quel à quelqu'un d'autre est un publipostage : les consignes exigent un ou
  deux faits concrets du compte et des questions adaptées à l'endroit où il s'est
  arrêté. HTML nu, sans logo ni pied de page, avec une version texte. Un envoi
  groupé demanderait, lui, un consentement et un lien de désinscription.
- **Expéditeur** : l'adresse reste `SMTP_FROM` (OVH refuse un expéditeur différent du
  compte authentifié), le nom affiché est le prénom de l'administrateur, et les
  réponses vont à `ADMIN_MAIL_REPLY_TO`.
- **La promesse est celle du site, mot pour mot** : « jusqu'à 500 crédits », ajoutés
  après lecture. Deux voies : répondre au courriel, ou `/app?avis=1`, qui ouvre le
  formulaire après connexion — les crédits vont au compte qui écrit.
- Une réponse reçue par courriel se **recopie depuis l'historique** du dialogue : elle
  devient un feedback ordinaire, et les crédits se valident dans l'onglet Feedbacks,
  comme les autres.
- **Page d'avis (`REVIEW_URL`, Trustpilot)** : citée seulement si configurée, et
  jamais liée aux crédits. Trustpilot comme Google interdisent de récompenser un avis
  et de ne solliciter que les clients satisfaits : la phrase vaut « quelle que soit
  votre expérience », et figure dans chaque message.
- **`CONSIGNES_VERSION`** (`admin-mail.service.ts`) est gardée sur chaque envoi : à
  changer à chaque retouche du prompt. L'historique signale les messages écrits avec
  d'anciennes consignes — ceux à qui il peut valoir la peine de réécrire.
- `verifierBrouillon` contrôle mécaniquement le brouillon (lien du formulaire, mention
  des 500 crédits, lien d'avis, **aucun lien inventé**) ; les alertes s'affichent au-dessus
  du texte, qui reste modifiable.
- Un brouillon coûte ~1 000 tokens en entrée et ~250 en sortie (`admin_mail_draft`,
  imputé à l'administrateur). Le dialogue ne rédige d'office que pour un compte jamais
  contacté ; sinon il attend le bouton.

> Migration : `2026-09-25-mails-aux-utilisateurs.sql`, avant de déployer l'image.
> `ADMIN_MAIL_REPLY_TO` et `REVIEW_URL` sont à reporter dans le `docker-compose.yml`
> de prod, qui liste ses variables une à une.

### Suivi des rapports de marque

Deux sources, volontairement distinctes — elles ne mesurent pas la même chose :

- **Logs** (`python3 - rapports`) : toutes les **demandes**, y compris celles qui n'ont produit aucun rapport. `brand_report_requested` est émis avant tout traitement, puis exactement une issue : `brand_report_generated`, `brand_report_cache_hit`, `brand_report_blocked_no_credits` ou `brand_report_failed`. Détail par `sub`, crédits débités sommés depuis le `cost` porté par chaque événement — donc juste même après un changement de tarif.
- **Admin de l'app** : les rapports **produits**, lus en base (`brand_report_record`). KPI période + total, et une colonne « Rapports » par utilisateur. Un compte supprimé ne compte plus (jointure sur le `sub`).

> L'admin affichera toujours un chiffre ≤ celui des logs : un rapport bloqué faute de crédits est une demande, pas un rapport.

### Recherche de marque : ce que l'index de l'INPI compare vraiment

`Mark_Exp` indexe des **jetons**, et la valeur doit partir **entre guillemets**.

- Sans guillemets, un nom en plusieurs mots devient un **OU** entre ses mots :
  `[Mark_Exp=neo legal]` a renvoyé **3818** dépôts, sans la marque cherchée dans la page
  (le tri se fait par date de dépôt, pas par pertinence) ; `[Mark_Exp="neo legal"]` en
  renvoie **1**, le bon. Un point ou un tiret suffisaient : `neolegal.fr` → 9455.
- La passerelle **ne connaît aucun opérateur booléen**. `OR` y est un mot ordinaire — il
  ramène « CARTE D'OR ». Une orthographe par requête, donc une unité de quota par
  orthographe.
- « Neo Legal » vit en deux jetons, `neo` et `legal` : **aucune requête sur `neolegal` ne
  peut l'atteindre**, ni exacte, ni tronquée. C'est le faux négatif du 03/09/2026 — un
  rapport facturé annonçait « aucun dépôt identique » sur un nom déposé en classe 45.
  D'où `NameVariantsService`, qui cherche aussi les autres orthographes : la forme collée
  et la forme espacée quand le nom porte un séparateur, un découpage proposé par le modèle
  quand c'est un mot collé. **La sortie du modèle est vérifiée** — une variante n'est
  retenue que si, séparateurs retirés, elle redonne exactement le nom de départ.

> `data.inpi.fr` ne répond pas à la même question, et la divergence est normale : il
> cherche dans **tout le dossier** — déposant, **mandataire**, libellés — et compare après
> avoir collé les mots. Sur une recherche « neolegal », 6 de ses 7 résultats étaient les
> dossiers d'un cabinet tchèque nommé NEOLEGAL, mandataire de marques sans rapport
> (vérifié dans la notice ST66 du n° 1804223). Recopier son affichage remplacerait un faux
> négatif par six faux positifs.

### Quota INPI

Le volet marque d'un rapport s'appuie sur **un seul compte INPI**, partagé par tout le
produit. La passerelle expose ce qu'il en reste à chaque appel de diffusion :
`x-rate-limit-remaining` (sur **100**) et `x-size-limit-remaining` (~**50 Mo**).

- Une **notice coûte une unité au même titre qu'une recherche** — mesuré, pas supposé.
  Un rapport en consomme donc jusqu'à **8** (1 recherche pour le nom, jusqu'à
  `MAX_VARIANT_SEARCHES` pour ses autres orthographes, `MAX_NOTICE_FETCHES` pour les
  notices), soit **au plus ~12 rapports par période**.
- **La durée de la période n'est documentée nulle part** : aucun `x-rate-limit-reset`,
  rien dans l'OpenAPI de la passerelle ni dans la documentation publique de l'INPI.
  C'est pourquoi chaque appel journalise `trademark_quota_observed` : `python3 - quota`
  affiche la suite chronologique et **signale les remontées du compteur**, ce qui encadre
  la période entre deux bornes observées.
- Sous 16 appels restants (deux rapports au plafond), `trademark_quota_low` passe en `warn` : le manque de quota ne
  casse rien de visible, il fait retomber le volet marque sur « non vérifiable » dans un
  rapport pourtant facturé.

> Ne jamais partager ce compte avec le développement local : les tests videraient le
> quota de la production. Un second compte INPI, ou le message « non configurée ».
