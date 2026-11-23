# Tasks

> Branche `feat/articles-agences`, empilée sur `feat/articles-markdown` (chantier
> `articles-en-markdown`) : à fusionner **après** lui.

## 1. Compilation : la date décide

- [x] 1.1 `web/scripts/articles.mjs` : date du build à Paris (`Intl.DateTimeFormat`,
  `timeZone: 'Europe/Paris'`), remplaçable par `ARTICLES_JUSQU_AU` ; les articles dont
  `publie` est postérieur sont écartés **avant** la validation des liens, et leurs
  chemins mémorisés avec leur date.
  Vérification : `node --test scripts/articles.test.mjs` — article du jour compilé,
  article du lendemain absent de la liste et du plan du site, `ARTICLES_JUSQU_AU` le
  rétablit, `ARTICLES_JUSQU_AU` mal formée refusée.
  23/11/2026 : 36 tests passent (29 existants + 7 nouveaux : jour/lendemain, sans date, lien prématuré, même jour, chemin déjà servi, fuseau de Paris, `ARTICLES_JUSQU_AU`).
- [x] 1.2 Lien d'un article publiable vers un article programmé : erreur qui nomme le
  fichier, le lien et la date de la cible.
  Vérification : cas de test dédié, message vérifié.
  23/11/2026 : message « lien vers /blog/suivant#x, article programmé le 2026-12-21 » vérifié par test.
- [x] 1.3 Série `agences-*.md` (10 articles, du 30/11/2026 au 01/02/2027) compilée date
  par date.
  Vérification : déjà simulée le 23/11/2026 avec le compilateur en cours de
  `articles-en-markdown` — les dix dates compilent, aucun lien vers un article à venir
  (script de simulation jetable). À refaire avec le compilateur fusionné :
  `ARTICLES_JUSQU_AU=<date> node scripts/articles.mjs` pour chaque lundi.
  23/11/2026, compilateur fusionné dans la branche : au jour même « 21 compilés, 10 programmés », aucun article de la série dans `sitemap.xml` ; au 14/12 : 24 ; au 01/02/2027 : 31, et `npm run build` prérend 37 routes.
- [ ] 1.4 Au navigateur (`ARTICLES_JUSQU_AU=2027-02-01 npm start`) : `/blog` liste la
  série, trois articles lus à 390 px et sur bureau, en clair et en sombre ; blocs
  `cta` et `trois-risques` rendus.
  23/11/2026, build statique servi en local : `/blog/agence-responsable-nom-deja-depose` et
  `/blog/outils-de-naming-pour-agences` lus à 390 px (cadre) et à 1 280 px en clair, tableaux,
  blocs et liens rendus. **Reste : thème sombre, et l'index `/blog` avec la série.**
- [x] 1.5 `just design-check`.
  23/11/2026 : `node web/scripts/verifier-design.mjs` — aucune valeur en dur ajoutée.

## 2. Parution hebdomadaire

- [ ] 2.1 `.github/workflows/publier-les-articles.yml` : lundi 05:00 UTC, garde « un
  article paraît aujourd'hui à Paris », build et push de l'image `web` sous `latest` et
  le SHA ; déclenchement manuel avec `forcer`.
  Vérification : déclenchement manuel un jour sans article → « rien à construire » ;
  avec `forcer` → image poussée (tag SHA visible au registry).
- [ ] 2.2 `infra/prod/publier-les-articles.sh` installé sur le serveur, crontab de
  `nicolas` (`CRON_TZ=Europe/Paris`, `30 7 * * 1`), sauvegarde datée de la crontab
  avant modification. **Accord de l'utilisateur requis** (changement en production).
  Vérification : exécution manuelle une fois → ligne « image inchangée » ou
  « déployée » dans `logs/publication-articles.log`, `docker compose ps` sain.

## 3. Documentation

- [ ] 3.1 `docs/ecrire-un-article.md` : programmer un article (date un lundi), règle des
  liens vers les seuls articles parus, prévisualisation `ARTICLES_JUSQU_AU`, vérifier
  une parution. Section « Blog » de `CLAUDE.md` : le blog paraît le lundi, workflow et
  crontab, journal à lire.
  Vérification : relecture ; un article d'essai programmé au lendemain n'apparaît pas
  au build du jour.

## 4. Livraison

- [ ] 4.1 PR, CI verte, fusion, déploiement de l'image `web` (la série reste invisible :
  première date le 30/11/2026).
  Vérification : `/blog` en production ne liste aucun article de la série avant le
  30/11/2026 ; `sitemap.xml` non plus.

## Workflow follow-up

- [ ] Lundi 30/11/2026 : le workflow a construit, le journal du serveur dit « déployée »,
  `/blog/agences-qui-trouve-les-noms-de-marque` répond 200 avec son `BlogPosting`.
- [ ] Lundi 07/12/2026 : deuxième parution sans intervention.
- [ ] Un lundi sans article : workflow « rien à construire », journal « image inchangée ».
- [ ] Archiver après `articles-en-markdown`.
