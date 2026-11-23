# Tasks

## 1. Couleurs des articles sur les rôles applicatifs

- [x] 1.1 Remplacer les couleurs de la section « Pages de contenu / articles SEO » de
  `web/src/styles.css` par les rôles du tableau de design.md §1.
  Vérification : script de contraste au navigateur sur `/namorama-vs-namelix`, en clair
  et en sombre, tous les éléments ≥ 4,5:1.
  23/11/2026 : sombre, minimum 7,62:1 hors encart (titres 17,6, chapeau 7,6, cellules
  17,6, « oui » 12,6, « non » 7,6) ; clair, minimum 4,95:1 (« oui »), « non » 5,47.
- [x] 1.2 `app-article-cta` : styles en ligne → feuille du composant, sur les rôles.
  Vérification : même script (titre et phrase de l'encart) ; capture en sombre.
  23/11/2026 : encart en sombre, titre 16,0:1, phrase 6,9:1 ; en clair 17,5 et 5,4.
  Fond `--nm-app-accent-surface` dans les deux thèmes (capture).
- [x] 1.3 Captures en clair et en sombre, à 390 px et sur bureau : un article avec
  tableau, le bloc « trois risques », l'appel à l'action, l'index `/blog`.
  Vérification : relues à l'œil, notées ici.
  23/11/2026 : 20 captures (Chrome, schéma du système) relues : article et tableau
  (`/namorama-vs-namelix`), « trois risques » (`/guides/trouver-nom-de-marque`), encart,
  `/blog` ; aucun débordement à 390 px.
- [x] 1.4 `just design-check`, puis `just design-resserrer` et commit de
  `web/design-reference.json`.
  23/11/2026 : `verifier-design` vert ; resserré de 672 à 664 occurrences (5 styles en
  ligne et 3 couleurs en moins). `npm test` 96/96.

## 2. Livraison

- [ ] 2.1 PR, CI verte, fusion, déploiement de l'image `web`.
- [ ] 2.2 Production : script de contraste sur `https://namorama.com/namorama-vs-namelix`
  en sombre et en clair, tous les éléments ≥ 4,5:1.

## Workflow follow-up

- [ ] Archiver après `articles-en-blog` et `articles-en-markdown`, qui créent puis
  complètent la capacité `blog`.
