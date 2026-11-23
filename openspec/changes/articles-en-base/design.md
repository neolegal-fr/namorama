# Design : les articles du blog en base, modifiables en ligne

## Context

Voir `proposal.md` (Why). L'état qui contraint la solution :

- **Le site est du HTML statique servi par nginx.** `web/Dockerfile` copie
  `dist/namorama-web/browser` dans `nginx:alpine` ; `angular.json` est en
  `outputMode: "static"`. Aucun processus Node ne tourne en production côté web.
- **Les articles sont compilés au build** par `web/scripts/articles.mjs` (`prebuild`,
  `prestart`, `pretest`) en `articles.generes.ts`, que lisent les routes
  (`app.routes.ts:35`), le prérendu (`app.routes.server.ts`), le registre
  (`content/articles.ts:19`), l'index et l'en-tête. Le compilateur produit déjà une forme
  neutre : en-tête + `segments` (`html` | `cta` | `trois-risques`).
- **31 articles** : 13 sous `/blog/…`, 18 à des adresses historiques (`/guides/…`,
  `/generateur-…`, `/namorama-vs-…`, `/comparatif-…`, `/nom-de-startup-…`,
  `/recherche-anteriorite-…`). 228 Ko de Markdown au total, aucune image.
- **Côté serveur, l'application ne charge ni `config.json` ni Keycloak**
  (`app.config.ts:176`), et lit ses dictionnaires sous `process.cwd()/public`
  (`app.config.server.ts`) — vrai au build, faux dans une image d'exécution.
- **Pas d'hydratation** (`provideClientHydration` absent) : le client re-rend la page
  prérendue.
- **Administration** : routes enfants de `/admin` (`app.routes.ts:59`), garde
  `adminGuard` ; côté API, `@Roles({ roles: ['realm:admin'] })` sur le contrôleur. Les
  routes publiques emploient le `@Public()` de `nest-keycloak-connect`.

Décisions prises avec l'utilisateur le 23/11/2026 : nginx reste en frontal avec un rendu
serveur derrière lui pour le blog seulement ; tous les articles en base ; un jeton d'API
maison pour Claude.

## Goals / Non-Goals

**Goals :**

- Une modification enregistrée est servie à la visite suivante, sans build ni déploiement.
- Le HTML que lisent les robots reste celui d'aujourd'hui, au texte près.
- Un seul compilateur, côté API : l'écran, Claude et l'import passent par les mêmes
  contrôles.
- Le reste du site (accueil, wizard, admin, pages légales) ne change ni de mode de rendu
  ni de configuration nginx.

**Non-Goals :**

- Mettre en cache le rendu des articles (le volume ne le demande pas, voir D6).
- Ouvrir la rédaction à d'autres rôles que `admin`.
- Garder un miroir des articles dans le dépôt.

## Decisions

### D1. nginx en frontal, un service de rendu serveur derrière lui pour le blog

`angular.json` passe en `outputMode: "server"`. Le build produit toujours
`browser/` (pages prérendues, coquille `index.csr.html`, actifs), servi par nginx comme
aujourd'hui, **et** `server/server.mjs`, lancé par une image Node distincte,
`namorama-blog` (cible `ssr` du même `web/Dockerfile`, construite par
`docker-publish.yml`). nginx relaie au service les seules adresses du blog :

- `= /blog`, `^~ /blog/`, `^~ /guides/` ;
- les 18 adresses historiques, listées une à une (`location = /generateur-nom-saas`…) ;
- `= /sitemap.xml`.

Le reste — y compris le 301 de `/guides`, la règle du slash final, les en-têtes de cache
et le `X-Robots-Tag` de `/rapport/` — ne bouge pas.

`proxy_pass` passe par une **variable** et le résolveur de Docker (`resolver
127.0.0.11`) : un `proxy_pass http://blog:4000` littéral fait échouer le démarrage de
nginx — donc de **tout** le site — si le conteneur `blog` est absent.

- *Écarté : reconstruire et redéployer l'image web à chaque publication* (GitHub Actions
  déclenché par l'API). 5 à 10 min par correction, et chaque publication emporterait tout
  le front de `main` — l'objection déjà retenue le 23/11 contre une parution par
  déploiement automatique.
- *Écarté : HTML composé par l'API* (titre, méta, JSON-LD et corps injectés dans la
  coquille). Le robot verrait l'article sans l'en-tête ni le pied du site, et la page
  serait décrite deux fois, par un gabarit de l'API et par Angular.
- *Écarté : Node seul, sans nginx.* Chaque règle de `nginx.conf` a été posée contre une
  panne relevée ; les réécrire en Express rouvrait ces risques pour tout le site.
- *Écarté : nginx et Node dans le même conteneur.* Rien ne relance Node s'il tombe, et
  le blog répondrait 502 sans que Docker le voie.

### D2. Des routes fixes, pas de résolution d'adresse à la volée

Le routeur Angular ne sait pas attendre une réponse pour décider qu'une adresse est un
article. Les routes restent donc déclarées en dur :

- `blog` et `blog/:slug` → `RenderMode.Server` ;
- les 18 adresses historiques, figées dans une constante `CHEMINS_HISTORIQUES` (web) →
  `RenderMode.Server`. L'API garde la même liste et **n'admet un chemin hors de
  `/blog/` que s'il y figure** (« Adresses publiées immuables »). Un test compare la liste
  du web, celle de l'API et les `location` de `nginx.conf`.

`/blog/:slug` inconnu : le composant pose le statut 404 (`RESPONSE_INIT`) et affiche la
page « introuvable ». Le joker `**` existant n'est pas concerné.

- *Écarté : tout ce que nginx ne trouve pas part au service Node.* Le repli SPA, la
  coquille et chaque 404 passeraient par Node, et une adresse inconnue n'aurait plus de
  réponse stable si le service tombe.

### D3. Le modèle de données

Trois tables (migration `api/migrations/2026-11-…-articles-en-base.sql`, idempotente) :

- **`article`** : `id`, `path` (unique), `title`, `description`, `titre`, `extrait`,
  `categorie`, `publie` (DATE), `misAJour` (DATE), `etat` (`brouillon` | `publie`),
  `premiereParution` (DATE, nulle tant que l'article n'a jamais été servi), `source`
  (Markdown complet, en-tête compris, `MEDIUMTEXT` — la vérité, les autres colonnes en
  sont dérivées ; comparer la source reçue à celle-ci dit si un envoi change quelque
  chose), `h1`, `segments` (JSON compilé, `MEDIUMTEXT`), `liens` (chemins internes cités,
  pour refuser la dépublication d'un article cité sans recompiler tout le blog), `lecture`
  (minutes), `revision` (entier), `majLe`, `majPar` (libellé d'auteur).
- **`article_revision`** : `articleId`, `numero`, `source` (texte Markdown complet, en-tête
  compris), `auteurType` (`compte` | `jeton`), `auteurId` (`sub` ou id de jeton),
  `auteurNom`, `creeLe`. Unique `(articleId, numero)`.
- **`jeton_api`** : `id`, `nom`, `prefixe` (8 premiers caractères, pour l'affichage),
  `empreinte` (SHA-256 hex, unique), `portee` (`articles`), `creePar` (`sub`), `creeLe`,
  `derniereUtilisation`, `revoqueLe`.

**Les segments sont compilés à l'enregistrement et stockés** ; la lecture publique ne
compile rien. *Écarté : compiler à chaque lecture* — une erreur de compilation
surgirait à la visite au lieu de l'enregistrement, et chaque page paierait `marked`.

« A paru » se lit `premiereParution IS NOT NULL AND premiereParution <= aujourd'hui`.
**Règle des liens** (corrigée à l'implémentation, tâche 1.3) : la cible d'un lien doit
avoir paru le jour où l'article qui la cite est **servi** — sa date `publie`, ou
aujourd'hui s'il a déjà paru. Comparer à la seule date `publie` refusait cinq guides de
juin mis à jour en septembre pour citer des articles du 03/09.

`premiereParution` prend la date `publie` à la publication et redevient nulle si l'article
est dépublié avant cette date. C'est ce qui fige le chemin et interdit la suppression.

Les révisions gardent la **source complète** plutôt qu'un diff : 228 Ko pour tout le blog,
une révision complète est triviale à restaurer et à relire.

### D4. Le compilateur passe dans l'API

`web/scripts/articles.mjs` est porté en TypeScript dans `api/src/articles/compilateur/`
(lecture de l'en-tête, typographie, blocs, liens, temps de lecture), avec les cas de
`articles.test.mjs` portés en spec Jest. `marked` devient une dépendance de l'API et
quitte le web.

Les **adresses connues** pour valider un lien interne sont : les routes statiques du site
(`CHEMINS_DU_SITE`, constante de l'API ; un test du web vérifie qu'elle couvre les routes
déclarées dans `app.routes.ts`, comme le faisait `cheminsDesRoutes`) et les articles qui
auront paru à la date de publication de l'article vérifié.

- *Écarté : un paquet partagé web/API.* Le dépôt n'a pas d'outillage de workspace, et
  le web n'a plus besoin de compiler : l'aperçu de l'écran demande le rendu à l'API.
- *Écarté : compiler dans le navigateur.* Les contrôles doivent de toute façon tenir
  côté serveur, puisqu'un jeton écrit sans passer par l'écran.

### D5. Les routes de l'API

| route | accès | rôle |
|---|---|---|
| `GET /articles` | public | articles parus (métadonnées), pour l'index et le plan |
| `GET /articles/contenu?path=` | public | un article paru, segments compris ; 404 sinon |
| `GET /admin/articles`, `GET /admin/articles/:id`, `…/revisions` | `realm:admin` | tout, brouillons compris |
| `POST /admin/articles/verifier` | `realm:admin` | rendu ou causes, sans écrire |
| `PUT /admin/articles` | `realm:admin` | créer / modifier (source + `revisionAttendue`) |
| `POST /admin/articles/publier`, `…/depublier`, `…/:id/restaurer/:n`, `DELETE …/:id` | `realm:admin` | |
| `GET/POST/DELETE /admin/jetons` | `realm:admin` | créer, lister, révoquer |
| `/redaction/articles/*` | jeton | lire (Markdown), lister, vérifier, enregistrer, publier, dépublier |

Les routes `/redaction/…` sont `@Public()` pour Keycloak et gardées par
`JetonDeRedactionGuard`. Les deux familles appellent le même `ArticlesService`. Pas de
suppression par jeton : elle reste un geste de l'écran.

`publier` accepte **une liste de chemins** et valide les liens comme si tous paraissaient
ensemble : les articles historiques se citent mutuellement, et des cycles rendraient
impossible une publication un par un (cas de l'import, D10).

Ajouté à l'implémentation : **`PUT /redaction/articles/lot`** (`enregistrerLot`). La
publication groupée ne suffisait pas : des articles qui se citent en boucle ne peuvent pas
non plus être **créés** un par un — le premier cite une adresse encore inconnue. Le lot les
juge ensemble, n'écrit rien si un seul est refusé, et laisse tel quel un article dont la
source est inchangée (un import rejoué ne crée aucune révision). Les routes de rédaction
ont leur propre parseur JSON (2 Mo) : le blog entier pèse 228 Ko, au-delà des 100 Ko par
défaut.

Le filtre d'exceptions global ne rendait que `message` : il transmet désormais les autres
champs d'une exception levée avec un objet (`causes`, `revisionCourante`, `auteur`,
`citants`), sans les journaliser — une cause peut citer le texte d'un article.

Les réponses publiques portent `Cache-Control: no-cache`. Le « jour courant » est calculé
par l'API, à l'heure de Paris (`TZ=Europe/Paris` déjà posé dans l'image).

**Contrat externe nouveau** : ces routes, et l'en-tête de jeton (D8).

### D6. Le rendu serveur et le passage au client

- `app.config.server.ts` fournit `URL_API_SERVEUR` depuis `API_INTERNE_URL`
  (`http://api:3000` en prod, l'adresse de l'API locale en dev) ; le navigateur garde
  `config.apiUrl`. Un `ArticlesService` choisit selon la plate-forme.
- Les dictionnaires i18n sont lus à côté du bundle serveur (`browser/assets/i18n`), plus
  sous `process.cwd()` — sinon la page rendue en production sortirait en clés brutes.
- L'article lu côté serveur est déposé dans `TransferState` ; le client le reprend sans
  rappeler l'API, et le rappelle seulement s'il manque.
- **API injoignable ou 5xx** : le service répond **503** avec `Retry-After: 120`, jamais
  404. C'est la règle des trois états appliquée au blog : un doute ne devient pas un
  verdict. Le service journalise `blog_source_unavailable`.
- `sitemap.xml` est servi par un gestionnaire Express de `server.ts` : le fichier
  statique `public/sitemap.xml` garde ses marqueurs et sert de gabarit, les lignes
  d'articles viennent de `GET /articles`.
- **En-têtes de proxy retirés** (`X-Forwarded-*`, `Forwarded`), par nginx et par
  `server.ts`. Constaté au test des conteneurs : Angular 21 sert la coquille **vide**, en
  200 et sans erreur, à toute requête qui en porte sans `trustProxyHeaders` ; le nginx de
  l'hôte les pose partout. *Écarté : déclarer ces en-têtes de confiance* — le rendu n'a
  pas besoin de l'adresse du client, et les retirer ne dépend d'aucune liste de proxys.
- **Pas de cache** entre nginx et le service. *Écarté : `proxy_cache` de quelques
  minutes* — une correction ne serait plus visible tout de suite, et il faudrait une
  invalidation à l'enregistrement. À réviser si le rendu dépasse ~200 ms ou si le trafic
  du blog le demande ; le service journalise sa durée de rendu.

### D7. L'écran « Articles »

Onglet `/admin/articles` à côté des autres. Liste : tableau PrimeNG (comme les tarifs IA),
colonnes chemin, titre, catégorie, état (puce : brouillon, programmé, publié), date de
publication, dernière modification et son auteur. Bouton principal « Nouvel article ».

Éditeur `/admin/articles/:id` :

- **Markdown à gauche, aperçu à droite** sur bureau ; à 390 px, deux onglets
  « Markdown » / « Aperçu ». L'aperçu réutilise `ArticleMarkdownComponent` et
  `ArticleEnteteComponent`, alimentés par la réponse de `verifier` (appel regroupé
  500 ms après la dernière frappe). Texte invalide : les causes remplacent l'aperçu,
  « Enregistrer » est désactivé.
- Champ texte natif à police à chasse fixe (jeton typographique existant), pas de
  bibliothèque d'édition. *Écarté : CodeMirror / ngx-markdown* — une dépendance lourde
  pour un usage d'un administrateur ; le Markdown du blog est simple.
- **Un bouton principal par zone** : « Enregistrer » dans l'éditeur. « Publier » /
  « Dépublier » sont secondaires, dans l'en-tête de l'écran ; « Dépublier » et
  « Restaurer » demandent confirmation (dialogue existant). « Supprimer » n'apparaît que
  pour un brouillon jamais paru.
- **Historique** dans un tiroir (`p-drawer`, comme celui des projets) : numéro, date,
  auteur, et « Restaurer ».
- **Conflit (409)** : bandeau d'erreur nommant la révision et l'auteur, texte conservé,
  bouton « Voir la version en ligne » qui ouvre la révision courante à côté.
- Section **« Jetons de rédaction »** sous la liste : nom, préfixe, création, dernière
  utilisation, « Révoquer ». La création ouvre un dialogue qui montre la valeur une fois,
  avec « Copier ».

Rôles `--nm-app-*` uniquement (univers applicatif, §2), densité admin (§7). Le **motif
« éditeur à aperçu »** est nouveau : il entre au §5 de `docs/systeme-de-design.md` dans
le même groupe de tâches. *Écarté : un dialogue plein écran pour l'édition* — un article
de 1 500 mots s'édite mieux sur une page à adresse propre, qu'on peut recharger.

Les articles ne sont pas des saisies d'utilisateur : `nm-prive` n'est pas requis, et les
pages `/admin` ne sont de toute façon jamais enregistrées.

### D8. Le jeton de rédaction

- Valeur : `nmr_` + 32 octets aléatoires en base64url. Le préfixe rend une fuite
  repérable (recherche de secrets dans un dépôt ou un journal).
- Conservé en **SHA-256** : la valeur a 256 bits d'entropie, un hachage lent n'ajouterait
  rien ; la recherche se fait par l'empreinte, index unique.
- Présenté dans l'en-tête **`X-Namorama-Jeton`**. *Écarté : `Authorization: Bearer`* —
  le garde global de `nest-keycloak-connect` tente de valider tout porteur, y compris sur
  une route publique, et rejetterait un jeton qui n'est pas un JWT.
- Portée `articles` seule : le garde refuse un jeton sur toute autre route, et les routes
  d'administration ignorent cet en-tête.
- `derniereUtilisation` est mise à jour au plus une fois par minute (pas une écriture par
  requête).
- *Écarté : compte de service Keycloak* (proposé, non retenu par l'utilisateur) et
  *serveur MCP* (hors périmètre : il pourra s'appuyer sur `/redaction`).

### D9. Les commandes pour Claude

`scripts/article.mjs` (Node, sans dépendance, `fetch`) et des recettes `just` :

- `just article-liste` ;
- `just article-lire <chemin> [fichier]` : écrit le Markdown, en-tête compris, avec une
  ligne de commentaire `# revision: N` (l'en-tête admet déjà les commentaires) ;
- `just article-verifier <fichier>` : causes ou résumé du rendu (titres, blocs, temps de
  lecture) ;
- `just article-envoyer <fichier> [--publier]` : envoie la source avec la révision lue
  dans le commentaire comme `revisionAttendue` ; sans commentaire, c'est une création, et
  un chemin existant donne un 409 ;
- `just article-publier <chemin>…`, `just article-depublier <chemin>`.

Variables : `NAMORAMA_JETON_ARTICLES` (obligatoire, jamais dans le dépôt),
`NAMORAMA_API_URL` (défaut `https://api.namorama.com`). Sortie non nulle et cause
affichée sur toute erreur. `docs/ecrire-un-article.md` décrit le circuit pour Claude.

*Écarté : relire la révision courante juste avant l'envoi.* Cela écraserait sans le dire
une correction faite à la main entre la lecture de Claude et son envoi — précisément le
conflit qu'on veut voir.

### D10. L'import des 31 articles

Par l'API elle-même, avec un jeton nommé « import » : `just article-importer <dossier>`
envoie tous les fichiers en **un lot publié** (D5), jugé d'un bloc. Les dates `publie` / `misAJour` du fichier sont gardées ;
les 9 articles programmés restent programmés. La révision 1 de chaque article porte
l'auteur « import ».

*Écarté : un script SQL d'insertion généré.* Il contournerait le compilateur et ses
contrôles, et les segments seraient à produire hors de l'API.

La parité se vérifie avec `web/scripts/comparer-rendus.mjs` : pour chaque adresse, texte
visible (espaces normalisés), `href`, `id` des titres et JSON-LD de la page prérendue
actuelle contre la page rendue par le service — exigence « Rendu inchangé par la
migration ».

### D11. Journalisation

`article_saved`, `article_published`, `article_unpublished`, `article_restored`,
`article_deleted` : `path`, `revision`, `auteurType`, `auteurId`. `api_token_created`,
`api_token_revoked` : `id`, `nom`, `sub`. `article_rejected` (refus de compilation) :
`path`, nombre de causes — ce qui dira si Claude produit des articles refusés. Jamais le
corps, jamais une valeur de jeton.

## Risks / Trade-offs

- **Un service de plus en production** → `restart: unless-stopped` ; `proxy_pass` par
  variable pour que nginx démarre sans lui (D1) ; 503 et non 404 quand il ou l'API manque
  (D6). Seul le blog en dépend.
- **Le slash final sous `^~ /blog/`** : un préfixe `^~` court-circuite la règle
  regex du slash final → la redirection est reprise dans les `location` du blog, et un
  test `curl` le vérifie.
- **Code exécuté côté serveur à chaque visite** : tout ce que touchent les composants du
  blog doit tenir sans `window` ni Keycloak, ce qui est déjà le cas au prérendu ; un
  test de rendu serveur de chaque type de page le garde.
- **L'historique Git des articles s'arrête** → les révisions le remplacent ; les fichiers
  restent lisibles dans l'historique du dépôt jusqu'au commit qui les supprime.
- **Un jeton volé publie sur le site** → portée limitée aux articles, révocation
  immédiate, chaque modification journalisée avec l'identifiant du jeton, et toute
  révision restaurable.
- **Écriture concurrente** → `revisionAttendue` obligatoire pour une modification, 409
  sinon (D9).
- **Liens rendus invalides après coup** (une cible dépubliée) → la dépublication est
  refusée tant qu'un article paru la cite.
- **Pages anglaises** : aucun article n'a de version anglaise ; rien ne change.

## Migration Plan

1. Appliquer `2026-11-…-articles-en-base.sql` en production (tables vides, sans effet sur
   l'existant).
2. Déployer l'**image API** qui porte le module. Le site sert toujours les pages
   prérendues : rien n'est visible.
3. Créer un jeton « import » depuis l'administration de production ; lancer
   `just article-importer` contre la production ; vérifier `GET /articles` (22 articles
   parus au 23/11/2026 + 9 programmés visibles en admin) ; révoquer le jeton.
4. Ajouter le service `blog` au `docker-compose.yml` de prod (sauvegarde datée avant
   modification), `API_INTERNE_URL=http://api:3000`.
5. Déployer les images **`web`** (nginx qui relaie) et **`blog`**. Contrôler
   `comparer-rendus.mjs` contre la production, les 301, un 404 sous `/blog/`.

**Retour arrière** : redéployer l'image `web` précédente — elle contient encore les pages
prérendues et ne relaie rien. Les tables peuvent rester ; l'API ne sert les routes
publiques qu'à qui les appelle.

Une correction faite en base entre les étapes 3 et 5 n'est pas perdue au retour arrière :
elle reste en base, seule la vitrine revient aux fichiers.
