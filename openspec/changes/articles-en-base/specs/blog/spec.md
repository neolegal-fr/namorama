# Spec Delta — blog

## ADDED Requirements

### Requirement: Un article, une entrée en base
Chaque article textuel du blog SHALL être une entrée de la base portant son chemin, son
titre de page, sa description, son titre et son extrait d'index, sa catégorie, ses dates
de publication et de mise à jour, son état et son corps Markdown. Le site SHALL en
dériver la page, l'entrée de l'index, l'en-tête, les données structurées et la ligne du
plan du site, sans fichier du dépôt ni construction du site.

#### Scenario: Nouvel article publié depuis l'administration
- **WHEN** un administrateur enregistre et publie `/blog/nom-de-restaurant`, catégorie
  « Secteurs », publié le 01/12/2026, et qu'on est le 01/12/2026
- **THEN** `/blog/nom-de-restaurant` répond 200 avec le texte de l'article, apparaît en
  tête de `/blog`, porte un `BlogPosting` daté du 01/12/2026 et figure dans
  `sitemap.xml`, sans qu'aucune image n'ait été reconstruite ni déployée

#### Scenario: Correction d'un texte en ligne
- **WHEN** un administrateur corrige une phrase de `/blog/deposer-marque-inpi-prix-delais`
  et passe la date de mise à jour au 05/12/2026
- **THEN** la visite suivante de la page affiche la phrase corrigée et « mis à jour le
  5 décembre 2026 »

### Requirement: Parution à sa date sans déploiement
Un article publié dont la date de publication est postérieure au jour courant, à l'heure
de Paris, SHALL rester absent du site — page, index, plan du site — jusqu'à ce jour, puis
SHALL y apparaître à la première visite de ce jour, sans déploiement.

#### Scenario: Article programmé un lundi
- **WHEN** l'article `/blog/brief-de-naming`, publié avec la date du 30/11/2026, est
  demandé le 29/11/2026 à 23 h 50, heure de Paris
- **THEN** la page répond 404 et l'article ne figure ni sur `/blog` ni dans `sitemap.xml`

#### Scenario: Le jour venu
- **WHEN** la même adresse est demandée le 30/11/2026 à 0 h 05, heure de Paris
- **THEN** la page répond 200 et l'article figure en tête de `/blog`

### Requirement: Brouillon jamais servi
Un article à l'état brouillon SHALL NOT être servi par une adresse publique, ni figurer
dans l'index ou le plan du site, quelle que soit sa date de publication.

#### Scenario: Brouillon daté du jour
- **WHEN** un brouillon déclarant `/blog/nom-de-boulangerie`, publié le 23/11/2026, est
  demandé le 23/11/2026
- **THEN** la page répond 404

### Requirement: Contenu présent dans le HTML servi
Toute page du blog — index, article — SHALL être servie avec son texte, son `<title>`, sa
description, sa balise canonique et ses données structurées déjà présents dans le HTML de
la réponse, lisibles par un robot qui n'exécute pas JavaScript.

#### Scenario: Robot sans JavaScript
- **WHEN** un robot demande `/blog/noms-chatgpt-deja-pris` sans exécuter de script
- **THEN** le HTML reçu contient le H1 de l'article, ses titres de section, son
  `<title>` et son `BlogPosting`

### Requirement: Adresse d'article inconnue
Une adresse sous `/blog/` qui ne correspond à aucun article servi SHALL répondre avec le
statut 404, et non une page vide en 200.

#### Scenario: Faute de frappe dans un lien
- **WHEN** un visiteur demande `/blog/brief-de-namming`
- **THEN** la réponse a le statut 404

### Requirement: Panne de la source distincte d'une absence
Quand la source des articles ne répond pas, une page du blog ou le plan du site SHALL
répondre 503 avec un en-tête `Retry-After`, et SHALL NOT répondre 404 ni servir un index
vide en 200 : une panne ne doit pas faire désindexer un article.

#### Scenario: API arrêtée pendant un déploiement
- **WHEN** un robot demande `/guides/trouver-nom-entreprise` alors que l'API ne répond pas
- **THEN** la réponse est 503 avec `Retry-After`, et non 404

#### Scenario: Plan du site pendant la panne
- **WHEN** `sitemap.xml` est demandé alors que l'API ne répond pas
- **THEN** la réponse est 503, et non un plan sans articles

### Requirement: Adresses publiées immuables
Le chemin d'un article SHALL NOT pouvoir changer une fois l'article paru. Un nouvel
article SHALL avoir un chemin de la forme `/blog/<identifiant>` ; les adresses
antérieures au blog (`/guides/…`, `/generateur-…`, `/namorama-vs-…`, etc.) SHALL rester
servies à l'identique.

#### Scenario: Renommage d'un article paru
- **WHEN** un administrateur tente de changer le chemin de `/generateur-nom-saas` en
  `/blog/generateur-nom-saas`
- **THEN** l'enregistrement est refusé avec le motif « adresse déjà publiée »

#### Scenario: Ancien chemin à la racine
- **WHEN** un robot demande `/namorama-vs-looka` après la migration
- **THEN** la page de l'article répond 200

#### Scenario: Nouvel article hors du blog
- **WHEN** un brouillon déclare le chemin `/nom-de-restaurant`
- **THEN** l'enregistrement est refusé, le motif indiquant la forme `/blog/<identifiant>`

## MODIFIED Requirements

### Requirement: Index du blog
Le site SHALL servir à `/blog` une page listant tous les articles parus du registre, du
plus récent au plus ancien, chacun avec sa catégorie, son titre, son extrait, sa date
de publication et son temps de lecture. La liste SHALL être celle du moment de la
visite.

#### Scenario: Article le plus récent en tête
- **WHEN** le registre contient un article publié le 23/11/2026 et un autre le 03/09/2026
- **THEN** l'article du 23/11/2026 apparaît en premier sur `/blog`

#### Scenario: Filtre par catégorie
- **WHEN** le visiteur choisit la catégorie « Secteurs »
- **THEN** seuls les articles de cette catégorie restent affichés, et « Tous » les rétablit

#### Scenario: Article dépublié
- **WHEN** un administrateur repasse `/blog/outils-de-naming-pour-agences` en brouillon
- **THEN** la visite suivante de `/blog` ne le liste plus

### Requirement: Ancienne adresse de l'index
Une requête sur `/guides` SHALL recevoir une redirection permanente (301) vers `/blog`.
Les adresses `/guides/…` des articles SHALL continuer de répondre 200.

#### Scenario: Ancien lien vers l'index
- **WHEN** un robot demande `/guides`
- **THEN** il reçoit une 301 vers `/blog`

#### Scenario: Ancien article
- **WHEN** un robot demande `/guides/trouver-nom-de-marque`
- **THEN** la page de l'article répond 200 avec son texte dans le HTML

### Requirement: Données structurées d'article
Chaque article du registre SHALL porter, dans le HTML servi, un objet `BlogPosting`
(titre, description, `datePublished`, `dateModified`, auteur, éditeur, URL) et une balise
`article:published_time`. Un balisage déjà propre à la page (`FAQPage`) SHALL être
conservé à côté.

#### Scenario: Article prérendu
- **WHEN** le HTML servi pour `/generateur-nom-de-marque` est lu
- **THEN** il contient un `BlogPosting` daté du 03/09/2026 signé Nicolas Riousset, et la balise `article:published_time` vaut `2026-09-03`

#### Scenario: Page qui déclare déjà un balisage
- **WHEN** une page du registre déclare un `FAQPage` dans `applyContentSeo`
- **THEN** le JSON-LD émis est un `@graph` contenant le `BlogPosting` et ce `FAQPage`

### Requirement: Plan du site
Le plan du site SHALL lister `/blog` et chaque article paru du registre, au moment de la
demande, et SHALL NOT lister `/guides` ni un brouillon.

#### Scenario: Nouvel article
- **WHEN** un article est publié avec la date du jour
- **THEN** son adresse figure dans `sitemap.xml` à la demande suivante, avec sa date de
  mise à jour en `lastmod`

### Requirement: Temps de lecture calculé
Le temps de lecture d'un article Markdown SHALL être calculé à l'enregistrement, à raison
de 220 mots par minute, arrondi à la minute supérieure.

#### Scenario: Article de 1 100 mots
- **WHEN** le texte d'un article compte 1 100 mots
- **THEN** son en-tête et sa carte d'index indiquent « 5 min de lecture »

### Requirement: Rendu inchangé par la migration
La migration des articles des fichiers Markdown vers la base SHALL laisser identiques,
pour chaque article, le texte visible de la page servie, les adresses de ses liens, les
identifiants de ses titres et ses données structurées.

#### Scenario: Article migré
- **WHEN** `/guides/trouver-nom-de-marque` est servie avant (prérendue) et après (rendue
  depuis la base) la migration
- **THEN** les deux textes visibles, espaces normalisés, sont égaux, et l'ancre
  `#methode` existe toujours

#### Scenario: Toutes les pages migrées
- **WHEN** les 31 articles et `/blog` sont comparés avant et après la migration
- **THEN** aucun texte visible, lien, identifiant de titre ni JSON-LD ne diffère, hormis
  les articles programmés après la date de comparaison, absents des deux côtés

### Requirement: Navigation interne sans rechargement
Un clic sur un lien interne d'un article Markdown SHALL naviguer dans l'application sans
recharger la page, tandis que le HTML servi SHALL porter le lien comme une adresse
ordinaire.

#### Scenario: Lien vers un autre article
- **WHEN** le visiteur clique sur « Recherche d'antériorité de marque » dans un article
- **THEN** l'article visé s'affiche sans nouveau chargement de l'application

## REMOVED Requirements

### Requirement: Un article, un fichier
**Reason**: La source d'un article devient la base, pour qu'il se corrige et se publie
sans PR ni déploiement.
**Migration**: Les 31 fichiers sont importés une fois en base, puis supprimés du dépôt.
Voir « Un article, une entrée en base » et la capacité `redaction-des-articles`.

### Requirement: Compilation qui refuse un article invalide
**Reason**: Il n'y a plus de compilation au build : un article invalide est refusé à
l'enregistrement, avant d'atteindre le site.
**Migration**: Les mêmes contrôles s'appliquent à l'enregistrement — voir « Enregistrement
qui refuse un article invalide » dans `redaction-des-articles`.
