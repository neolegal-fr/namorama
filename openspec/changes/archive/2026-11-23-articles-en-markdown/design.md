# Design

## Contexte

Depuis `articles-en-blog`, chaque article est un composant Angular prérendu, décrit dans
le registre `articles.ts`. Le site est servi en HTML statique par nginx
(`web/nginx.conf`) ; le prérendu (`app.routes.server.ts`, `RenderMode.Prerender`) est ce
qui met le texte dans le HTML que lisent Google et les robots d'IA.

Une seule page d'article a une logique propre : `/verifier-disponibilite-nom-de-marque`
(vérificateur interactif). Les 21 autres n'utilisent que du HTML, `routerLink`,
`<app-article-cta>` (27 occurrences) et `<app-trois-risques>` (19 occurrences), avec les
classes `lead`, `compare`, `yes`, `no` et des identifiants de titres (`<h2 id="…">`)
susceptibles d'être cités en ancre.

## Décisions

### 1. Le texte dans le dépôt, en Markdown — pas en base

Chaque article est un fichier `web/src/content/articles/<slug>.md`, modifiable depuis
l'éditeur web de GitHub ; la fusion sur `main` produit l'image `web`.

- **Écarté : éditeur dans `/admin` et table en base.** Le texte modifié n'atteindrait le
  HTML prérendu qu'après un nouveau build, qu'il faudrait déclencher depuis le serveur ;
  sans cela, les robots continueraient de lire l'ancienne version. Il ouvrirait aussi une
  surface nouvelle : du HTML écrit en ligne, publié tel quel sur le site public.
- **Écarté : rendu serveur à la requête (SSR).** Il remplace nginx par un serveur Node
  pour des corrections de texte, et change l'infrastructure de production.
- **Écarté : CMS hébergé.** Une dépendance et un compte de plus, et le même problème de
  reconstruction.

Le dépôt apporte gratuitement l'historique, la relecture par PR et le retour arrière.

### 2. Compilation au build, pas à l'exécution

`web/scripts/articles.mjs` lit les fichiers, convertit le Markdown en HTML avec `marked`
et écrit `web/src/app/components/content/articles.generes.ts` (ignoré par git). Il est
appelé par `prebuild`, `prestart` et `pretest` ; le `Dockerfile` passe déjà par
`npm run build`.

- **Écarté : importer les `.md` comme texte et les convertir dans le navigateur.** Le
  convertisseur partirait dans le bundle de toutes les pages (≈ 40 ko), et une erreur de
  syntaxe ne se verrait qu'à l'affichage, pas au build.
- **Écarté : versionner le module généré.** Un fichier modifié depuis GitHub sans
  régénération ferait diverger les deux.

La compilation **échoue** (code de sortie ≠ 0, fichier et ligne nommés) sur : en-tête
manquant ou mal formé, catégorie inconnue, date non ISO ou `misAJour` antérieure à
`publie`, chemin en double, bloc inconnu, attribut non autorisé, HTML brut dans le
Markdown, lien interne vers une adresse que le site ne sert pas. Une erreur arrête la CI
de la PR : rien de cassé n'atteint `main`.

### 3. Le fichier est la source unique

L'en-tête du fichier remplace l'entrée du registre et les arguments de `applyContentSeo` :

```yaml
---
path: /guides/trouver-nom-de-marque
title: Trouver un nom de marque disponible en 2026      # <title> et og:title
description: …                                          # meta description
titre: Trouver un nom de marque disponible               # carte de l'index
extrait: La méthode en 5 étapes…
categorie: Méthode
publie: 2026-06-10
misAJour: 2026-09-03
---
# Titre H1 de l'article
```

- Le temps de lecture est **calculé** (mots du texte / 220, arrondi au supérieur) : plus
  rien à tenir à jour à la main.
- Le module généré exporte la liste des articles ; `articles.ts` la fusionne avec
  l'entrée écrite à la main de la page interactive, et garde `articleDe`, `dateLongue`,
  `CATEGORIES` et `AUTEUR`. Index, en-tête et données structurées ne changent pas.
- Routes (`app.routes.ts`) et prérendu (`app.routes.server.ts`) sont **dérivés** de la
  liste. `sitemap.xml` reçoit ses lignes d'articles de la compilation, entre deux
  marqueurs ; le reste du fichier reste écrit à la main.
- **Écarté : dates tirées de git au build.** L'image Docker est construite sans `.git`,
  et un commit de reformatage changerait la date de mise à jour. La date reste une
  décision de l'auteur, que la PR rend visible.

### 4. Les blocs, par une syntaxe de conteneur

Deux blocs réutilisables, insérés par une ligne dédiée :

```markdown
::: cta heading="Vérifiez votre nom avant de payer le dépôt" label="Tester un nom"
Domaines, marques INPI et EUIPO avec les orthographes voisines : en une saisie.
:::

::: trois-risques
Une marque se construit sur trois disponibilités, pas une.
:::
```

Le texte du bloc devient `subheading` (CTA) ou `intro` (trois risques). La compilation
découpe l'article en **segments** — HTML, CTA, trois risques — et le composant générique
les affiche dans l'ordre ; chaque bloc reste le vrai composant Angular.

- **Écarté : insérer les balises `<app-…>` dans le HTML.** Un `innerHTML` n'instancie pas
  de composant Angular : la balise resterait inerte.
- **Écarté : un bloc `verificateur` pour migrer aussi la page interactive.** Son texte
  s'articule avec l'état du vérificateur ; la migrer est un chantier en soi, pour une
  seule page.

### 5. Attributs et typographie

- Identifiants et classes par un suffixe entre accolades, sur liste blanche :
  `## Le calendrier d'un dépôt {#calendrier}`, cellule `Oui {.yes}`. Classes admises :
  `lead`, `yes`, `no`. Le premier paragraphe n'est **pas** `lead` d'office : l'auteur le
  marque, comme aujourd'hui.
- Tout tableau reçoit `class="compare"`, le seul style de tableau des articles.
- Lien externe (`https://…`) : `target="_blank" rel="noopener"` ajoutés à la compilation.
- Typographie française : espace insécable avant `: ; ! ?` et à l'intérieur des
  guillemets `« »`, hors code et hors URL. Les `&nbsp;` des gabarits actuels
  disparaissent donc des sources sans disparaître des pages.
- **HTML brut refusé** dans le Markdown. Écarté : l'autoriser. Ce serait la porte de
  styles en ligne contraires au système de design, et de balises que l'assainisseur
  d'Angular retirerait sans prévenir.

### 6. Affichage et liens internes

Le HTML compilé, produit au build à partir du dépôt, est marqué sûr
(`bypassSecurityTrustHtml`) : sans cela, l'assainisseur d'Angular retire les `id` des
titres. Ce qui le rend acceptable : la source est relue en PR, et la compilation refuse
le HTML brut.

Les liens internes sont des `<a href="/…">` ordinaires : présents tels quels dans le HTML
prérendu. Le composant intercepte le clic (sans touche de modification, bouton gauche)
et navigue par le routeur, pour ne pas recharger l'application.

### 7. Migration vérifiée au texte près

Un script de conversion produit un premier jet de chaque `.md` à partir du gabarit ; il
est relu à la main puis jeté. La vérification compare, pour chaque article, le **texte
visible** de la page prérendue avant et après (espaces normalisés), les `href` des liens,
les `id` des titres et le JSON-LD. Une différence est soit corrigée, soit justifiée sous
la tâche.

## Contrats externes

- Adresses, titres, descriptions, données structurées, plan du site : **inchangés**.
- Aucun appel au modèle, aucun événement journalisé, aucune API modifiée.

## Risques

- **Un article publié depuis GitHub sans relecture du rendu.** Mitigation : la CI de la
  PR exécute la compilation et le build ; le guide d'écriture donne la commande de
  prévisualisation locale.
- **`marked` évolue** et change un rendu. Mitigation : version figée par le
  `package-lock.json`, et le test de non-régression du texte sur un article témoin.
