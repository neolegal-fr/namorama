# Spec Delta

## Purpose

Faire d'un fichier Markdown du dépôt la source unique d'un article du blog : son texte,
ses métadonnées, son adresse et sa place dans le plan du site, sans changer ce que voient
les visiteurs et les moteurs.

## ADDED Requirements

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
