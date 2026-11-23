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

- [ ] 2.1 `ArticlesService` : `verifier` (rendu ou causes, sans écrire), `enregistrer`
  (création en brouillon, modification avec `revisionAttendue`, 409 avec révision et
  auteur courants, aucune révision si la source est identique), révision écrite dans la
  même transaction que l'article.
  Vérification : spec — scénarios « Vérification sans enregistrement », « Nouvel article
  en brouillon », « Enregistrement concurrent refusé », « Aller-retour sans
  modification ».
- [ ] 2.2 Liens selon la date de parution : un article publié ne cite pas un brouillon
  ni un article à paraître après lui ; `publier` accepte une liste de chemins validée
  comme un tout ; `depublier` refusé tant qu'un article paru cite la cible ;
  `premiereParution` posée et remise à nulle (D3) ; chemin figé et suppression refusée
  une fois paru.
  Vérification : spec — « Article programmé qui cite le suivant », « Lien dans un
  brouillon », « Dépublication d'un article cité », « Renommage d'un article paru »,
  « Article déjà paru » (suppression), et deux articles qui se citent publiés ensemble.
- [ ] 2.3 Restauration d'une révision (nouvelle révision, rien d'effacé) et lecture de
  l'historique.
  Vérification : spec — « Correction annulée » (5 révisions → restaurer la 3 → 6).
- [ ] 2.4 Contrôleur `/admin/articles` (`@Roles realm:admin`, design D5) et événements
  `article_saved`, `article_published`, `article_unpublished`, `article_restored`,
  `article_deleted`, `article_rejected` (D11).
  Vérification : spec e2e du contrôleur — 401 sans jeton Keycloak, 403 sans rôle
  `admin` ; un événement par geste, sans champ `corps` ni `source` (assertion sur la
  ligne journalisée).
- [ ] 2.5 `CLAUDE.md`, section « Blog » : la source est la base, la compilation a lieu à
  l'enregistrement, règles des chemins, des liens et des révisions ; renvoi au
  chantier.
  Vérification : relecture ; plus aucune mention de `prebuild` ni de
  `articles.generes.ts` comme source d'un article.

## 3. Jetons de rédaction (API)

- [ ] 3.1 Entité et service `jeton_api` : création (`nmr_` + 32 octets base64url, valeur
  rendue une fois, SHA-256 stocké, préfixe gardé), liste, révocation,
  `derniereUtilisation` au plus une fois par minute ; routes `/admin/jetons` ;
  événements `api_token_created`, `api_token_revoked`.
  Vérification : spec — « Création », « Révocation », « Valeur lue en base » (aucune
  colonne ne contient la valeur rendue).
- [ ] 3.2 `JetonDeRedactionGuard` (en-tête `X-Namorama-Jeton`) et contrôleur
  `/redaction/articles` (`@Public()` de `nest-keycloak-connect`) : liste, lecture au
  format Markdown avec `# revision: N`, vérification, enregistrement, publication,
  dépublication ; auteur de révision = nom du jeton.
  Vérification : spec e2e — jeton valide accepté, révoqué refusé en 401, jeton présenté
  sur `/admin/stats` refusé en 401, « Auteur d'une modification ».
- [ ] 3.3 `CLAUDE.md` : jetons de rédaction (portée, en-tête, stockage haché,
  révocation) dans la section « Blog ».
  Vérification : relecture.

## 4. Lecture publique (API)

- [ ] 4.1 `GET /articles` (parus, métadonnées) et `GET /articles/contenu?path=` (un article
  paru, segments compris, 404 sinon), `@Public()`, `Cache-Control: no-cache` ; « paru » =
  `etat = publie` et `publie` ≤ jour courant à Paris.
  Vérification : spec — brouillon absent ; article daté du lendemain absent puis présent
  en avançant l'horloge du test au lendemain 0 h 05 Paris (« Article programmé un
  lundi », « Le jour venu »).

## 5. Commandes pour Claude et import

- [ ] 5.1 `scripts/article.mjs` et recettes `just article-liste`, `article-lire`,
  `article-verifier`, `article-envoyer [--publier]`, `article-publier`,
  `article-depublier` (design D9) ; `NAMORAMA_JETON_ARTICLES` obligatoire,
  `NAMORAMA_API_URL` par défaut `https://api.namorama.com`.
  Vérification : contre l'API du worktree — lire → envoyer sans changement : aucune
  révision ; envoi d'un lien cassé : sortie non nulle, adresse citée, base inchangée ;
  sans variable : échec qui la nomme, aucun appel réseau.
- [ ] 5.2 `just article-importer <dossier>` : envoi de chaque fichier en brouillon, puis
  publication de tous les chemins en un appel (D10).
  Vérification : sur la base du worktree, import des 31 fichiers ; `GET /articles` en
  rend 22 au 23/11/2026 (les 9 programmés absents), l'admin en liste 31 ; un second
  import ne crée aucune révision.
- [ ] 5.3 Réécrire `docs/ecrire-un-article.md` : écrire depuis l'administration, avec
  Claude (jeton, commandes, `# revision`), programmer, conflits, restaurer ; retirer le
  circuit GitHub/PR/déploiement. Supprimer de la section « Blog » de `CLAUDE.md`
  ce qui décrivait le circuit par fichiers.
  Vérification : chaque commande citée exécutée telle qu'écrite contre l'API du worktree.

## 6. Rendu serveur du blog (web)

- [ ] 6.1 `angular.json` en `outputMode: "server"` ; `blog`, `blog/:slug` et les 18
  `CHEMINS_HISTORIQUES` en `RenderMode.Server` ; les autres routes inchangées.
  Vérification : `npm run build` produit `browser/` (accueil, `/en`, pages légales,
  `/verifier-disponibilite-nom-de-marque` toujours prérendus) et `server/server.mjs`.
- [ ] 6.2 `ArticlesService` web (URL interne côté serveur via `API_INTERNE_URL`,
  `config.apiUrl` côté navigateur, `TransferState`) ; registre, index, en-tête et
  `ArticleMarkdownComponent` alimentés par l'API au lieu de `articles.generes.ts` ;
  l'entrée écrite à la main de `/verifier-disponibilite-nom-de-marque` conservée et
  fusionnée à l'index.
  Vérification : `npm test` (specs des composants du blog adaptées à un service simulé) ;
  au navigateur, une navigation interne entre deux articles ne recharge pas la page et
  ne rappelle pas l'API pour la première page servie.
- [ ] 6.3 Statuts : `/blog/<inconnu>` → 404 (`RESPONSE_INIT`) ; API injoignable → 503 +
  `Retry-After: 120` et `blog_source_unavailable` journalisé.
  Vérification : `curl -sI` sur le service local — 404 pour `/blog/brief-de-namming` ;
  API arrêtée : 503 sur `/guides/trouver-nom-entreprise` et sur `/blog`.
- [ ] 6.4 Dictionnaires i18n lus à côté du bundle serveur, pas sous `process.cwd()`.
  Vérification : `node dist/namorama-web/server/server.mjs` lancé depuis `/tmp` rend un
  article sans clé brute (`grep -c 'BLOG\.' ` = 0 dans le HTML).
- [ ] 6.5 `sitemap.xml` servi par `server.ts` : gabarit `public/sitemap.xml` (marqueurs
  conservés) complété par `GET /articles` ; 503 si l'API manque.
  Vérification : `curl` local — articles parus présents avec `lastmod`, brouillon et
  article programmé absents, `/guides` absent.
- [ ] 6.6 Retirer `web/scripts/articles.mjs`, `articles.test.mjs`, les hooks
  `prebuild` / `prestart` / `pretest`, `articles.generes.ts` et la dépendance `marked`
  du web ; test de cohérence entre `CHEMINS_HISTORIQUES` (web), la liste de l'API et
  `CHEMINS_DU_SITE` d'une part, les routes de `app.routes.ts` d'autre part.
  Vérification : `npm test` et `npm run build` passent sur un dépôt neuf
  (`git clean -xfd web/src` puis build) ; le test échoue si l'on retire une adresse
  d'une des listes.
  Les fichiers de `web/src/content/articles/` ne sont supprimés qu'à la tâche 9.6.
- [ ] 6.7 `CLAUDE.md` : section « Pages prérendues » et « Blog » — ce qui reste prérendu,
  ce qui est rendu à la demande, `API_INTERNE_URL`, règle 503.
  Vérification : relecture.

## 7. Images, nginx et CI

- [ ] 7.1 `web/Dockerfile` : cible `ssr` (Node, `dist/` + `server.mjs`, `TZ=Europe/Paris`,
  port 4000) à côté de l'image nginx ; `docker-publish.yml` construit et pousse
  `namorama-blog` ; le job « Système de design » bloque les deux images.
  Vérification : `docker build --target ssr web` et `docker build web` passent en local ;
  CI verte sur la PR avec les trois images.
- [ ] 7.2 `web/nginx.conf` : `location` du blog, des 18 adresses historiques et de
  `/sitemap.xml` relayées à `blog:4000` par variable + `resolver 127.0.0.11` ; règle du
  slash final reprise sous `/blog/` ; aucune autre `location` modifiée.
  Vérification : `infra/docker-compose.yml` local avec un service `blog` —
  `curl -sI` : `/guides` 301 → `/blog`, `/blog/` 301 → `/blog`, `/namorama-vs-looka`
  200, `/app` servi par nginx (coquille), `/rapport/x` avec `X-Robots-Tag` ; nginx
  démarre service `blog` arrêté, et le blog répond alors 502/503 sans toucher `/`.
- [ ] 7.3 `infra/docker-compose.yml` et recettes `just start` / `agent-start` : le dev
  passe par `ng serve` (rendu serveur intégré), `API_INTERNE_URL` pointe l'API du
  worktree.
  Vérification : `just agent-start` puis `curl` sur `http://localhost:420N/blog` →
  HTML contenant les titres des articles de la base du worktree.

## 8. Écran « Articles » (web)

- [ ] 8.1 Onglet `/admin/articles` : tableau (chemin, titre, catégorie, état
  brouillon / programmé / publié, date, dernière modification et auteur), bouton
  principal « Nouvel article » ; textes FR/EN.
  Vérification : au navigateur avec les 31 articles importés, en clair et en sombre, à
  390 px et sur bureau.
- [ ] 8.2 Éditeur `/admin/articles/:id` : Markdown et aperçu côte à côte (onglets à
  390 px), vérification regroupée à 500 ms, causes à la place de l'aperçu et
  « Enregistrer » désactivé si invalide ; « Publier » / « Dépublier » secondaires avec
  confirmation ; « Supprimer » pour un brouillon jamais paru.
  Vérification : au navigateur — scénarios « Bloc d'appel à l'action », « Erreur de
  saisie », publication d'un brouillon puis visite de sa page ; clair/sombre,
  390 px/bureau.
- [ ] 8.3 Historique en tiroir avec « Restaurer » ; bandeau de conflit 409 (texte
  conservé, révision et auteur nommés, « Voir la version en ligne »).
  Vérification : au navigateur — conflit provoqué par `just article-envoyer` pendant
  l'édition ; restauration d'une révision antérieure.
- [ ] 8.4 Section « Jetons de rédaction » : liste, création avec valeur montrée une fois
  et « Copier », révocation confirmée.
  Vérification : au navigateur — un jeton créé fonctionne avec `just article-liste`, puis
  refusé après révocation.
- [ ] 8.5 `docs/systeme-de-design.md` §5 : motif « éditeur à aperçu » (disposition,
  bascule à 390 px, bouton principal unique, place des erreurs) avec la décision et
  l'option écartée (design D7).
  Vérification : relecture ; le motif renvoie aux composants réellement employés.
- [ ] 8.6 `just design-check`.
  Vérification : la commande passe sans relever `web/design-reference.json`.

## 9. Parité et intégration

- [ ] 9.1 `web/scripts/comparer-rendus.mjs` : pour une liste d'adresses, compare deux
  origines (texte visible normalisé, `href`, `id` des titres, JSON-LD).
  Vérification : exécuté contre deux origines identiques → aucun écart ; contre une page
  modifiée à la main → l'écart est signalé.
- [ ] 9.2 Parité locale : build prérendu de `main` servi d'un côté, service `blog` sur la
  base importée de l'autre, pour `/blog` et les 22 articles parus.
  Vérification : `comparer-rendus.mjs` — aucun écart ; résultat noté sous la tâche.
- [ ] 9.3 Lisibilité inchangée : trois articles (dont `/namorama-vs-namelix` et un avec
  `trois-risques`) en clair et en sombre, à 390 px et sur bureau, servis par le service.
  Vérification : au navigateur ; contraste des cellules du tableau ≥ 4,5:1 en sombre.
- [ ] 9.4 Robot sans JavaScript : `curl` de `/blog/noms-chatgpt-deja-pris` contient H1,
  titres, `<title>` et `BlogPosting`.
  Vérification : commande et extrait notés sous la tâche.
- [ ] 9.5 Parution à la date : article de test daté du lendemain, horloge du service
  et de l'API avancée (`faketime` ou `TZ` + date de test) au lendemain 0 h 05 Paris.
  Vérification : 404 avant, 200 après, présent sur `/blog` et dans `sitemap.xml`.
- [ ] 9.6 Supprimer `web/src/content/articles/` du dépôt.
  Vérification : `npm run build` et `npm test` passent ; `grep -r content/articles web/
  docs/ CLAUDE.md` ne renvoie plus que l'historique de chantiers archivés.

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
