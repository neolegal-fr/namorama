# Tasks

## 1. Rejets remontés

- [x] 1.1 Dans `installErrorReporting`, ne rien envoyer pour un rejet dont la raison est une `AbortError`. Vérification : `analytics.spec.ts` couvre les scénarios « Requête annulée par un désabonnement » et « Autre rejet », et passe sous `npx ng test --watch=false --include src/app/services/analytics.spec.ts`.
  - 12/11/2026 : 9 tests passent. Sans la ligne qui écarte `AbortError`, « ne remonte pas une requête annulée » échoue (1 sur 9) ; fichier rétabli ensuite.
- [x] 1.2 Joindre `stack` à `client_unhandled_rejection`. Vérification : `analytics.spec.ts` couvre « Rejet avec une erreur » et « Rejet avec une valeur qui n'est pas une erreur ».
  - 12/11/2026 : les deux tests passent ; la pile est coupée à 300 caractères.
- [x] 1.3 Documenter dans CLAUDE.md, à côté de la convention des événements, que les annulations ne sont pas remontées et que le rejet porte sa pile. Vérification : relecture du paragraphe.
  - 12/11/2026 : section « Erreurs du navigateur », sous « Consulter les logs en prod ».

## 2. Source maps cachées

- [x] 2.1 Activer les source maps cachées dans la configuration `production` d'`angular.json`, et déclarer `source-map` en `devDependencies`. Vérification : `npm run build` produit des `*.js.map`, et aucun `dist/namorama-web/browser/*.js` ne se termine par un commentaire `sourceMappingURL`.
  - 12/11/2026 : 7 maps pour 7 scripts (12 Mo, dont 10 pour `main`). Aucun script ne se termine par un commentaire `sourceMappingURL` ; la chaîne apparaît au milieu de deux chunks, dans le code de rrweb qui traite les maps des CSS, ce qui n'est pas une référence.
- [x] 2.2 Déplacer les maps hors du dossier servi dans `web/Dockerfile`. Vérification : `docker build` de `web/`, puis dans le conteneur, aucun `*.map` sous `/usr/share/nginx/html` et des maps sous `/opt/sourcemaps` ; une requête sur `/main-<hash>.js.map` du conteneur ne rend pas la map.
  - 12/11/2026, image construite localement : 0 map sous `/usr/share/nginx/html`, 7 sous `/opt/sourcemaps`. `/main-XVIJYJ27.js` répond 200 sans en-tête `SourceMap` ; `/main-XVIJYJ27.js.map` rend la coquille HTML (repli de l'application), pas la map.
- [x] 2.3 Écrire `web/scripts/symboliser-pile.mjs`. Vérification : une erreur levée volontairement dans la compilation de production, servie localement, donne une pile que le script retraduit vers le bon fichier et la bonne ligne du source (essai noté sous la tâche).
  - 12/11/2026 : maps extraites du conteneur local ; position réelle de `'client_unhandled_rejection'` dans `main-XVIJYJ27.js` (4937:57547), passée en forme Chrome et Safari → `src/app/services/analytics.ts:193:18`, la ligne et la colonne exactes du source. Un `chunk-INCONNU.js` est signalé « pas de map ». L'essai part d'une position mesurée dans le script, pas d'une erreur levée dans un navigateur : la correspondance ligne/colonne est celle qu'un navigateur rapporterait.
- [x] 2.4 Documenter dans CLAUDE.md comment extraire les maps du conteneur de production et retraduire une pile. Vérification : relecture, et la commande d'extraction exécutée contre l'image construite en 2.2.
  - 12/11/2026 : `docker exec … tar -C /opt/sourcemaps -cf - . | tar -xf -` exécutée contre le conteneur local, 7 maps extraites ; seul le préfixe `ssh namorama-prod` reste à jouer en 3.2.

## 3. Livraison

- [x] 3.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
  - PR #190, 12/11/2026 : quatre contrôles verts (tests API, système de design, images API et web).
- [ ] 3.2 Fusionner, attendre l'image, puis `docker compose pull web && docker compose up -d web` sur `namorama-prod`. Vérification : un `*.js` servi par `https://namorama.com` ne contient pas `sourceMappingURL`, sa map ne répond pas, et `/opt/sourcemaps` du conteneur contient les maps des scripts servis.

## Workflow follow-up

- Après une semaine, relire les `client_unhandled_rejection` : plus aucune « signal is aborted without reason », et chaque rejet porte une pile. Retraduire la première pile reçue et ouvrir le chantier de correction si elle désigne notre code.
- Archiver le chantier (`/opsx:archive`) une fois ce suivi noté.
