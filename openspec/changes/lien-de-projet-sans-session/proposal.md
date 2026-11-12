# Proposal

## Why

Un lien vers un projet, ouvert sans session, mène à un wizard vide : rien ne dit
qu'il faut se connecter, ni que le projet existe.

- **Ce qu'on voit en production.** Le 10/11/2026 à 20 h 06, un visiteur non connecté
  arrive directement sur `/projects/03c3d48d-…`. L'API répond 401 à
  `GET /projects/:id`, et la visite s'arrête là : un seul `page_viewed`, aucun autre
  événement. Le lien ne portait pas `?invite=` : avec ce paramètre, le wizard part
  vers Keycloak avant tout appel (`web/src/app/components/wizard/wizard.ts:1785`).
  C'est donc une adresse copiée depuis la barre du navigateur, ou une invitation
  rouverte plus tard sans son paramètre.
- **La cause.**
  - `ngOnInit` charge le projet de l'URL sans regarder si la session existe
    (`wizard.ts:1820-1825`).
  - En cas d'échec, `loadProject` se contente d'arrêter l'indicateur de chargement
    (`wizard.ts:2177-2180`) : l'écran reste à l'étape 1, vide, sans message.
  - Un utilisateur **connecté** à qui le projet n'est pas partagé tombe dans le même
    trou. L'API lui répond 404, volontairement indistinct d'un projet inexistant
    (`api/src/projects/projects.service.ts:105-112`).

## What Changes

- **Sans session, un lien de projet mène à la connexion**, puis revient sur le projet.
  Aucun appel à l'API n'est fait avant, donc plus de 401.
- **Connecté, un projet introuvable ou non partagé le dit**, par un message, puis
  ramène sur `/app`, sans révéler lequel des deux cas s'applique.
- **Tout autre échec du chargement le dit aussi**, et laisse l'utilisateur sur la page
  pour réessayer.

Hors périmètre :
- dire, avant la connexion, qui a partagé le projet : il faudrait une route publique
  qui révèle l'existence d'un projet et l'adresse de son propriétaire ;
- le parcours `?invite=`, qui fonctionne déjà ;
- un lien de partage public sans compte.
