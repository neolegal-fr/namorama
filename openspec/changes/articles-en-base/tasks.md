# Tasks

> Branche dédiée depuis `origin/main` à jour, après fusion de
> `docs/archiver-chantiers-blog` (qui crée la capacité `blog` que ce chantier modifie).

## 1. Le modèle et le compilateur, côté API

- [x] 1.1 Migration `api/migrations/2026-11-…-articles-en-base.sql` : tables `article`,
  `article_revision`, `jeton_api` (design D3), idempotente, commande d'application et
  retour arrière en en-tête ; entités TypeORM correspondantes.
  Vérification : appliquée deux fois de suite sur la base du worktree (`just agent-env`)
  sans erreur ; `DESCRIBE` des trois tables conforme aux entités ; l'API démarre avec
  `DB_SYNCHRONIZE=false`.
  23/11/2026 : `2026-11-23-articles-en-base.sql` appliqué deux fois sur `namorama_w2` sans erreur ; `SHOW CREATE TABLE` identique, pour les trois tables, au schéma que TypeORM génère sur une base vide (`DB_SYNCHRONIZE=true`) ; API démarrée sur `namorama_w2` avec `DB_SYNCHRONIZE=false`.
- [x] 1.2 Porter `web/scripts/articles.mjs` en TypeScript dans
  `api/src/articles/compilateur/` (en-tête, typographie, blocs, liens, HTML brut refusé,
  temps de lecture, segments) ; ajouter `marked` aux dépendances de l'API ; porter les
  cas de `web/scripts/articles.test.mjs` en spec Jest. Les erreurs sont **accumulées**
  (liste de causes) au lieu de lever à la première.
  Vérification : `npm test -- compilateur` dans `api/` ; chaque cas porté passe ; un
  article à deux fautes renvoie deux causes.
  23/11/2026 : `npx jest src/articles` — 40 tests (cas portés + causes accumulées, ligne du HTML brut, chemins, liens selon la date, ligne `# revision`). Suite complète de l'API : 537 tests. `marked` 18 est ESM seul : chargé par `require` à l'exécution (Node ≥ 22.12), transformé par ts-jest dans Jest (`transformIgnorePatterns`).
- [x] 1.3 Parité du compilateur porté : compiler les 31 fichiers actuels avec l'ancien
  et le nouveau compilateur et comparer les `segments`, `h1` et `lecture`.
  Vérification : script jetable, 31 sur 31 identiques ; résultat noté sous la tâche.
  23/11/2026 : **31 identiques sur 31** (segments, h1, lecture), tous les liens vérifiés comme à la publication. Le premier essai en refusait 5 : des guides de juin mis à jour en septembre citent des articles du 03/09. La règle était trop stricte — la cible doit avoir paru le jour où l'article est **servi** (sa date, ou aujourd'hui s'il a déjà paru), comme le faisait le compilateur de build ; corrigé dans le compilateur, la spec (scénario « Guide ancien mis à jour ») et les tests.
- [x] 1.4 `CHEMINS_DU_SITE` (routes statiques servies) et `CHEMINS_HISTORIQUES` (18
  adresses hors `/blog/`) dans l'API ; règle « chemin `/blog/<identifiant>` ou
  historique » dans la validation.
  Vérification : spec — `/nom-de-restaurant` refusé avec la forme attendue,
  `/namorama-vs-looka` admis, `/blog/nom-de-restaurant` admis.

## 2. Rédaction : enregistrer, publier, révisions (API)

- [x] 2.1 `ArticlesService` : `verifier` (rendu ou causes, sans écrire), `enregistrer`
  (création en brouillon, modification avec `revisionAttendue`, 409 avec révision et
  auteur courants, aucune révision si la source est identique), révision écrite dans la
  même transaction que l'article.
  Vérification : spec — scénarios « Vérification sans enregistrement », « Nouvel article
  en brouillon », « Enregistrement concurrent refusé », « Aller-retour sans
  modification ».
  23/11/2026 : `articles.service.spec.ts` (base en mémoire) — les quatre scénarios passent.
- [x] 2.2 Liens selon la date de parution : un article publié ne cite pas un brouillon
  ni un article à paraître après lui ; `publier` accepte une liste de chemins validée
  comme un tout ; `depublier` refusé tant qu'un article paru cite la cible ;
  `premiereParution` posée et remise à nulle (D3) ; chemin figé et suppression refusée
  une fois paru.
  Vérification : spec — « Article programmé qui cite le suivant », « Lien dans un
  brouillon », « Dépublication d'un article cité », « Renommage d'un article paru »,
  « Article déjà paru » (suppression), et deux articles qui se citent publiés ensemble.
  23/11/2026 : scénarios couverts par `articles.service.spec.ts`, plus `enregistrerLot` (ajouté : des articles qui se citent en boucle ne peuvent pas être **créés** un par un — le premier citerait une adresse inconnue ; c'est le chemin de l'import, rejouable sans révision).
- [x] 2.3 Restauration d'une révision (nouvelle révision, rien d'effacé) et lecture de
  l'historique.
  Vérification : spec — « Correction annulée » (5 révisions → restaurer la 3 → 6).
  23/11/2026 : 5 révisions → restaurer la 3 → révision 6, source de la 3, historique 6..1.
- [x] 2.4 Contrôleur `/admin/articles` (`@Roles realm:admin`, design D5) et événements
  `article_saved`, `article_published`, `article_unpublished`, `article_restored`,
  `article_deleted`, `article_rejected` (D11).
  Vérification : spec e2e du contrôleur — 401 sans jeton Keycloak, 403 sans rôle
  `admin` ; un événement par geste, sans champ `corps` ni `source` (assertion sur la
  ligne journalisée).
  23/11/2026 : `jetons.spec.ts` vérifie le rôle `realm:admin` des contrôleurs ; contre l'API du worktree : 401 sans jeton, **403** avec le jeton Keycloak d'un compte ordinaire créé puis supprimé (`/admin/articles`, `/admin/jetons`). Événements sans texte vérifiés en test et dans le journal local.
  Le filtre global ne rendait que `message` : il transmet désormais les champs d'une exception objet (`causes`, `revisionCourante`, `citants`), sans les journaliser (`http-exception.filter.spec.ts`).
- [x] 2.5 `CLAUDE.md`, section « Blog » : la source est la base, la compilation a lieu à
  l'enregistrement, règles des chemins, des liens et des révisions ; renvoi au
  chantier.
  Vérification : relecture ; plus aucune mention de `prebuild` ni de
  `articles.generes.ts` comme source d'un article.
  23/11/2026 : section « Blog : les articles vivent en base » réécrite.

## 3. Jetons de rédaction (API)

- [x] 3.1 Entité et service `jeton_api` : création (`nmr_` + 32 octets base64url, valeur
  rendue une fois, SHA-256 stocké, préfixe gardé), liste, révocation,
  `derniereUtilisation` au plus une fois par minute ; routes `/admin/jetons` ;
  événements `api_token_created`, `api_token_revoked`.
  Vérification : spec — « Création », « Révocation », « Valeur lue en base » (aucune
  colonne ne contient la valeur rendue).
  23/11/2026 : `jetons.spec.ts`.
- [x] 3.2 `JetonDeRedactionGuard` (en-tête `X-Namorama-Jeton`) et contrôleur
  `/redaction/articles` (`@Public()` de `nest-keycloak-connect`) : liste, lecture au
  format Markdown avec `# revision: N`, vérification, enregistrement, publication,
  dépublication ; auteur de révision = nom du jeton.
  Vérification : spec e2e — jeton valide accepté, révoqué refusé en 401, jeton présenté
  sur `/admin/stats` refusé en 401, « Auteur d'une modification ».
  23/11/2026 : `jetons.spec.ts` (garde) ; contre l'API du worktree : jeton valide 200, sans jeton 401, jeton présenté sur `/admin/stats` et `/admin/articles` 401 ; auteur des révisions = nom du jeton.
- [x] 3.3 `CLAUDE.md` : jetons de rédaction (portée, en-tête, stockage haché,
  révocation) dans la section « Blog ».
  Vérification : relecture.
  23/11/2026 : dans la section « Blog ».

## 4. Lecture publique (API)

- [x] 4.1 `GET /articles` (parus, métadonnées) et `GET /articles/contenu?path=` (un article
  paru, segments compris, 404 sinon), `@Public()`, `Cache-Control: no-cache` ; « paru » =
  `etat = publie` et `publie` ≤ jour courant à Paris.
  Vérification : spec — brouillon absent ; article daté du lendemain absent puis présent
  en avançant l'horloge du test au lendemain 0 h 05 Paris (« Article programmé un
  lundi », « Le jour venu »).
  23/11/2026 : `articles.service.spec.ts` — brouillon absent ; article du 30/11 absent à 23 h 50 le 29/11 (Paris), présent à 0 h 05 le 30/11. `curl /articles` : 22 articles après import.

## 5. Commandes pour Claude et import

- [x] 5.1 `scripts/article.mjs` et recettes `just article-liste`, `article-lire`,
  `article-verifier`, `article-envoyer [--publier]`, `article-publier`,
  `article-depublier` (design D9) ; `NAMORAMA_JETON_ARTICLES` obligatoire,
  `NAMORAMA_API_URL` par défaut `https://api.namorama.com`.
  Vérification : contre l'API du worktree — lire → envoyer sans changement : aucune
  révision ; envoi d'un lien cassé : sortie non nulle, adresse citée, base inchangée ;
  sans variable : échec qui la nomme, aucun appel réseau.
  23/11/2026 : lire → envoyer sans changement : révision inchangée ; modification : révision 2 ; renvoi de l'ancienne lecture : 409 « révision en ligne : 2, par Essai local » ; lien cassé : sortie 1, adresse citée, article resté en r2 ; sans variable : échec qui la nomme. Recettes en `[no-cd]` : un chemin de fichier relatif vaut depuis le dossier courant.
- [x] 5.2 `just article-importer <dossier>` : envoi de chaque fichier en brouillon, puis
  publication de tous les chemins en un appel (D10).
  Vérification : sur la base du worktree, import des 31 fichiers ; `GET /articles` en
  rend 22 au 23/11/2026 (les 9 programmés absents), l'admin en liste 31 ; un second
  import ne crée aucune révision.
  23/11/2026 : « 31 fichiers : 31 créés, 0 inchangés, 31 publiés » ; `GET /articles` → 22, `article-liste` → 22 publiés + 9 programmés ; second import : « 0 créés, 31 inchangés, 0 publiés ».
- [x] 5.3 Réécrire `docs/ecrire-un-article.md` : écrire depuis l'administration, avec
  Claude (jeton, commandes, `# revision`), programmer, conflits, restaurer ; retirer le
  circuit GitHub/PR/déploiement. Supprimer de la section « Blog » de `CLAUDE.md`
  ce qui décrivait le circuit par fichiers.
  Vérification : chaque commande citée exécutée telle qu'écrite contre l'API du worktree.
  23/11/2026 : guide réécrit (administration, Claude, programmation, conflits et historique, erreurs). Exécutées telles qu'écrites, depuis `web/`, contre l'API du worktree : `article-liste`, `article-lire`, `article-verifier --publier`, `article-envoyer`, `article-publier`, `article-depublier`, `article-importer` ; brouillon 404, publié 200, dépublié 404.

## 6. Rendu serveur du blog (web)

- [x] 6.1 `angular.json` en `outputMode: "server"` ; `blog`, `blog/:slug` et les 18
  `CHEMINS_HISTORIQUES` en `RenderMode.Server` ; les autres routes inchangées.
  Vérification : `npm run build` produit `browser/` (accueil, `/en`, pages légales,
  `/verifier-disponibilite-nom-de-marque` toujours prérendus) et `server/server.mjs`.
  23/11/2026 : `ng build` — `browser/` (accueil, `/en`, `legal`, `privacy`, vérificateur prérendus : « Prerendered 5 static routes ») et `server/server.mjs`. `security.allowedHosts` posé ; le bundle serveur tourne sans `node_modules` (copié seul hors du dépôt).
- [x] 6.2 `ArticlesService` web (URL interne côté serveur via `API_INTERNE_URL`,
  `config.apiUrl` côté navigateur, `TransferState`) ; registre, index, en-tête et
  `ArticleMarkdownComponent` alimentés par l'API au lieu de `articles.generes.ts` ;
  l'entrée écrite à la main de `/verifier-disponibilite-nom-de-marque` conservée et
  fusionnée à l'index.
  Vérification : `npm test` (specs des composants du blog adaptées à un service simulé) ;
  au navigateur, une navigation interne entre deux articles ne recharge pas la page et
  ne rappelle pas l'API pour la première page servie.
  23/11/2026 : `npm test` 105 tests ; au navigateur (Playwright, `ng serve`) sur `/guides/trouver-nom-de-marque` : aucun appel à l'API depuis le navigateur au premier affichage (`TransferState`), clic sur un lien interne : pas de rechargement (marqueur `window` conservé, un seul document), un appel pour l'article suivant.
  Corps de l'article extrait dans `ArticleCorpsComponent`, partagé avec l'aperçu de l'éditeur.
- [x] 6.3 Statuts : `/blog/<inconnu>` → 404 (`RESPONSE_INIT`) ; API injoignable → 503 +
  `Retry-After: 120` et `blog_source_unavailable` journalisé.
  Vérification : `curl -sI` sur le service local — 404 pour `/blog/brief-de-namming` ;
  API arrêtée : 503 sur `/guides/trouver-nom-entreprise` et sur `/blog`.
  23/11/2026 : `/blog/brief-de-namming` → 404 ; `/blog/brief-de-naming` (programmé au 07/12) → 404 ; API arrêtée : 503 + `Retry-After: 120` sur `/guides/trouver-nom-entreprise`, `/blog` et `/sitemap.xml`, `blog_source_unavailable` journalisé à chaque fois.
- [x] 6.4 Dictionnaires i18n lus à côté du bundle serveur, pas sous `process.cwd()`.
  Vérification : `node dist/namorama-web/server/server.mjs` lancé depuis `/tmp` rend un
  article sans clé brute (`grep -c 'BLOG\.' ` = 0 dans le HTML).
  23/11/2026 : service lancé depuis le dossier temporaire du job : H1, `<title>`, `BlogPosting` présents, 0 clé i18n brute. Sous `ng serve`, la sortie n'existe pas sur disque : la première version mettait toutes les pages en 500 (lecture de `browser/`), corrigé — `absolutiser` ne réécrit rien en développement.
- [x] 6.5 `sitemap.xml` servi par `server.ts` : gabarit `public/sitemap.xml` (marqueurs
  conservés) complété par `GET /articles` ; 503 si l'API manque.
  Vérification : `curl` local — articles parus présents avec `lastmod`, brouillon et
  article programmé absents, `/guides` absent.
  23/11/2026 : `sitemap.xml` servi : 28 `<url>` (6 du gabarit + 22 articles parus), article programmé absent, `/guides` absent ; 503 si l'API manque.
- [x] 6.6 Retirer `web/scripts/articles.mjs`, `articles.test.mjs`, les hooks
  `prebuild` / `prestart` / `pretest`, `articles.generes.ts` et la dépendance `marked`
  du web ; test de cohérence entre `CHEMINS_HISTORIQUES` (web), la liste de l'API et
  `CHEMINS_DU_SITE` d'une part, les routes de `app.routes.ts` d'autre part.
  Vérification : `npm test` et `npm run build` passent sur un dépôt neuf
  (`git clean -xfd web/src` puis build) ; le test échoue si l'on retire une adresse
  d'une des listes.
  Les fichiers de `web/src/content/articles/` ne sont supprimés qu'à la tâche 9.6.
  23/11/2026 : `articles.mjs`, `articles.test.mjs`, hooks et `articles.generes.ts` retirés ; `npm test` passe sans fichier généré. `chemins-du-site.spec.ts` compare API, web et `nginx.conf` ; échoue bien si l'on retire `/namorama-vs-looka` de la liste du web (essayé puis rétabli). `marked` quitte le web.
  CI : un job `test-web` ajouté (le web n'avait aucun test exécuté en CI) — il conditionne les images web et blog.
- [x] 6.7 `CLAUDE.md` : section « Pages prérendues » et « Blog » — ce qui reste prérendu,
  ce qui est rendu à la demande, `API_INTERNE_URL`, règle 503.
  Vérification : relecture.
  23/11/2026 : sections « Pages prérendues » (pages rendues à la demande) et « Le blog est rendu à la demande, derrière nginx ». Mesure : ~0,4 à 0,6 s de CPU par page (rendu de toute la coquille), sur un poste chargé (charge 20 sur 12 cœurs) — au-dessus des ~200 ms visés par D6 ; suivi en production par `durationMs`.

## 7. Images, nginx et CI

- [ ] 7.1 `web/Dockerfile` : cible `ssr` (Node, `dist/` + `server.mjs`, `TZ=Europe/Paris`,
  port 4000) à côté de l'image nginx ; `docker-publish.yml` construit et pousse
  `namorama-blog` ; le job « Système de design » bloque les deux images.
  Vérification : `docker build --target ssr web` et `docker build web` passent en local ;
  CI verte sur la PR avec les trois images.
- [x] 7.2 `web/nginx.conf` : `location` du blog, des 18 adresses historiques et de
  `/sitemap.xml` relayées à `blog:4000` par variable + `resolver 127.0.0.11` ; règle du
  slash final reprise sous `/blog/` ; aucune autre `location` modifiée.
  Vérification : `infra/docker-compose.yml` local avec un service `blog` —
  `curl -sI` : `/guides` 301 → `/blog`, `/blog/` 301 → `/blog`, `/namorama-vs-looka`
  200, `/app` servi par nginx (coquille), `/rapport/x` avec `X-Robots-Tag` ; nginx
  démarre service `blog` arrêté, et le blog répond alors 502/503 sans toucher `/`.
  23/11/2026 : images `namorama-blog:essai` et `namorama-web:essai` sur un réseau Docker, curl avec `X-Forwarded-For` comme le nginx de l'hôte : `/guides` et `/blog/` → 301 `/blog` ; `/blog`, `/namorama-vs-looka`, `/guides/trouver-nom-de-marque` → 200 avec leur H1 ; `/blog/brief-de-namming` et l'article programmé → 404 ; `/`, `/legal` servis par nginx ; `/rapport/x` avec `X-Robots-Tag`. Service arrêté : **503 + `Retry-After: 120`**, `/` toujours 200 ; nginx démarre sans le conteneur `blog` et le retrouve à son retour.
  **Trouvé à ce test** : Angular 21 sert la coquille vide (200, sans erreur) à toute requête portant `X-Forwarded-*` sans `trustProxyHeaders` — en production, toutes les pages du blog seraient parties vides aux robots. En-têtes retirés par nginx et par `server.ts` (`en-tetes-de-proxy.ts`, testé). Ajouté aussi : `.angular` dans `.dockerignore`.
- [x] 7.3 `infra/docker-compose.yml` et recettes `just start` / `agent-start` : le dev
  passe par `ng serve` (rendu serveur intégré), `API_INTERNE_URL` pointe l'API du
  worktree.
  Vérification : `just agent-start` puis `curl` sur `http://localhost:420N/blog` →
  HTML contenant les titres des articles de la base du worktree.
  23/11/2026 : `infra/docker-compose.yml` inchangé (le développement passe par `ng serve`, qui rend les routes serveur) ; `just start` et `agent-start` passent `API_INTERNE_URL`. `just agent-start` puis `curl localhost:4202/blog` : titres des articles de `namorama_w2`.

## 8. Écran « Articles » (web)

- [x] 8.1 Onglet `/admin/articles` : tableau (chemin, titre, catégorie, état
  brouillon / programmé / publié, date, dernière modification et auteur), bouton
  principal « Nouvel article » ; textes FR/EN.
  Vérification : au navigateur avec les 31 articles importés, en clair et en sombre, à
  390 px et sur bureau.
  23/11/2026 : Playwright, 31 articles importés : 31 lignes en clair et en sombre, à 390 px et 1 280 px (captures relues). À 390 px, les puces de filtre s'écrasaient sur deux lignes : elles défilent désormais (`flex-shrink: 0`).
- [x] 8.2 Éditeur `/admin/articles/:id` : Markdown et aperçu côte à côte (onglets à
  390 px), vérification regroupée à 500 ms, causes à la place de l'aperçu et
  « Enregistrer » désactivé si invalide ; « Publier » / « Dépublier » secondaires avec
  confirmation ; « Supprimer » pour un brouillon jamais paru.
  Vérification : au navigateur — scénarios « Bloc d'appel à l'action », « Erreur de
  saisie », publication d'un brouillon puis visite de sa page ; clair/sombre,
  390 px/bureau.
  23/11/2026 : Playwright — bloc `::: cta label="Tester un nom"` inséré : l'aperçu montre le bouton à sa place ; lien cassé : causes à la place de l'aperçu, « Enregistrer » désactivé ; enregistrement → révision +1, page publique servie aussitôt avec le bloc ; nouvel article : brouillon (404 public) → Publier (200 public) → repasser en brouillon ; « Supprimer » absent après parution, présent et effectif sur un brouillon jamais paru. Adresse déjà prise : signalée dès la vérification (la vérification d'un nouveau texte sur un chemin existant le traitait comme une modification — corrigé dans l'API, test ajouté) ; un 409 de création ne s'affiche plus comme un conflit d'écriture.
- [x] 8.3 Historique en tiroir avec « Restaurer » ; bandeau de conflit 409 (texte
  conservé, révision et auteur nommés, « Voir la version en ligne »).
  Vérification : au navigateur — conflit provoqué par `just article-envoyer` pendant
  l'édition ; restauration d'une révision antérieure.
  23/11/2026 : Playwright — `just article-envoyer` pendant l'édition : bandeau « révision N, par Essai local », texte conservé, version en ligne ouverte à côté, « Repartir de cette version » ; historique (tiroir) : restauration d'une révision antérieure → nouvelle révision.
- [x] 8.4 Section « Jetons de rédaction » : liste, création avec valeur montrée une fois
  et « Copier », révocation confirmée.
  Vérification : au navigateur — un jeton créé fonctionne avec `just article-liste`, puis
  refusé après révocation.
  23/11/2026 : Playwright — jeton créé, valeur montrée une fois, `article liste` passe avec lui ; révoqué → 401 ; la liste n'affiche que le préfixe. Aucune erreur JavaScript sur l'ensemble du parcours.
- [x] 8.5 `docs/systeme-de-design.md` §5 : motif « éditeur à aperçu » (disposition,
  bascule à 390 px, bouton principal unique, place des erreurs) avec la décision et
  l'option écartée (design D7).
  Vérification : relecture ; le motif renvoie aux composants réellement employés.
  23/11/2026 : §5 « Éditeur à aperçu (administration) » et `app-article-corps` ; §4, jeton `--nm-font-mono` (ajouté à `tokens.css`).
- [x] 8.6 `just design-check`.
  Vérification : la commande passe sans relever `web/design-reference.json`.
  23/11/2026 : « aucune valeur en dur ajoutée (664 occurrences héritées, figées) ». Les deux écrans nouveaux partent de zéro.

## 9. Parité et intégration

- [x] 9.1 `web/scripts/comparer-rendus.mjs` : pour une liste d'adresses, compare deux
  origines (texte visible normalisé, `href`, `id` des titres, JSON-LD).
  Vérification : exécuté contre deux origines identiques → aucun écart ; contre une page
  modifiée à la main → l'écart est signalé.
  23/11/2026 : même origine des deux côtés → « 3 identiques, 0 écart » ; une page modifiée à la main (un mot) → écart signalé à l'endroit exact, sortie 1.
- [x] 9.2 Parité locale : build prérendu de `main` servi d'un côté, service `blog` sur la
  base importée de l'autre, pour `/blog` et les 22 articles parus.
  Vérification : `comparer-rendus.mjs` — aucun écart ; résultat noté sous la tâche.
  23/11/2026 : build prérendu d'avant le chantier (servi en statique) contre les conteneurs (base importée) : **27 pages identiques sur 27** — `/blog`, les 22 articles parus, `/en`, `/legal`, `/privacy`, le vérificateur ; texte visible, liens, identifiants des titres et JSON-LD.
- [x] 9.3 Lisibilité inchangée : trois articles (dont `/namorama-vs-namelix` et un avec
  `trois-risques`) en clair et en sombre, à 390 px et sur bureau, servis par le service.
  Vérification : au navigateur ; contraste des cellules du tableau ≥ 4,5:1 en sombre.
  23/11/2026 : `/namorama-vs-namelix`, `/generateur-nom-de-marque` (bloc « trois risques ») et `/blog/noms-chatgpt-deja-pris`, servis par les conteneurs, en clair et en sombre, à 390 et 1 280 px : contraste minimal mesuré **4,95:1** (cellules du tableau en clair) ; en sombre ≥ 6,92:1. Captures relues.
- [x] 9.4 Robot sans JavaScript : `curl` de `/blog/noms-chatgpt-deja-pris` contient H1,
  titres, `<title>` et `BlogPosting`.
  Vérification : commande et extrait notés sous la tâche.
  23/11/2026 : `curl -A GPTBot -H 'X-Forwarded-For: …' /blog/noms-chatgpt-deja-pris` : `<title>`, H1 « Velora, Nuvira, Avelis : pourquoi les noms proposés par ChatGPT sont déjà pris », titres de section, `BlogPosting`, `canonical` ; aucune URL d'actif relative.
- [x] 9.5 Parution à la date : article de test daté du lendemain, horloge du service
  et de l'API avancée (`faketime` ou `TZ` + date de test) au lendemain 0 h 05 Paris.
  Vérification : 404 avant, 200 après, présent sur `/blog` et dans `sitemap.xml`.
  23/11/2026 : une seconde API, horloge décalée par un préchargement (`Date` décalé), sur la base du worktree : à 23 h 50 le 29/11 (Paris), `/blog/agence-responsable-nom-deja-depose` (programmé au 30/11) → 404 et 22 articles parus ; à 0 h 05 le 30/11 → 200 et 23 parus. Index et plan du site dérivent de cette même liste.
- [x] 9.6 Supprimer `web/src/content/articles/` du dépôt.
  Vérification : `npm run build` et `npm test` passent ; `grep -r content/articles web/
  docs/ CLAUDE.md` ne renvoie plus que l'historique de chantiers archivés.
  23/11/2026 : `web/src/content/articles/`, `scripts/articles.mjs` et son test supprimés ; `npm run build` et `npm test` (106 tests) passent ; API : `tsc` et 571 tests. Les références restantes sont dans l'historique OpenSpec (chantiers archivés et `publier-les-articles-a-date`).

## 10. Livraison

- [ ] 10.1 Appliquer `2026-11-…-articles-en-base.sql` en production **avant** toute
  image.
  Vérification : `DESCRIBE article` sur la base de prod.
- [ ] 10.2 Déployer l'image `api` seule.
  Vérification : `GET https://api.namorama.com/articles` → `[]` en 200 ; le site sert
  toujours les pages prérendues.
- [ ] 10.3 Import en production : jeton « import » créé dans l'administration de prod,
  `just article-importer` sur le dossier extrait du commit **précédant** la fusion
  (`git archive <fusion>^1 web/src/content/articles`), puis jeton révoqué.
  Vérification : `GET /articles` → 22 articles au 23/11/2026 (ou le nombre paru à la
  date de livraison) ; l'admin en liste 31 ; jeton « import » révoqué.
- [ ] 10.4 Ajouter le service `blog` au `docker-compose.yml` de prod (sauvegarde datée),
  `API_INTERNE_URL=http://api:3000`, `restart: unless-stopped`.
  Vérification : `docker compose config` valide ; `docker compose ps` montre `blog` sain.
- [ ] 10.5 Déployer `web` et `blog`.
  Vérification : `comparer-rendus.mjs` entre l'ancienne image (conservée en local) et la
  production : aucun écart ; `curl` 301 `/guides`, 404 `/blog/brief-de-namming`,
  `sitemap.xml` complet ; `python3 - errors` sans `blog_source_unavailable`.

## Workflow follow-up

- Le premier lundi après la livraison, vérifier que l'article programmé de ce jour paraît
  sans déploiement : 200 sur son adresse, présent sur `/blog` et dans `sitemap.xml`.
- Une semaine après : `article_rejected` et `article_saved` par auteur dans les logs —
  Claude et l'écran servent-ils tous deux ? Durée de rendu du service (D6).
- J+30 : Search Console — aucune hausse des 404 ou 5xx sur les adresses d'articles.
- Archiver le chantier (`/opsx:archive`) une fois ces suivis notés ici, puis
  `openspec validate --all`.
