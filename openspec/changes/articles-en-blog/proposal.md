# Proposal

## Why

Le site compte 19 pages de contenu écrites pour le référencement (guides, générateurs,
secteurs, comparatifs). Elles sont présentées comme des pages d'outil : aucune date, aucun
auteur, aucun temps de lecture, et un index (`/guides`) qui les range en trois listes
sans ordre. Relevé le 23/11/2026 :

- Aucune page ne porte de date de publication, ni à l'écran ni dans les données
  structurées : `applyContentSeo` (`web/src/app/components/content/content-seo.ts:62`)
  pose un `og:type` « article » sans `article:published_time`, et aucune page n'émet de
  balisage `BlogPosting`. Google ne peut pas dater ces contenus, alors que la fraîcheur
  et l'identité de l'auteur pèsent sur les requêtes de conseil.
- Le fil d'Ariane renvoie vers `/guides` sur 15 pages et vers rien sur 4
  (`guide-nom-de-marque.ts:19`, `comparatif-generateurs.ts:20`, …) : le hub n'est pas
  atteignable depuis toutes les pages.
- Les projets enregistrés en production (218 projets de comptes réels au 22/11/2026)
  font apparaître des demandes qu'aucun article ne traite. Une vingtaine viennent
  d'artisans et de services de proximité (électricité, rénovation, nettoyage,
  conciergerie, micro-crèche, coaching), et une dizaine collent dans la description des
  listes de noms produites par un assistant IA, pour vérifier s'ils sont libres.
- L'autocomplétion Google relevée le 23/11/2026 confirme ces intentions
  (« nom de société de nettoyage », « trouver un nom de marque ia », « dépôt de marque
  inpi prix »).

## What Changes

- Un **blog** à `/blog` : index des articles, du plus récent au plus ancien, avec
  catégorie, date, temps de lecture et filtre par catégorie. `/guides` redirige en 301
  vers `/blog`.
- Un **registre des articles** (`articles.ts`) : chemin, titre, extrait, catégorie, date
  de publication, date de mise à jour, temps de lecture. Il alimente l'index, l'en-tête
  des articles, les données structurées et le plan du site.
- Un **en-tête d'article** sur chaque article : fil d'Ariane Accueil › Blog › catégorie,
  signature « Nicolas Riousset, créateur de Namorama », date de publication (et de mise à
  jour si elle diffère), temps de lecture.
- Des **données structurées `BlogPosting`** et la balise `article:published_time` sur
  chaque article, posées par `applyContentSeo` à partir du registre.
- **Trois articles** sous `/blog/…` : nom d'entreprise d'artisan et de service de
  proximité ; noms proposés par ChatGPT déjà pris ; dépôt de marque INPI (prix, délais,
  opposition). Sources officielles citées.
- Menu, accueil et plan du site pointent vers `/blog`.

Hors périmètre :

- Les URL des articles existants ne changent pas (déjà indexées).
- Pas de flux RSS, de commentaires, de pagination ni de page par catégorie.
- Pas de version anglaise du blog.
- Pas de nouvelle fonctionnalité produit : les besoins non couverts relevés pendant
  l'étude sont rapportés à part, pour un chantier ultérieur.
