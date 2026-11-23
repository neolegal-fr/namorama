# Écrire un article du blog

Un article est **une entrée en base** : un texte Markdown à en-tête, au format décrit plus
bas. Il devient une page, une carte de l'index `/blog`, une ligne du plan du site et des
données structurées `BlogPosting` — **à la visite suivante, sans déploiement** (chantier
`articles-en-base`). Il s'écrit de deux façons : à la main, dans **Administration →
Articles**, ou par Claude, avec un jeton de rédaction.

## Depuis l'administration

1. **Administration → Articles**, puis un article de la liste, ou **Nouvel article**
   (un gabarit valide est prérempli).
2. Écrire à gauche ; l'aperçu, à droite, est la page telle que le visiteur la verra. Un
   texte invalide affiche ses causes à la place de l'aperçu et ne s'enregistre pas.
3. **Enregistrer** : un nouvel article est un **brouillon**, jamais servi. Un article déjà
   publié est corrigé en ligne aussitôt.
4. **Publier** (enregistrer d'abord) : l'article paraît à sa date `publie`. **Repasser en
   brouillon** le retire du site ; c'est refusé tant qu'un article publié le cite.
5. Mettre à jour `misAJour` quand le changement compte pour le lecteur (pas pour une
   coquille).

**Supprimer** n'existe que pour un brouillon qui n'a jamais paru. Un article paru se
repasse en brouillon : son adresse reste réservée.

## Avec Claude

Claude passe par l'API avec un **jeton de rédaction** et les commandes `just article-*`
(`scripts/article.mjs`).

1. **Administration → Articles → Jetons de rédaction → Créer un jeton**, nommé d'après
   son usage (« Claude Code — poste »). Sa valeur (`nmr_…`) n'est montrée **qu'une fois** ;
   la copier.
2. Dans le terminal où tourne Claude, et jamais dans le dépôt :
   ```bash
   export NAMORAMA_JETON_ARTICLES=nmr_…
   # NAMORAMA_API_URL vaut https://api.namorama.com par défaut ;
   # en local : export NAMORAMA_API_URL=http://localhost:3001
   ```
3. Les commandes, depuis n'importe quel dossier du dépôt :

   | Commande | Effet |
   |---|---|
   | `just article-liste` | état, date, révision et adresse de chaque article |
   | `just article-lire /blog/x fichier.md` | écrit le texte, avec sa ligne `# revision: N` |
   | `just article-verifier fichier.md [--publier]` | causes, ou résumé du rendu (titres, blocs, lecture) ; n'écrit rien |
   | `just article-envoyer fichier.md [--publier]` | sans ligne `# revision` : crée un brouillon ; avec : modifie cette révision |
   | `just article-publier /blog/x [/blog/y…]` | publie (ensemble, s'ils se citent) |
   | `just article-depublier /blog/x` | repasse en brouillon |

   Une commande sort en erreur, avec la cause renvoyée par l'API, et n'écrit rien quand
   l'article est refusé.
4. Pour corriger un article : `article-lire`, modifier le fichier, `article-verifier`,
   `article-envoyer`. Pour en écrire un : partir d'un fichier sans ligne `# revision`,
   `article-verifier`, `article-envoyer`, relire dans l'administration, publier.

Un jeton n'ouvre que les articles, et ne supprime rien. **Le révoquer** dans
l'administration prend effet à la requête suivante. Chaque révision garde le nom du jeton
qui l'a écrite.

## Programmer un article

Un article **publié** dont la date `publie` n'est pas venue (à l'heure de Paris) est
**programmé** : ni page, ni carte dans l'index, ni ligne dans le plan du site. Il paraît
**le jour dit, à minuit, à la première visite** — sans déploiement.

- **Un article ne renvoie qu'à des articles parus le jour où il est servi** : à sa propre
  date s'il est programmé, à aujourd'hui s'il a déjà paru. Un lien vers un brouillon, ou
  vers un article programmé plus tard, fait refuser la publication. Pour qu'un ancien
  article renvoie à un nouveau, le modifier après la parution.
- **Des articles qui se citent l'un l'autre** se publient ensemble :
  `just article-publier /blog/a /blog/b`.
- **Vérifier une parution** : le jour dit, l'adresse répond 200 et l'article figure sur
  `/blog`.

## Conflits et historique

- **Chaque enregistrement garde une révision** (texte complet, auteur, date).
  **Historique**, dans l'éditeur, les liste ; **Restaurer** reprend une ancienne révision
  comme une nouvelle, sans rien effacer.
- **Deux écritures en même temps ne s'écrasent pas.** Un enregistrement cite la révision
  sur laquelle il a été écrit (la ligne `# revision: N` pour Claude). Si l'article a changé
  entre-temps, il est refusé : l'éditeur garde le texte et montre la version en ligne ; la
  commande affiche « révision en ligne : N, par … » — relire l'article, reporter la
  correction, renvoyer.

## L'en-tête

Entre deux lignes `---`, en tête du texte. Les huit champs sont obligatoires. Une ligne
qui commence par `#` y est un commentaire ; `# revision: N`, ajoutée par la lecture, dit
sur quelle révision le texte a été écrit (voir « Conflits »).

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

- `path` : l'adresse, de la forme `/blog/<identifiant>` (minuscules, chiffres, tirets).
  **Elle se fige dès que l'article a paru** : elle est indexée. Seules les adresses
  antérieures au blog (`/guides/…`, `/generateur-…`, `/namorama-vs-…`) y échappent.
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
- **Liens** : `/…` pour une page du site ou un article (vérifié à l'enregistrement),
  `https://…` pour l'extérieur (ouvert dans un nouvel onglet), `mailto:…`.
- **Pas de HTML** : une balise fait refuser l'enregistrement, avec sa ligne.
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

## Erreurs

L'enregistrement et la vérification rendent **toutes** les causes d'un coup :

| Message | Cause |
|---|---|
| `champ d'en-tête manquant : extrait` | un des huit champs manque |
| `catégorie inconnue « Secteur »` | faute de frappe ; les catégories admises sont listées |
| `publie doit être une date AAAA-MM-JJ` | date mal écrite ou impossible (30 février) |
| `misAJour (…) antérieure à publie` | dates inversées |
| `un nouvel article a une adresse de la forme /blog/<identifiant>` | `path` hors de `/blog/` |
| `path … déjà pris par un autre article` / `déjà servi` | adresse prise par un article ou une page |
| `adresse déjà publiée` | changer le `path` d'un article paru |
| `lien interne vers une adresse que le site ne sert pas` | lien `/…` faux |
| `lien vers …, article programmé le …` / `article en brouillon` | renvoi vers un article pas encore paru |
| `ligne N : HTML brut interdit` | une balise `<…>` dans le texte |
| `attribut non autorisé` | `{…}` autre que `#id`, `.lead`, `.yes`, `.no` |
| `bloc inconnu` / `jamais fermé` | bloc `:::` mal écrit ou sans `:::` final |
| `L'article a changé depuis la révision …` (409) | quelqu'un a écrit entre-temps (voir « Conflits ») |
| `… est cité par … : retirer ces liens d'abord` (409) | dépublier un article encore cité |

Le compilateur et ses tests : `api/src/articles/compilateur/`.
