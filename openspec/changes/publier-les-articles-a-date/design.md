# Design

## Contexte

Avec `articles-en-markdown`, un article est un fichier `web/src/content/articles/*.md`
compilé au build par `web/scripts/articles.mjs`, qui produit la liste des articles
(routes, prérendu, index) et les lignes d'articles de `sitemap.xml`. Le site de
production est du HTML prérendu servi par nginx : un article n'existe pour un visiteur
ou un robot que s'il figure dans l'image `web` déployée.

L'image `web` est construite par `.github/workflows/docker-publish.yml` à chaque push sur
`main`, poussée sous `latest` et sous le SHA du commit, puis tirée à la main sur le
serveur (`docker compose pull api web && docker compose up -d api web`).

## Décisions

### 1. La date décide au build, pas à l'affichage

Un article dont `publie` est postérieur à la date du build n'est pas compilé du tout.

- **Écarté : prérendre tous les articles et les masquer à l'affichage.** Le HTML
  prérendu d'un article programmé serait servi à qui devine l'adresse, le plan du site
  est un fichier statique, et l'index prérendu les listerait aux robots, qui ne
  s'arrêtent pas au JavaScript.
- La date du build est celle de **Paris** (`Intl.DateTimeFormat` avec
  `timeZone: 'Europe/Paris'`), pas celle du processus : le runner GitHub est en UTC, et
  `CLAUDE.md` fait de Paris la seule horloge du produit.
- `ARTICLES_JUSQU_AU=AAAA-MM-JJ` remplace cette date pour une prévisualisation locale.
  Le build de l'image ne la pose jamais.

### 2. Un lien vers un article programmé est une erreur, pas un lien mort

Un article ne peut citer qu'un article publié au plus tard le même jour que lui. La
compilation vérifie déjà que tout lien interne vise une adresse servie ; elle distingue
désormais le cas « article programmé » pour nommer sa date dans le message
(`lien vers /blog/… programmé le 2026-12-14`).

- **Écarté : retirer le lien à la compilation tant que la cible n'est pas parue.** Le
  texte qui l'entoure (« voir notre comparatif ») perdrait son sens sans que personne
  ne relise la page.
- Conséquence pour l'écriture d'une série : chaque article ne renvoie qu'aux articles
  déjà parus et aux précédents de la série. Pour qu'un ancien article renvoie à un
  nouveau, on met à jour l'ancien dans la PR qui suit la parution.

### 3. Parution au déploiement suivant, pas de tâche planifiée

Un article paraît au premier déploiement de l'image `web` qui suit sa date. Décision de
l'utilisateur, le 23/11/2026.

- **Écarté : une reconstruction hebdomadaire** (workflow GitHub le lundi, gardé par la
  date) **et un tirage de l'image par la crontab du serveur.** Il aurait donné une parution
  à jour fixe, mais au prix d'un déploiement automatique de tout le front de `main` et
  d'une modification du serveur de production. Le rythme de livraison actuel (plusieurs
  déploiements par semaine en général) rend le retard négligeable.
- **Écarté : filtrer à l'affichage, dans le navigateur.** Les robots lisent le HTML
  prérendu sans exécuter le JavaScript : ils verraient les articles futurs si on les
  prérend, ou une coquille vide le jour venu si on ne les prérend pas (décision 1).
- Conséquence : une semaine sans déploiement retarde l'article. Pour une date qui compte,
  déployer l'image `web` ce jour-là.

## Contrats externes

- Aucune API, aucun événement journalisé, aucun appel au modèle.
- Le plan du site ne liste plus que les articles parus.

## Risques

- **Un article attend si personne ne déploie.** Le contrôle : `/blog` en production après
  chaque déploiement ; la date de l'en-tête reste `publie`, pas le jour du déploiement.
