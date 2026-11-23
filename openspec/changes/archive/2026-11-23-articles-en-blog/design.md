# Design

## Context

Les pages de contenu sont des composants standalone prérendus
(`web/src/app/components/content/`), déclarés deux fois : `app.routes.ts` et
`app.routes.server.ts` (`RenderMode.Prerender`). `applyContentSeo` pose titre,
description, canonique, Open Graph et un JSON-LD propre à la page (`FAQPage` sur
plusieurs). Le plan du site (`web/public/sitemap.xml`) est tenu à la main.

## Decisions

### Les URL existantes ne bougent pas ; seul l'index change d'adresse
Le blog est une présentation, pas un déménagement. `/blog` remplace `/guides` (301 posée
par le nginx du conteneur web), les nouveaux articles vivent sous `/blog/…`.

- *Écarté : tout déplacer sous `/blog/…` avec 301.* Dix-neuf redirections pour un gain
  nul : l'adresse d'un article ne dit rien de sa nature à Google, et chaque redirection
  dilue un peu le signal des liens entrants.
- *Écarté : garder `/guides`.* Choix de l'utilisateur le 23/11/2026 : l'index s'appelle
  « blog ».

### Un registre unique, lu par l'en-tête et par `applyContentSeo`
`ARTICLES` (`articles.ts`) porte les métadonnées. L'en-tête trouve son article par
l'URL du routeur ; `applyContentSeo` trouve le sien par `path`. Aucun composant
d'article ne recopie une date.

- *Écarté : passer les métadonnées en `@Input` à chaque article.* Dix-neuf copies d'une
  date, qui divergeraient de l'index à la première retouche.

### Dates tirées de l'historique git
Publication = premier commit du fichier, mise à jour = dernier commit qui touche au
texte. Le temps de lecture est le nombre de mots du gabarit divisé par 220, arrondi au
supérieur.

### JSON-LD : `BlogPosting` ajouté, pas substitué
Aucun article ne déclare aujourd'hui de balisage propre (seul l'accueil porte un `FAQPage`), mais une page qui en déclarerait un le garderait : les deux objets partent dans un
`@graph`. L'auteur est une `Person` (« Nicolas Riousset »), l'éditeur l'`Organization`
Namorama.

### Signature nominative
Choix de l'utilisateur le 23/11/2026 : « Nicolas Riousset, créateur de Namorama ».

- *Écarté : « L'équipe Namorama ».* Un auteur identifiable est un critère de confiance
  pour les contenus de conseil.

### Pas de « articles liés » automatique
Chaque article finit déjà par une section « À lire aussi » choisie à la main. En
ajouter une générée doublerait la liste.

## Contrats

- Nouvelle redirection : `/guides` → `/blog` (301, Location relative).
- Nouvelles routes prérendues : `/blog`, `/blog/nom-entreprise-artisan`,
  `/blog/noms-chatgpt-deja-pris`, `/blog/deposer-marque-inpi-prix-delais`.
- Aucun changement d'API, d'événement journalisé ni de requête au modèle.
