# Tasks

## 1. Compilation des articles Markdown

- [ ] 1.1 Ajouter `marked` en dépendance de développement de `web/` et écrire
  `web/scripts/articles.mjs` : lecture de `web/src/content/articles/*.md`, validation
  de l'en-tête, conversion, attributs `{#id}` / `{.classe}` sur liste blanche, tableaux
  `compare`, liens externes `target="_blank" rel="noopener"`, typographie française,
  blocs `::: cta` et `::: trois-risques` découpés en segments, temps de lecture, écriture
  de `articles.generes.ts` (ignoré par git).
  Vérification : `web/scripts/articles.test.mjs` (`node --test`) — un cas par erreur de
  la spec (en-tête, catégorie, date, doublon, bloc, attribut, HTML brut, lien interne
  inconnu), la typographie hors code et hors URL, le calcul « 1 100 mots → 5 min ».
- [ ] 1.2 Écrire les lignes d'articles de `web/public/sitemap.xml` entre deux marqueurs.
  Vérification : test du script ; `articles.spec.ts` existant reste vert.
- [ ] 1.3 Brancher `prebuild`, `prestart`, `pretest` dans `web/package.json`.
  Vérification : `npm run build` depuis un dépôt propre (fichier généré absent) ;
  build de l'image en CI sur la PR.

## 2. Composant générique et routes dérivées

- [ ] 2.1 Composant `ArticleMarkdownComponent` : en-tête existant, segments HTML et
  blocs, `applyContentSeo` depuis l'en-tête du fichier, interception des clics internes.
  Vérification : test unitaire (segments dans l'ordre, clic interne → routeur, clic avec
  Ctrl laissé au navigateur) ; au navigateur, un lien interne ne recharge pas la page.
- [ ] 2.2 `articles.ts` fusionne les articles générés et l'entrée écrite à la main de
  `/verifier-disponibilite-nom-de-marque` ; routes et prérendu dérivés de la liste.
  Vérification : `articles.spec.ts` (routes, prérendu, tri, plan du site) ;
  `npx ng test --watch=false`.
- [ ] 2.3 Migrer un premier article (`/blog/deposer-marque-inpi-prix-delais`) et
  outiller la comparaison avant/après : texte visible, `href`, `id` des titres, JSON-LD
  des pages prérendues.
  Vérification : script de comparaison sans différence ; page vue au navigateur à 390 px
  et sur bureau, en clair et en sombre.
- [ ] 2.4 `just design-check`.

## 3. Migration des articles

- [ ] 3.1 Convertir les 20 autres articles textuels (premier jet scripté, relu à la
  main), supprimer leurs composants et leurs entrées de registre.
  Vérification : comparaison avant/après sans différence non justifiée, différences
  justifiées notées ici ; 27 routes prérendues ; `npx ng test --watch=false`.
- [ ] 3.2 `just design-check` ; `just design-resserrer` si des styles en ligne ont
  disparu, et committer `web/design-reference.json`.

## 4. Documentation

- [ ] 4.1 `docs/ecrire-un-article.md` : en-tête, blocs, attributs, typographie, ajout
  et correction depuis l'éditeur web de GitHub, prévisualisation locale, publication.
  Section « Blog » du `CLAUDE.md` réécrite (un article = un fichier).
  Vérification : un article d'essai écrit en suivant le guide seul compile, puis est
  retiré.

## 5. Livraison

- [ ] 5.1 PR, CI verte, fusion, déploiement de l'image `web`.
- [ ] 5.2 Production : `/blog` liste 22 articles ; trois articles pris dans des catégories
  différentes répondent 200 avec leur `BlogPosting` ; `/guides` répond 301 ; le texte
  servi égale celui d'avant la livraison.

## Workflow follow-up

- [ ] Première correction réelle faite depuis l'éditeur web de GitHub, jusqu'à la
  production : noter le délai et les accrocs.
- [ ] Archiver après `articles-en-blog`, qui crée la capacité `blog`.
