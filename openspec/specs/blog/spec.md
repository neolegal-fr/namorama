# blog Specification

## Purpose
Présenter les contenus éditoriaux du site comme un blog daté et signé, consultable depuis
un index unique, sans changer l'adresse des articles déjà publiés.
Chaque article textuel s'écrit dans un fichier Markdown du dépôt, d'où le site dérive sa
page, son adresse, son index et son plan ; et il se lit dans les deux thèmes de
l'application.

## Requirements

### Requirement: Index du blog
Le site SHALL servir à `/blog` une page prérendue listant tous les articles du registre,
du plus récent au plus ancien, chacun avec sa catégorie, son titre, son extrait, sa date
de publication et son temps de lecture.

#### Scenario: Article le plus récent en tête
- **WHEN** le registre contient un article publié le 23/11/2026 et un autre le 03/09/2026
- **THEN** l'article du 23/11/2026 apparaît en premier sur `/blog`

#### Scenario: Filtre par catégorie
- **WHEN** le visiteur choisit la catégorie « Secteurs »
- **THEN** seuls les articles de cette catégorie restent affichés, et « Tous » les rétablit

### Requirement: Ancienne adresse de l'index
Une requête sur `/guides` SHALL recevoir une redirection permanente (301) vers `/blog`.
Les adresses `/guides/…` des articles SHALL continuer de répondre 200.

#### Scenario: Ancien lien vers l'index
- **WHEN** un robot demande `/guides`
- **THEN** il reçoit une 301 vers `/blog`

#### Scenario: Ancien article
- **WHEN** un robot demande `/guides/trouver-nom-de-marque`
- **THEN** la page prérendue de l'article répond 200

### Requirement: En-tête d'article
Chaque article du registre SHALL afficher un fil d'Ariane Accueil › Blog › catégorie, le
nom de l'auteur, sa date de publication, sa date de mise à jour quand elle diffère, et
son temps de lecture.

#### Scenario: Article mis à jour
- **WHEN** un article publié le 10/06/2026 a été mis à jour le 03/09/2026
- **THEN** l'en-tête affiche « Publié le 10 juin 2026 · mis à jour le 3 septembre 2026 »

### Requirement: Données structurées d'article
Chaque article du registre SHALL porter, dans le HTML prérendu, un objet `BlogPosting`
(titre, description, `datePublished`, `dateModified`, auteur, éditeur, URL) et une balise
`article:published_time`. Un balisage déjà propre à la page (`FAQPage`) SHALL être
conservé à côté.

#### Scenario: Article prérendu
- **WHEN** le HTML prérendu de `/generateur-nom-de-marque` est lu
- **THEN** il contient un `BlogPosting` daté du 03/09/2026 signé Nicolas Riousset, et la balise `article:published_time` vaut `2026-09-03`

#### Scenario: Page qui déclare déjà un balisage
- **WHEN** une page du registre déclare un `FAQPage` dans `applyContentSeo`
- **THEN** le JSON-LD émis est un `@graph` contenant le `BlogPosting` et ce `FAQPage`

### Requirement: Plan du site
Le plan du site SHALL lister `/blog` et chaque article du registre, et SHALL NOT lister
`/guides`.

#### Scenario: Nouvel article
- **WHEN** un article est ajouté au registre
- **THEN** son adresse figure dans `sitemap.xml` avec sa date de mise à jour en `lastmod`

### Requirement: Un article, un fichier
Chaque article textuel du blog SHALL être décrit par un unique fichier Markdown de
`web/src/content/articles/`, dont l'en-tête porte son chemin, son titre de page, sa
description, son titre et son extrait d'index, sa catégorie et ses dates de publication
et de mise à jour. Le site SHALL en dériver la route, la page prérendue, l'entrée de
l'index du blog, l'en-tête d'article, les données structurées et la ligne du plan du
site.

#### Scenario: Ajout d'un article
- **WHEN** un fichier `nom-de-restaurant.md` déclarant `path: /blog/nom-de-restaurant`,
  catégorie « Secteurs », publié le 01/12/2026, est ajouté puis le site construit
- **THEN** `/blog/nom-de-restaurant` est prérendue, apparaît en tête de `/blog`, porte un
  `BlogPosting` daté du 01/12/2026 et figure dans `sitemap.xml` avec ce `lastmod`,
  sans qu'aucun autre fichier ait été modifié

#### Scenario: Correction d'un texte
- **WHEN** l'auteur corrige une phrase de `deposer-marque-inpi-prix-delais.md` et passe
  `misAJour` au 05/12/2026
- **THEN** la page prérendue porte la phrase corrigée et « mis à jour le 5 décembre 2026 »

### Requirement: Temps de lecture calculé
Le temps de lecture d'un article Markdown SHALL être calculé à la compilation, à raison
de 220 mots par minute, arrondi à la minute supérieure.

#### Scenario: Article de 1 100 mots
- **WHEN** le texte d'un article compte 1 100 mots
- **THEN** son en-tête et sa carte d'index indiquent « 5 min de lecture »

### Requirement: Compilation qui refuse un article invalide
La construction du site SHALL échouer, en nommant le fichier et la cause, quand un
article a un en-tête incomplet, une catégorie inconnue, une date non ISO, une date de
mise à jour antérieure à sa publication, un chemin déjà pris, un bloc ou un attribut
inconnu, du HTML brut, ou un lien interne vers une adresse que le site ne sert pas.

#### Scenario: Lien interne cassé
- **WHEN** un article contient `[le guide](/guides/trouver-un-nom-de-marque)` alors que
  le site sert `/guides/trouver-nom-de-marque`
- **THEN** la construction échoue en citant le fichier et l'adresse inconnue

#### Scenario: Catégorie mal orthographiée
- **WHEN** un article déclare `categorie: Secteur`
- **THEN** la construction échoue en listant les catégories admises

### Requirement: Blocs réutilisables
Un article Markdown SHALL pouvoir insérer l'appel à l'action et le bloc « trois
risques » par un bloc `::: cta` ou `::: trois-risques`, rendus par les composants
existants, à l'endroit où ils figurent dans le texte.

#### Scenario: Appel à l'action au milieu d'un article
- **WHEN** un article place un bloc `::: cta label="Tester un nom"` entre deux sections
- **THEN** la page affiche le bouton « Tester un nom » menant à `/app` entre ces deux
  sections

### Requirement: Typographie française
La compilation SHALL insérer une espace insécable avant `:`, `;`, `!`, `?` et à
l'intérieur des guillemets français, sauf dans le code et les adresses.

#### Scenario: Ponctuation haute
- **WHEN** le Markdown contient `Combien coûte un dépôt de marque ?`
- **THEN** le HTML contient une espace insécable entre « marque » et « ? »

### Requirement: Rendu inchangé par la migration
La migration des articles existants vers Markdown SHALL laisser identiques, pour chaque
article, le texte visible de la page prérendue, les adresses de ses liens, les
identifiants de ses titres et ses données structurées.

#### Scenario: Article migré
- **WHEN** `/guides/trouver-nom-de-marque` est prérendue avant et après la migration
- **THEN** les deux textes visibles, espaces normalisés, sont égaux, et l'ancre
  `#methode` existe toujours

### Requirement: Navigation interne sans rechargement
Un clic sur un lien interne d'un article Markdown SHALL naviguer dans l'application sans
recharger la page, tandis que le HTML prérendu SHALL porter le lien comme une adresse
ordinaire.

#### Scenario: Lien vers un autre article
- **WHEN** le visiteur clique sur « Recherche d'antériorité de marque » dans un article
- **THEN** l'article visé s'affiche sans nouveau chargement de l'application

### Requirement: Articles lisibles dans les deux thèmes
Le texte d'un article — titres, chapeau, corps, signature, fil d'Ariane, tableaux, appel à
l'action et bloc « trois risques » — SHALL suivre le thème résolu de l'application et
atteindre un contraste d'au moins 4,5:1 sur son fond, en clair comme en sombre.

#### Scenario: Système en mode sombre
- **WHEN** un visiteur dont le système est en mode sombre ouvre `/namorama-vs-namelix`
- **THEN** le titre de l'article, ses titres de section et les cellules de son tableau
  ont un contraste d'au moins 4,5:1 sur le fond sombre de la page

#### Scenario: Comparatif en mode clair
- **WHEN** un visiteur en mode clair lit le tableau de `/namorama-vs-namelix`
- **THEN** les cellules « Oui » et « Non » ont un contraste d'au moins 4,5:1

#### Scenario: Appel à l'action en mode sombre
- **WHEN** un visiteur en mode sombre atteint l'encart « Lancer une recherche gratuite »
- **THEN** l'encart prend la surface d'accent sombre, et non un fond vert clair
