# Proposal

## Why

Les articles du blog sont du code. Relevé le 23/11/2026, après la livraison du chantier
`articles-en-blog` :

- 22 articles, dont 21 sont de purs textes : leur prose est écrite dans le gabarit d'un
  composant Angular (`web/src/app/components/content/guide-nom-de-marque.ts`,
  `deposer-marque-inpi.ts`, …), 3 912 lignes de TypeScript au total. Corriger une
  coquille demande d'ouvrir un éditeur de code, de respecter la syntaxe des gabarits
  (`&nbsp;`, `routerLink`, échappement des accolades) et de recompiler.
- Ajouter un article touche **cinq fichiers** : le composant, le registre
  (`articles.ts`), `app.routes.ts`, `app.routes.server.ts` et `sitemap.xml`. Le test
  `articles.spec.ts` existe précisément parce qu'on en oublie un.
- Les métadonnées d'un article (titre, extrait, dates) vivent dans `articles.ts`, loin de
  son texte : une mise à jour du texte sans mise à jour de `misAJour` passe inaperçue.
- L'auteur souhaite pouvoir modifier les articles « en ligne ». Un éditeur en base a été
  écarté le 23/11/2026 (voir design) : le site de production est du HTML prérendu servi
  par nginx, et c'est ce HTML que lisent les moteurs. Le compromis retenu est un fichier
  Markdown par article dans le dépôt, modifiable depuis l'éditeur web de GitHub.

## What Changes

- **Un fichier Markdown par article** (`web/src/content/articles/*.md`), avec un en-tête
  (front matter) portant chemin, titre de page, description, titre et extrait de l'index,
  catégorie, dates de publication et de mise à jour.
- **Une compilation au build** (`web/scripts/articles.mjs`) : elle lit les fichiers,
  valide les en-têtes et les liens internes, convertit le Markdown en HTML et produit un
  module TypeScript généré (non versionné) consommé par l'application. Elle échoue, en
  nommant le fichier et la ligne, sur toute erreur.
- **Un composant d'article générique** qui affiche l'en-tête existant
  (`<app-article-entete>`), le HTML compilé et les blocs réutilisables : appel à l'action
  (`app-article-cta`) et « trois risques » (`app-trois-risques`), insérés par une
  syntaxe de bloc dédiée.
- **Les routes, le prérendu, le registre et le plan du site sont dérivés des fichiers** :
  ajouter un article = ajouter un fichier `.md`.
- **Typographie française automatique** : espaces insécables avant `: ; ! ?` et dans les
  guillemets, appliquées à la compilation.
- **Migration des 21 articles textuels**, au texte près : le texte visible de chaque page
  prérendue est comparé avant et après.
- Documentation : comment écrire et publier un article (section du `CLAUDE.md` et guide
  `docs/ecrire-un-article.md`).

Hors périmètre :

- Aucun éditeur dans `/admin`, aucune table en base, aucun rendu serveur à la requête.
- `/verifier-disponibilite-nom-de-marque` reste un composant : la page embarque un
  vérificateur interactif. Elle garde son entrée de registre, écrite à la main.
- Le déploiement automatique de l'image `web` après une fusion sur `main` : il change la
  discipline de livraison décrite dans `CLAUDE.md` (« un merge à la fois ») et relève d'un
  chantier à part. Publier un article reste : fusion, build, commande de déploiement.
- Aucun changement visible : même rendu, mêmes adresses, mêmes données structurées.
- Pas de version anglaise, de flux RSS ni d'images propres aux articles.

## Impact

- `web/src/app/components/content/` : 21 composants d'article supprimés, un composant
  générique ajouté ; `articles.ts` ne garde que les types, les fonctions et l'entrée de
  la page interactive.
- `web/src/app/app.routes.ts`, `app.routes.server.ts` : routes d'articles générées.
- `web/public/sitemap.xml` : les articles y sont écrits par la compilation.
- `web/package.json` : dépendance de build `marked` ; scripts `prebuild`, `prestart`,
  `pretest`. Le `Dockerfile` appelle déjà `npm run build`.
- Interface : aucun changement visible ; le rendu réutilise les styles `.article`,
  `.lead`, `.compare`, `.yes`/`.no` de `styles.css` et les composants existants
  (docs/systeme-de-design.md §1, règles ; aucun motif nouveau).
