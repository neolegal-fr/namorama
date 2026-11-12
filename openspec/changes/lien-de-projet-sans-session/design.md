# Design

## Context

Le wizard (`web/src/app/components/wizard/wizard.ts`) sert `/app` et `/projects/:id`.
`ngOnInit` lit la session (`isLoggedIn`, ligne 1750), traite `?invite=` et `?nom=`,
puis charge le projet de l'URL. `loadProject` n'a pas de branche d'erreur utile.

## Decisions

### Décider avant l'appel, dans un module pur
`issueDuLienDeProjet({ connecte, statut })` rend `'charger'`, `'connexion'`,
`'introuvable'` ou `'echec'`. Un 401 en cours de route (session expirée) mène aussi à
la connexion. Le wizard l'appelle avant de charger (sans statut) et dans la branche
d'erreur (avec le statut HTTP). Le module se teste seul, comme `noms-saisis.ts`.

- *Écarté : un garde de route Angular.* Le parcours `?invite=` et `?nom=` vit déjà
  dans `ngOnInit` ; un garde aurait dédoublé la règle de connexion en deux endroits
  qui doivent rester d'accord.
- *Écarté : attendre le 401 pour rediriger.* L'appel est inutile, et il laisse dans
  les logs un `Unauthorized` par lien ouvert.

### Retour sur l'adresse exacte
`keycloak.login({ redirectUri: window.location.href })`. L'adresse garde ses paramètres
(`?rapport=` par exemple), ce que la redirection de `?invite=` retire volontairement
parce qu'elle ne doit pas rejouer l'invitation.

### Un seul message pour « introuvable » et « non partagé »
L'API répond 404 dans les deux cas, pour ne pas révéler qu'un projet existe. Le
message reprend cette ambiguïté plutôt que d'en deviner un.

- *Écarté : une page d'erreur dédiée.* Un toast suivi du retour sur `/app` laisse
  l'utilisateur devant ce qu'il peut faire ensuite : chercher, ou ouvrir ses projets.

## Contrats

Aucun changement d'API ni d'événement. Deux clés de traduction
(`PROJECTS.OPEN_NOT_FOUND`, `PROJECTS.OPEN_FAILED`), en français et en anglais.
