# Écrire un article du blog

Un article = un fichier Markdown dans `web/src/content/articles/`. Le nom du fichier
n'a pas d'importance ; l'adresse de la page est celle du champ `path`. Au build, le
fichier devient une page prérendue, une carte de l'index `/blog`, une ligne du plan du
site et des données structurées `BlogPosting`. Aucun autre fichier à toucher.

## Corriger ou publier depuis github.com

1. Ouvrir le fichier sur GitHub (`web/src/content/articles/…`), cliquer sur le crayon.
   Pour un nouvel article : **Add file → Create new file** dans ce dossier.
2. Écrire ; mettre à jour `misAJour` si le changement compte pour le lecteur (pas pour
   une coquille).
3. **Commit changes → Create a new branch… → Propose changes**, puis ouvrir la PR.
4. La CI construit le site : une erreur dans l'article la fait échouer, avec le nom du
   fichier et la cause (voir « Erreurs » plus bas). Corriger dans la même branche.
5. Fusionner, attendre le build de `main`, puis déployer l'image web :
   `ssh namorama-prod "cd /var/snap/docker/common/namorama && docker compose pull web && docker compose up -d web"`.

## Programmer un article

Un article dont la date `publie` n'est pas encore venue (à l'heure de Paris) **n'est pas
compilé** : ni page, ni carte dans l'index, ni ligne dans le plan du site. On peut donc
fusionner une série entière d'avance ; chaque article paraît à sa date.

- **L'article paraît au premier déploiement de l'image web qui suit sa date.** Le site est
  du HTML prérendu : la date est évaluée au build, pas à la visite. Aucune tâche planifiée
  ne reconstruit le site ; si rien n'est déployé pendant une semaine, l'article attend.
  Pour le publier le jour dit, déployer l'image web ce jour-là (commande ci-dessus).
- **Ne renvoyer qu'aux articles déjà parus**, ou parus le même jour. Un lien vers un
  article programmé plus tard fait échouer la compilation (voir « Erreurs »). Pour
  qu'un ancien article renvoie à un nouveau, le modifier après la parution.
- **Relire la série avant de fusionner** : `ARTICLES_JUSQU_AU=2027-02-01 npm start`
  compile tout ce qui est programmé jusqu'à cette date. Ne pas committer le
  `sitemap.xml` produit ainsi : relancer `node scripts/articles.mjs` sans la variable.
- **Vérifier une parution** : après le déploiement, l'adresse de l'article répond 200 et
  il figure sur `/blog`.

## L'en-tête

Entre deux lignes `---`, en tête de fichier. Les huit champs sont obligatoires.

```yaml
---
path: /blog/nom-de-restaurant
title: "Nom de restaurant : trouver un nom qui donne faim (et libre)"
description: "Comment trouver un nom de restaurant disponible : …"   # ≈ 150 caractères
titre: Trouver un nom de restaurant
extrait: Une ou deux phrases pour la carte de l'index.
categorie: Secteurs
publie: 2026-12-01
misAJour: 2026-12-01
---
```

- `path` : l'adresse. **Ne jamais modifier celle d'un article publié** : elle est
  indexée. Les nouveaux articles vont sous `/blog/…`.
- `title` et `description` : onglet du navigateur et résultat Google (« — Namorama » est
  ajouté). `titre` et `extrait` : la carte de l'index.
- `categorie` : `Méthode`, `Secteurs`, `Marque & droit`, `Générateurs` ou `Comparatifs`.
- Dates au format `AAAA-MM-JJ`.
- Une valeur qui contient « `: ` » ou commence par un guillemet se met entre guillemets
  doubles ; un guillemet double à l'intérieur s'écrit `\"`.

Le temps de lecture est calculé ; l'auteur affiché est celui du site.

## Le corps

La première ligne est le titre de l'article : `# Titre`. Ensuite, du Markdown ordinaire :
`## Section`, `### Sous-section`, `**gras**`, `*italique*`, `` `.com` ``, listes,
tableaux.

```markdown
# Nom de restaurant : trouver un nom qui donne faim

Le chapeau, en plus grand. {.lead}

## Pourquoi c'est difficile {#pourquoi}

| Nom | .fr | .com |
|---|---|---|
| bonappetit | Pris {.no} | Pris {.no} |
| ma-trouvaille | Libre {.yes} | Pris {.no} |

Voir [notre méthode](/guides/trouver-nom-de-marque#methode) et la
[page de l'INPI](https://www.inpi.fr/…).
```

- **Attributs** en fin de paragraphe, de titre ou de cellule, entre accolades :
  `{#identifiant}` (cible d'une ancre), `{.lead}` (chapeau), `{.yes}` / `{.no}`
  (cellule verte / grisée). Rien d'autre.
- **Liens** : `/…` pour une page du site (vérifiée au build), `https://…` pour l'extérieur
  (ouvert dans un nouvel onglet), `mailto:…`.
- **Pas de HTML** : une balise fait échouer le build.
- **Typographie** : écrire les espaces normalement (`marque ?`, `« Oui »`, `190 €`) ;
  la compilation les rend insécables, et met « 1er » en exposant. Pour une insécable
  ailleurs (`23&nbsp;novembre`), écrire `&nbsp;`.

## Les blocs

```markdown
::: cta heading="Vérifiez votre nom avant de payer le dépôt" label="Tester un nom"
Domaines, marques INPI et EUIPO : en une saisie.
:::

::: trois-risques
Une phrase d'introduction propre à l'article.
:::
```

- `cta` : l'encart vert qui mène à la recherche. Le texte est la phrase sous le titre ;
  `heading` et `label` (le bouton) sont facultatifs.
- `trois-risques` : le bloc domaine / réseaux / marque. Le texte est son introduction ;
  `heading` est facultatif.

## Règles éditoriales

- Ne jamais citer telle quelle la description d'un utilisateur, ni son nom ou sa ville :
  paraphraser.
- Un chiffre mesuré (registre, base de données) porte sa date : « relevé le 23/11/2026 ».
- Une source officielle se cite par un lien, avec sa date de consultation.

## Prévisualiser en local

```bash
cd web
node scripts/articles.mjs   # compile et signale les erreurs, en une seconde
npm start                   # puis http://localhost:4200/<path>
```

## Erreurs

La compilation s'arrête au premier problème, en nommant le fichier :

| Message | Cause |
|---|---|
| `champ d'en-tête manquant : extrait` | un des huit champs manque |
| `catégorie inconnue « Secteur »` | faute de frappe ; les catégories admises sont listées |
| `publie doit être une date AAAA-MM-JJ` | date mal écrite ou impossible (30 février) |
| `misAJour (…) antérieure à publie` | dates inversées |
| `path … déjà déclaré par …` / `déjà servi` | adresse prise par un autre article ou une page |
| `lien interne vers une adresse que le site ne sert pas` | lien `/…` faux |
| `lien vers …, article programmé le …` | renvoi vers un article pas encore paru |
| `ARTICLES_JUSQU_AU doit être une date AAAA-MM-JJ` | variable de prévisualisation mal écrite |
| `HTML brut interdit` | une balise `<…>` dans le texte |
| `attribut non autorisé` | `{…}` autre que `#id`, `.lead`, `.yes`, `.no` |
| `bloc inconnu` / `jamais fermé` | bloc `:::` mal écrit ou sans `:::` final |

Le compilateur et ses tests : `web/scripts/articles.mjs`, `web/scripts/articles.test.mjs`.
