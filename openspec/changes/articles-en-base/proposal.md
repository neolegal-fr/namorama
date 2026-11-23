# Proposition : les articles du blog en base, modifiables en ligne

## Why

Un article du blog est aujourd'hui un fichier du dépôt, compilé au build : le corriger
ou en publier un demande une PR, la CI, la fusion **et un déploiement de l'image web**
(`docs/ecrire-un-article.md`, « Corriger ou publier depuis github.com », étape 5). Relevé
du 23/11/2026 :

- les 7 commits qui ont touché `web/src/content/articles/` depuis la migration en
  Markdown datent tous de ce jour-là, et chacun n'est visible qu'après un déploiement ;
- **9 articles** de la série « agences » sont programmés, un par lundi du 30/11/2026 au
  25/01/2027. La date de parution est évaluée **au build**
  (`web/scripts/articles.mjs:253`, `dateDePublication`, appelée `:332`) : chacun
  n'apparaîtra qu'au premier déploiement qui suit sa date. Sans déploiement ce lundi-là,
  l'article attend — c'est le compromis accepté le 23/11 faute de mieux ;
- une coquille dans un article en ligne coûte le même circuit qu'une fonctionnalité, et
  publier depuis Claude exige qu'il ouvre une PR sur le code de l'application.

L'utilisateur veut pouvoir corriger un article à la main, depuis l'administration, et
faire publier un nouvel article par Claude, **sans déploiement ni passage par le dépôt**.

## What Changes

- **Les articles vivent en base** (MariaDB) : en-tête (chemin, titres, description,
  extrait, catégorie, dates) et corps Markdown, au même format qu'aujourd'hui. Les 31
  fichiers de `web/src/content/articles/` sont importés une fois, puis **supprimés**
  avec le compilateur de build (`web/scripts/articles.mjs`, `articles.generes.ts`).
  **BREAKING** pour le circuit d'écriture : on n'écrit plus un article dans le dépôt.
- **La compilation passe dans l'API**, à l'enregistrement : mêmes contrôles (en-tête,
  catégorie, dates, HTML brut refusé, blocs `cta` / `trois-risques`, liens internes
  vers une adresse servie), même typographie, même temps de lecture. Un article invalide
  est refusé **à l'enregistrement**, avec la cause, au lieu de faire échouer la CI.
- **Le rendu des pages du blog se fait à la demande** : un service Node (Angular SSR,
  mêmes composants qu'aujourd'hui) rend `/blog`, chaque article et `sitemap.xml` à partir
  de l'API. **nginx reste en frontal, inchangé** pour le reste du site, et ne relaie au
  SSR que ces adresses. Un article enregistré est en ligne à la visite suivante.
- **Un article paraît à sa date, à la visite** et non plus au build : la série programmée
  paraît le lundi dit, sans déploiement.
- **États** : brouillon (jamais servi) ou publié (servi à partir de sa date `publie`).
  Un article publié peut être repassé en brouillon ; son adresse ne change plus dès qu'il
  a paru.
- **Historique** : chaque enregistrement garde une révision (source complète, auteur,
  date) ; une révision antérieure se restaure. C'est ce qui remplace l'historique Git.
- **Écran d'administration « Articles »** (`/admin/articles`) : liste, édition du
  Markdown avec aperçu rendu par les composants du blog, erreurs de compilation
  affichées, publication, dépublication, historique.
- **Jetons d'API de rédaction** : créés et révoqués depuis l'administration, montrés une
  seule fois, conservés hachés, limités aux routes des articles. Ils permettent à Claude
  (ou à un script) de lire, vérifier, enregistrer et publier un article. Une recette
  `just article-*` les emploie depuis le poste.
- Un enregistrement concurrent (Claude et l'éditeur en même temps) est **refusé** plutôt
  qu'écrasé.

**Hors périmètre :**

- les images dans les articles (aucun article n'en contient au 23/11/2026) ;
- un éditeur visuel (WYSIWYG) : on édite le Markdown, avec un aperçu ;
- un serveur MCP pour Claude : le jeton et la recette `just` suffisent ; un MCP pourra
  s'appuyer sur la même API plus tard ;
- la page `/verifier-disponibilite-nom-de-marque`, qui reste un composant prérendu avec
  son entrée écrite à la main dans le registre ;
- le passage du reste du site en rendu serveur, ou le remplacement de nginx ;
- l'hydratation Angular (`provideClientHydration`) : le client re-rend la page comme
  aujourd'hui ;
- un flux RSS, des commentaires, plusieurs auteurs.

## Capabilities

### New Capabilities

- `redaction-des-articles` : écrire, vérifier, publier, dépublier et restaurer un article
  du blog sans déploiement — écran d'administration, révisions, enregistrement
  concurrent, jetons d'API de rédaction et leur usage par Claude.

### Modified Capabilities

- `blog` : la source d'un article n'est plus un fichier du dépôt mais la base ; la
  compilation et ses refus ont lieu à l'enregistrement ; les pages du blog, l'index et le
  plan du site sont rendus à la demande ; un article paraît à sa date sans déploiement.
  Les exigences d'index, d'en-tête, de données structurées, de blocs, de typographie,
  de navigation interne et de lisibilité dans les deux thèmes sont conservées.

## Impact

- **API** : nouveau module `articles` (entités `article`, `article_revision`,
  `jeton_api`), compilateur Markdown porté depuis `web/scripts/articles.mjs` (dépendance
  `marked` côté API), routes publiques de lecture, routes `/admin/articles` (rôle
  `realm:admin`) et `/redaction/articles` (jeton), garde de jeton. Script d'import des
  fichiers existants.
- **Migration SQL** `2026-11-…-articles-en-base.sql`, à appliquer avant l'image ; puis
  import des articles en production, **avant** le déploiement de l'image web qui retire
  les fichiers.
- **Web** : `angular.json` passe de `outputMode: static` à `server` ; les articles, l'index
  et le registre lisent l'API au lieu de `articles.generes.ts` ; routes des articles
  rendues `RenderMode.Server` ; nouvel écran `/admin/articles` et gestion des jetons ;
  suppression de `web/src/content/articles/`, `scripts/articles.mjs`, des hooks
  `prebuild` / `prestart` / `pretest` et des marqueurs de `public/sitemap.xml`.
- **Infra** : une image Node supplémentaire (`namorama-blog`, cible du `web/Dockerfile`)
  construite par `docker-publish.yml` ; un service de plus dans le `docker-compose.yml` de
  prod (non versionné, à reporter à la main) ; `web/nginx.conf` relaie au service les
  adresses du blog, des articles historiques et `/sitemap.xml`.
- **Outillage** : recettes `just article-lire`, `article-verifier`, `article-envoyer` ;
  `docs/ecrire-un-article.md` réécrit (écran d'administration, Claude, programmation) ;
  `CLAUDE.md`, section « Blog », mise à jour.
- **Journalisation** : événements `article_saved`, `article_published`,
  `article_unpublished`, `article_restored`, `api_token_created`, `api_token_revoked`,
  avec l'auteur (`sub` ou identifiant du jeton), jamais le texte.
- **Interface** : écran d'administration, s'appuie sur `docs/systeme-de-design.md` §1
  (règles), §2 (admin dans l'univers applicatif, rôles `--nm-app-*`), §3 (voix), §5
  (boutons, primitives, PrimeNG), §7 (densité tolérée en admin) et §8 (accessibilité).
  Les pages publiques du blog ne changent pas d'apparence. Un motif nouveau — éditeur de
  texte à aperçu côte à côte — est décidé dans `design.md` et ajouté au §5.
