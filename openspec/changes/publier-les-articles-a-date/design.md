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
  Le workflow ne la pose jamais.

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

### 3. Une reconstruction hebdomadaire, gardée par la date

Le workflow `publier-les-articles.yml` tourne le **lundi à 05:00 UTC** (6 h ou 7 h à
Paris). Il lit les en-têtes des fichiers et ne reconstruit l'image `web` que si un
article a `publie` égal à la date du jour à Paris. Sinon, il s'arrête sans rien
construire : une image reconstruite sans changement changerait quand même d'empreinte
et ferait recréer le conteneur pour rien.

- **Écarté : ajouter un `schedule` à `docker-publish.yml`.** Il reconstruirait aussi
  l'API chaque semaine, et le garde de date compliquerait un workflow dont c'est le rôle
  de publier à chaque push.
- **Écarté : reconstruire tous les jours.** Les articles sont programmés le lundi ; un
  rythme quotidien multiplierait les déploiements sans rien publier de plus. Une date
  qui ne tombe pas un lundi paraît au déclenchement manuel suivant, ou le lundi d'après
  — la compilation n'empêche pas une autre date, le guide la déconseille.

### 4. Le serveur tire l'image, GitHub n'entre pas sur le serveur

Une ligne de crontab de l'utilisateur `nicolas` sur le serveur de production, le lundi à
07:30 heure de Paris, lance `publier-les-articles.sh` : `docker compose pull web`, puis
`docker compose up -d web` seulement si l'image a changé, et une ligne datée dans
`logs/publication-articles.log` (empreintes avant et après).

- **Écarté : déployer depuis GitHub Actions par SSH.** Il faudrait une clé du serveur
  dans les secrets du dépôt et ouvrir le port SSH aux adresses des runners : une
  surface d'attaque pour un déploiement hebdomadaire d'articles.
- **Écarté : Watchtower.** Il tire toutes les images dès qu'elles changent, y compris
  l'API, alors que `CLAUDE.md` impose d'appliquer le SQL avant l'image qui en dépend.
- **Risque accepté : l'image `web` de `main` peut contenir autre chose que des
  articles.** Le lundi, la production reçoit tout le front fusionné sur `main`. La
  discipline actuelle (fusion puis déploiement immédiat, un merge à la fois) rend cet
  écart nul en pratique ; un front fusionné qui attendrait une API non déployée serait
  déjà une erreur de livraison, et le script ne la rattraperait pas. Le journal du
  script permet de dater ce qui a été tiré.

### 5. Les scripts de production sont versionnés à côté

Le `docker-compose.yml` de production n'est pas dans le dépôt (`CLAUDE.md`). Le script et
la ligne de crontab y sont copiés dans `infra/prod/` pour qu'on sache ce qui tourne ;
l'installation reste une copie manuelle, avec sauvegarde datée de la crontab.

## Contrats externes

- Aucune API, aucun événement journalisé, aucun appel au modèle.
- Le plan du site ne liste plus que les articles parus.
- Nouveau déploiement automatique de l'image `web`, le lundi.

## Risques

- **Le workflow ou la crontab ne tournent pas** : l'article paraît au déploiement
  suivant. Vérification hebdomadaire : `ssh namorama-prod tail
  /var/snap/docker/common/namorama/logs/publication-articles.log`.
- **GitHub désactive les workflows planifiés d'un dépôt sans activité depuis 60 jours.**
  Sans risque à ce rythme de commits, mais c'est la première chose à regarder si une
  parution manque.
