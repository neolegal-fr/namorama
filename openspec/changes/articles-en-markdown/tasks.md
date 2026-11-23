# Tasks

## 1. Compilation des articles Markdown

- [x] 1.1 Ajouter `marked` en dépendance de développement de `web/` et écrire
  `web/scripts/articles.mjs` : lecture de `web/src/content/articles/*.md`, validation
  de l'en-tête, conversion, attributs `{#id}` / `{.classe}` sur liste blanche, tableaux
  `compare`, liens externes `target="_blank" rel="noopener"`, typographie française,
  blocs `::: cta` et `::: trois-risques` découpés en segments, temps de lecture, écriture
  de `articles.generes.ts` (ignoré par git).
  Vérification : `web/scripts/articles.test.mjs` (`node --test`) — un cas par erreur de
  la spec (en-tête, catégorie, date, doublon, bloc, attribut, HTML brut, lien interne
  inconnu), la typographie hors code et hors URL, le calcul « 1 100 mots → 5 min ».
  23/11/2026 : 27 tests passent (`node --test scripts/articles.test.mjs`).
- [x] 1.2 Écrire les lignes d'articles de `web/public/sitemap.xml` entre deux marqueurs.
  Vérification : test du script ; `articles.spec.ts` existant reste vert.
  Test « plan du site » du script vert ; marqueurs posés après `/blog`, la page
  interactive garde sa ligne écrite à la main.
- [x] 1.3 Brancher `prebuild`, `prestart`, `pretest` dans `web/package.json`.
  Vérification : `npm run build` depuis un dépôt propre (fichier généré absent) ;
  build de l'image en CI sur la PR.
  23/11/2026 : `npm run build` avec `articles.generes.ts` supprimé → régénéré, 27 routes
  prérendues ; « Build Web image » vert sur la PR #198.

## 2. Composant générique et routes dérivées

- [x] 2.1 Composant `ArticleMarkdownComponent` : en-tête existant, segments HTML et
  blocs, `applyContentSeo` depuis l'en-tête du fichier, interception des clics internes.
  Vérification : test unitaire (segments dans l'ordre, clic interne → routeur, clic avec
  Ctrl laissé au navigateur) ; au navigateur, un lien interne ne recharge pas la page.
  23/11/2026 : `article-markdown.spec.ts` 3/3. Au navigateur (Chrome, prérendu servi
  localement) : clic sur `/generateur-nom-marque-vetement` depuis l'article INPI → H1 de
  la page visée, marqueur posé sur `window` intact (pas de rechargement).
- [x] 2.2 `articles.ts` fusionne les articles générés et l'entrée écrite à la main de
  `/verifier-disponibilite-nom-de-marque` ; routes et prérendu dérivés de la liste.
  Vérification : `articles.spec.ts` (routes, prérendu, tri, plan du site) ;
  `npx ng test --watch=false`.
  23/11/2026 : `npm test` 96/96 (dont `articles.spec.ts` inchangé, qui couvre désormais
  les routes dérivées).
- [x] 2.3 Migrer un premier article (`/blog/deposer-marque-inpi-prix-delais`) et
  outiller la comparaison avant/après : texte visible, `href`, `id` des titres, JSON-LD
  des pages prérendues.
  Vérification : script de comparaison sans différence ; page vue au navigateur à 390 px
  et sur bureau, en clair et en sombre.
  23/11/2026 : comparaison identique (943 mots, 15 liens, 7 id, JSON-LD, title,
  description, canonical, date). 390 px et 1280 px sans débordement. En sombre, le texte
  des articles est quasi invisible (H1 `rgb(18,23,26)` sur fond `rgb(11,14,16)`) — **déjà
  le cas avant migration** sur tous les articles, pour tout visiteur dont le système est
  en mode sombre : `.article` n'utilise pas les jetons `--nm-app-*`. Hors de ce chantier
  (rendu inchangé exigé), signalé pour un correctif séparé.
- [x] 2.4 `just design-check`.
  23/11/2026 : aucune valeur en dur ajoutée.

## 3. Migration des articles

- [x] 3.1 Convertir les 20 autres articles textuels (premier jet scripté, relu à la
  main), supprimer leurs composants et leurs entrées de registre.
  Vérification : comparaison avant/après sans différence non justifiée, différences
  justifiées notées ici ; 27 routes prérendues ; `npx ng test --watch=false`.
  23/11/2026 : 21 fichiers, 21 compilés sans erreur (aucun lien interne cassé),
  27 routes prérendues, `npm test` 96/96. Comparaison : 17 pages identiques, 4 écarts
  justifiés :
  - `/generateur-nom-de-produit`, `/guides/trouver-nom-entreprise` : `rel` des liens vers
    data.inpi.fr passe de `noopener noreferrer` à `noopener`, comme tous les autres liens
    externes du blog.
  - `/generateur-nom-de-marque` : « 6 min de lecture » au lieu de 5, temps désormais
    calculé sur le texte.
  - `/generateur-nom-saas` : « suffixes. -ify » au lieu de « suffixes.-ify ». Angular
    supprimait l'espace entre `</strong>` et `<code>` ; le Markdown la garde. Correction.
  « 1<sup>er</sup> » (3 articles) : règle typographique ajoutée à la compilation (`1er`
  en exposant dans le corps), testée. Vu au navigateur : bloc « trois risques » et
  exposant (1280 px), tableau oui/non (1280 px), appel à l'action (390 px), sans
  débordement.
- [x] 3.2 `just design-check` ; `just design-resserrer` si des styles en ligne ont
  disparu, et committer `web/design-reference.json`.
  23/11/2026 : aucune valeur en dur ajoutée ; 672 occurrences héritées inchangées (les
  gabarits supprimés n'en portaient pas), pas de resserrement à committer.

## 4. Documentation

- [x] 4.1 `docs/ecrire-un-article.md` : en-tête, blocs, attributs, typographie, ajout
  et correction depuis l'éditeur web de GitHub, prévisualisation locale, publication.
  Section « Blog » du `CLAUDE.md` réécrite (un article = un fichier).
  Vérification : un article d'essai écrit en suivant le guide seul compile, puis est
  retiré.
  23/11/2026 : article d'essai `/blog/nom-de-restaurant` écrit avec les seuls exemples
  du guide (en-tête, chapeau, ancre, tableau oui/non, liens interne et externe, `1er`,
  `&nbsp;`, deux blocs) : compilé du premier coup, insécables vérifiées octet par octet,
  ligne ajoutée au plan du site ; retiré, plan du site revenu à l'identique.

## 5. Livraison

- [x] 5.1 PR, CI verte, fusion, déploiement de l'image `web`.
  23/11/2026 : PR #198 (CI verte), fusionnée, build `main` vert, image `web` déployée.
- [x] 5.2 Production : `/blog` liste 22 articles ; trois articles pris dans des catégories
  différentes répondent 200 avec leur `BlogPosting` ; `/guides` répond 301 ; le texte
  servi égale celui d'avant la livraison.
  23/11/2026 : `/blog` 200 avec 22 cartes ; `/guides` 301 → `/blog` ;
  `/verifier-disponibilite-nom-de-marque` 200 ; plan du site à 27 URL. Les 21 pages
  servies avant et après le déploiement comparées : 17 identiques, et exactement les 4
  écarts justifiés en 3.1.

## Workflow follow-up

- [ ] Première correction réelle faite depuis l'éditeur web de GitHub, jusqu'à la
  production : noter le délai et les accrocs.
- [ ] Archiver après `articles-en-blog`, qui crée la capacité `blog`.
