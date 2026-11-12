# Design

## Context

`AnalyticsService.installErrorReporting()` (`web/src/app/services/analytics.ts:156`)
écoute `error` et `unhandledrejection` et envoie un événement par occurrence.
`EventsController` (`api/src/events/events.controller.ts:22`) coupe chaque valeur à
300 caractères et garde au plus 20 clés. L'image web (`web/Dockerfile`) copie tout
`dist/namorama-web/browser` dans le dossier servi par nginx.

## Decisions

### Ignorer les `AbortError` à la source, sans compter les annulations
Le gestionnaire teste `reason?.name === 'AbortError'` et rend la main.

- *Écarté : un événement distinct `client_request_cancelled`.* Il ne répond à aucune
  question qu'on se pose ; CLAUDE.md demande de n'ajouter un événement que dans ce
  cas.
- *Écarté : retrouver et corriger chaque désabonnement qui laisse fuir le rejet.* Il
  peut venir du `FetchBackend` d'Angular lui-même ; le coût est sans proportion avec
  un défaut que personne ne voit.

### Même forme de pile que `client_error`
Le rejet ajoute `stack: String(reason?.stack ?? '').slice(0, 300)`. Le contrat de
l'événement `client_unhandled_rejection` gagne donc un champ `stack`, vide quand la
raison n'est pas une erreur. Le serveur coupe déjà à 300 ; couper aussi côté client
garde le corps de l'envoi petit.

### Source maps cachées, gardées dans l'image hors du dossier servi
`sourceMap: { scripts: true, styles: false, vendor: true, hidden: true }` dans la
configuration `production` d'`angular.json`. Dans le `Dockerfile`, l'étape de
compilation déplace les `*.map` vers `/maps`, et l'image finale les copie dans
`/opt/sourcemaps`. Les maps sont ainsi toujours celles du code déployé.

- *Écarté : les servir avec un `deny` nginx.* Une règle oubliée lors d'une retouche de
  `nginx.conf` publierait le code source ; un fichier absent du dossier servi ne peut
  pas l'être.
- *Écarté : les téléverser vers un service tiers.* Hors périmètre, et une dépendance
  de plus.
- *Maps des dépendances incluses (`vendor: true`)* : une erreur peut venir de
  `keycloak-js` ou de PrimeNG ; le coût n'est que de la taille d'image.

### Un script de retraduction, sans dépendance nouvelle
`web/scripts/symboliser-pile.mjs <dossier-des-maps>` lit une pile sur l'entrée
standard et réécrit chaque `fichier.js:ligne:colonne` en position source. Il emploie
`source-map`, déjà installé avec la chaîne de compilation d'Angular ; le déclarer en
`devDependencies` fige la version.

## Risks / Trade-offs

- L'image web grossit de la taille des maps (quelques Mo) : sans effet sur ce que
  télécharge un visiteur.
- La compilation de production est un peu plus longue.
