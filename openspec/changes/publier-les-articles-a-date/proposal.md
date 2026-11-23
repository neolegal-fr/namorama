# Proposal

## Why

Le blog publie tout ce qui est fusionné, le jour où l'image `web` est déployée. Relevé le
23/11/2026 :

- Les 22 articles ont paru en **cinq salves** : 10/06, 16/06, 31/07, 03/09 et 23/11/2026
  (`web/src/app/components/content/articles.ts`). Trois articles et la refonte en blog le
  même jour, le 23/11, puis rien de prévu.
- Une série de dix articles destinés aux agences et aux professionnels du nommage est
  écrite d'avance (`web/src/content/articles/agences-*.md`, branche
  `feat/articles-agences`). Publiée en une fois, elle ne laisse aucun rythme de
  publication aux robots, et chaque article aurait la même date — l'index du blog
  afficherait dix cartes du même jour.
- Publier une par semaine **à la main** demande dix fusions et dix déploiements, chacun
  soumis à la règle « un merge à la fois » de `CLAUDE.md`.

Le chantier `articles-en-markdown` fait de la date de publication un champ du fichier
(`publie`). Il suffit qu'une date future signifie « pas encore » pour que tout un
programme puisse être fusionné en une fois.

## What Changes

- **Un article dont `publie` est postérieur à la date du build (heure de Paris) n'est
  pas publié** : absent des routes, du prérendu, de l'index `/blog`, du plan du site et
  du bundle.
- **Un article publié ne peut pas pointer vers un article programmé** : la compilation
  échoue en nommant le lien et la date de l'article visé, au lieu de laisser un lien mort
  jusqu'à sa parution.
- **Prévisualisation locale** : `ARTICLES_JUSQU_AU=AAAA-MM-JJ npm start` compile les
  articles programmés jusqu'à cette date.
- **Un workflow GitHub Actions hebdomadaire** (`publier-les-articles.yml`, lundi 05:00
  UTC) reconstruit et pousse l'image `web` de `main` **si un article devient publiable
  ce jour-là**, et ne fait rien sinon. Déclenchable à la main.
- **Une tâche planifiée sur le serveur de production** (crontab de `nicolas`, lundi
  07:30 heure de Paris) tire l'image `web` et recrée son conteneur, en journalisant le
  résultat dans un fichier.
- Documentation : section « Blog » de `CLAUDE.md` et `docs/ecrire-un-article.md`
  (programmer un article, prévisualiser, vérifier une parution).

Hors périmètre :

- Aucune publication à l'heure près : la granularité est le jour, le lundi.
- Pas de file d'attente ni d'interface de programmation : la date est dans le fichier,
  la PR la rend visible.
- Pas de déploiement automatique de l'API ni de l'image `web` en dehors du lundi.
- Pas d'annonce automatique (réseaux sociaux, lettre d'information).

## Impact

- `web/scripts/articles.mjs` et `articles.test.mjs` : filtre de date, erreur de lien
  vers un article programmé, variable `ARTICLES_JUSQU_AU`.
- `.github/workflows/publier-les-articles.yml` : nouveau workflow.
- Serveur de production : une ligne de crontab et un script
  `/var/snap/docker/common/namorama/publier-les-articles.sh`, non versionnés comme le
  `docker-compose.yml` ; leur texte est versionné dans `infra/prod/`.
- Interface : aucun changement visible hors de la parution des articles eux-mêmes.
- Dépend de `articles-en-markdown`, à livrer d'abord.
