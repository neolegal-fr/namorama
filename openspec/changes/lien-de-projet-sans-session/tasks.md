# Tasks

## 1. Issue d'un lien de projet

- [x] 1.1 Écrire `issueDuLienDeProjet` dans `web/src/app/components/wizard/lien-de-projet.ts`. Vérification : `lien-de-projet.spec.ts` couvre déconnecté, 404, 401, 500 et erreur réseau (statut 0), et passe sous `npx ng test --watch=false --include src/app/components/wizard/lien-de-projet.spec.ts`.
  - 12/11/2026 : 5 tests passent.
- [x] 1.2 Dans le wizard, envoyer vers la connexion avant de charger le projet quand il n'y a pas de session, et traiter l'échec de `loadProject` (message, retour sur `/app` pour un 404). Ajouter les deux messages en français et en anglais. Vérification : au navigateur, sur l'environnement de l'agent, les trois scénarios de la spécification, avec un vrai projet de la base copiée ; le `GET /projects/:id` absent du réseau pour le visiteur déconnecté. Notes sous la tâche.
  - 12/11/2026, environnement de l'agent (N=1, base copiée), compte local `verif-lien-projet@example.com` à qui le projet `claireo` (40 noms) est partagé en lecture :
    - déconnecté sur `/projects/0b02391e-…` : écran de connexion de Keycloak, `redirect_uri` sur le projet, **aucune requête vers l'API** ; une fois connecté, retour sur `claireo`, bandeau « lecture seule », 40 noms ;
    - connecté sur `Calmora`, non partagé : l'API répond 404, avertissement « This project cannot be found, or it has not been shared with you. », puis `/app` vierge ;
    - connecté sur `claireo`, requête du projet coupée (`connectionrefused`) : message « This project cannot be opened right now… », l'adresse reste `/projects/0b02391e-…`.
- [x] 1.3 Vérifier que `?invite=` n'a pas changé. Vérification : au navigateur, `/projects/:id?invite=…&nouveau=1` sans session ouvre l'inscription de Keycloak, adresse pré-remplie.
  - 12/11/2026 : session vidée, `/projects/0b02391e-…?invite=nouvel-invite@example.com&nouveau=1` → `/registrations` de Keycloak, `login_hint` posé, champ e-mail pré-rempli, `redirect_uri` sur le projet sans `?invite`.
- [x] 1.4 Documenter dans CLAUDE.md, « Partage d'un projet », ce que devient un lien de projet ouvert sans session ou sans accès. Vérification : relecture.
  - 12/11/2026 : puce « Un lien de projet mène toujours quelque part » dans « Partage d'un projet ».

## 2. Livraison

- [x] 2.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
  - PR #191, 12/11/2026 : quatre contrôles verts, avant et après la fusion de `main`.
- [x] 2.2 Fusionner, attendre l'image, puis `docker compose pull web && docker compose up -d web` sur `namorama-prod`. Vérification : `https://namorama.com/projects/<uuid>` dans un navigateur sans session ouvre la connexion de `auth.namorama.com`, et aucun `GET /projects/<uuid>` n'apparaît dans les logs de l'API.
  - 12/11/2026 : fusion `76b7dfa`, image web tirée et conteneur recréé. Navigateur sans session sur `https://namorama.com/projects/00000000-0000-4000-8000-000000000000` (`/events` et `/replay` bloqués) : arrivée sur `auth.namorama.com`, `redirect_uri` sur le projet ; seules requêtes à l'API, deux `POST /events` bloqués. Aucune ligne dans les logs de l'API sur les 10 minutes suivantes, donc aucun 401.

## Workflow follow-up

- Après une semaine, compter dans les logs les `Unauthorized` sur `/projects/:id` (attendu : zéro) et les `page_viewed` sur `/projects/:id` avec `connecte: false` suivis d'un retour connecté.
- Archiver le chantier (`/opsx:archive`).
