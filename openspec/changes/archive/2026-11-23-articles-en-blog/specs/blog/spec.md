# Spec Delta

## Purpose

Présenter les contenus éditoriaux du site comme un blog daté et signé, consultable depuis
un index unique, sans changer l'adresse des articles déjà publiés.

## ADDED Requirements

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
