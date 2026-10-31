# Tasks

## 1. Mesure de départ

- [ ] 1.1 Chiffrer l'usage actuel de la reformulation sur les 30 derniers jours : `ssh namorama-prod "python3 - http" < scripts/analyze-logs.py`, en rapportant les `POST /domain/refine` aux `POST /domain/keywords`. Vérification : les deux nombres, le ratio et la date du relevé sont notés sous cette tâche, et la phrase « pas encore mesurée » de proposal.md est remplacée par le chiffre.

## 2. Consigne de reformulation (API)

- [x] 2.1 Réécrire la consigne de `refineDescription` selon D3 (langue de la description, aucun fait ajouté, paragraphe final recopiant les instructions de nommage). Vérification : `requetes-openai.spec.ts` est mis à jour pour la nouvelle consigne de `refine` et `cd api && npx jest src/common/modele-ia` passe. L'écart de parité est noté dans CLAUDE.md, section « Fournisseur du modèle ».
  - Consigne extraite en `CONSIGNE_REFORMULATION`, rédigée en anglais pour ne pencher vers aucune langue de réponse.
  - Pas d'écart de parité : `requetes-openai.spec.ts` fige les paramètres (modèle, budget de 500, `reasoning_effort`) et laisse le texte système libre (`expect.any(String)`). Il passe sans modification, et CLAUDE.md n'a rien à signaler.
  - Le contenu de la consigne est couvert par le nouveau `reformulation.spec.ts` (langue, aucun fait ajouté, instructions de nommage recopiées, Markdown retiré, repli sur une réponse vide). `npx jest src/domain/reformulation.spec.ts src/common/modele-ia` : 65 tests passent.
- [ ] 2.2 Vérifier sur `claude-haiku-5-5` réel, puis sur luna, par un script jetable hors dépôt qui appelle `refineDescription` puis `extractNamingConstraints` sur l'original et sur la version proposée, cinq briefs paraphrasés : « 4-5 lettres, sans -ora/-ia », « 6 lettres exactement », « composé avec bloom », « dans l'esprit de Qonto », une description en anglais sans contrainte ni public. Vérification : résultats notés sous cette tâche. Contraintes identiques avant et après dans au moins 4 cas sur 5 pour chaque modèle, réponse anglaise en anglais, et aucun public ajouté au dernier cas.
  - Relevé du 31/10/2026 : 5 cas conformes sur 5 sur `claude-haiku-5-5` comme sur `gpt-5.6-luna`. Les contraintes extraites sont identiques avant et après dans chaque cas.
  - Chaque instruction de nommage est recopiée dans un paragraphe final, dans les termes de l'utilisateur (« Contraintes sur le nom : 4 à 5 lettres, sans terminaison en -ora ni en -ia », « Le nom doit faire 6 lettres exactement »).
  - Le brief anglais est rendu en anglais, sans public ajouté, et sans paragraphe de nommage puisqu'il n'y avait pas de contrainte.
  - Haiku enjolive davantage (« durables et élégants au quotidien », « freelances » pour « indépendants ») sans ajouter de fait. Luna reste au plus près du texte.

## 3. Une seule description (web)

- [x] 3.1 Remplacer les lectures `refinedDescription() || description()` par `description()` (D2), et retirer `refinedDescription` de l'état sauvegardé avant connexion, en ignorant ce champ à la restauration d'un ancien état. Vérification : `cd web && npx ng build` passe. Au navigateur, un état localStorage ancien contenant `refinedDescription` se restaure sans erreur et la recherche porte `description`.
  - `ng build` passe. Le seul avertissement, sur le budget de `wizard.css`, existait déjà.
  - `ng test` : 40 tests passent, dont `masquage.spec.ts`, qui surveille désormais `description()` affiché dans le panneau.
  - Navigateur, `fr-FR` : un `wizard_state` portant `refinedDescription` se restaure sans erreur de page. La version en réserve n'est envoyée dans aucune requête, `keywords` porte la description, et rien n'est reformulé (état déjà validé).

## 4. Confirmation dans « Continuer » (web)

- [x] 4.1 Retirer le bouton « Reformuler avec l'IA ». Faire appeler la reformulation par `goToKeywords()` quand le texte diffère du dernier texte reformulé, afficher le panneau de confirmation (description saisie, `textarea` prérempli, « Utiliser cette version » en principal, « Garder ma description »), puis enchaîner sur le cadrage avec le texte choisi (D1). Styles de layout en inline. Vérification : au navigateur, avec une description réelle, la confirmation s'affiche, une retouche puis « Utiliser » ouvre l'étape 2, et la requête `keywords` (onglet réseau) porte le texte retouché.
  - Navigateur, `fr-FR`, brief « accessoires pour chiens, 4-5 lettres, sans -ora/-ia » : confirmation en 1,9 s, avec les contraintes recopiées dans la version proposée. Après retouche puis « Utiliser », la requête `keywords` porte le texte retouché.
  - Même parcours en `en-US` : version proposée en anglais.
  - Ajout pendant la réalisation : pendant la confirmation, la grande zone de saisie laisse place au panneau, qui montre les deux versions côte à côte. Un lien « Modifier ma description » ramène à la saisie, sans quoi on ne pourrait plus corriger son propre texte.
- [x] 4.2 Traiter les cas sans confirmation (D4) : texte inchangé depuis la dernière reformulation, erreur, délai de 10 s dépassé, réponse identique au texte saisi. Vérification : au navigateur, un retour à l'étape 1 sans modification ouvre l'étape 2 directement. L'API arrêtée (ou la requête `refine` bloquée dans les outils de développement) ouvre l'étape 2 avec la description saisie, sans message d'erreur.
  - Retour à l'étape 1 sans modification, puis « Continuer » : étape 2 directe, un seul appel `refine` en tout.
  - `refine` en 500 : étape 2 ouverte, `keywords` avec l'original, ni confirmation ni toast.
  - `refine` répondant en 12 s : étape 2 au bout de 10 s avec l'original, et la réponse tardive n'affiche rien.
  - Réponse identique au texte saisi : pas de confirmation.
- [x] 4.3 Vérifier la persistance : retenir la version proposée, lancer une recherche, rouvrir le projet. Vérification : au navigateur, la description du projet rouvert est la version retenue, et la requête `search/stream` suivante la porte.
  - Navigateur, compte de test local : version retenue, puis « Lancer la recherche », puis projet `/projects/…` avec des résultats réels (`bloomlys.fr` libre).
  - Rouvert dans un nouvel onglet : `GET /projects/:id` rend la version retenue, et la requête `search/stream` de « 10 de plus » la porte.
- [x] 4.4 Libellés fr et en (titre du panneau, attente, deux boutons) dans `web/public/assets/i18n/`, et suppression des clés `REFINE_BTN` et `SUGGESTION_TITLE` devenues inutiles. Vérification : au navigateur, en `fr-FR` et en `en-US`, aucune clé brute à l'étape 1. `grep -r REFINE_BTN web/src` ne rend rien.
  - Clés ajoutées : `REFINING`, `CONFIRM_TITLE`, `CONFIRM_HINT`, `CONFIRM_ORIGINAL`, `CONFIRM_PROPOSED`, `EDIT_ORIGINAL`, `KEEP_ORIGINAL`.
  - Clés retirées : `REFINE_BTN`, `SUGGESTION_TITLE`, et `REFINE_ERROR`, qui n'était plus utilisée.
  - Aucune clé brute en `fr-FR` ni en `en-US`, et `grep` ne rend rien.
- [x] 4.5 Émettre `description_refine_shown` et `description_refine_chosen` (D5) par `AnalyticsService.track()`, et les documenter dans CLAUDE.md, section « Nommage des événements ». Vérification : les deux événements apparaissent dans les logs locaux de l'API, sans texte de description.
  - Logs locaux de l'API : `description_refine_shown` `{ longueur: 179 }`, puis `description_refine_chosen` `{ choix: "reformulation", retouchee: true }`, sans texte. Documentés dans CLAUDE.md.
- [x] 4.6 Mettre à jour CLAUDE.md, section « Fonctionnalités » (« Description → Reformulation IA confirmée → Mots-clés »). Vérification : relecture.
  - Ligne réécrite : le texte retenu est la seule description, le cahier des charges est conservé, un échec ou un délai ne bloque pas.

## 5. Livraison

- [x] 5.1 Merger la PR, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web`. Vérification : conteneurs `Up`, et un passage à l'étape 2 en production affiche la confirmation.
  - Livré le 31/10/2026 : PR #172 mergée (`fb89da2`), build `main` vert, déploiement à 15 h 44. Conteneurs `api` et `web` `Up`, démarrage de l'API sans erreur ni avertissement.
  - Image déployée : celle de `fb89da2` seule. La PR #171, mergée quatre minutes plus tard par une autre session, n'avait pas encore d'image au moment du `pull`.
  - Navigateur sur namorama.com : plus de bouton « Reformuler avec l'IA ». « Continuer » affiche la confirmation, et la version proposée recopie « nom inventé, court, dans l'esprit de Qonto ou Alan ».
  - La tâche 1.1 reste ouverte. L'agent n'a pas accès aux logs de prod, et la mesure de départ (`refine` / `keywords` sur les 30 jours avant le 31/10/2026) peut encore se lire tant que ces jours restent dans la rétention.

## Workflow follow-up

- Après 14 jours : relever le taux d'affichage (`description_refine_shown` / passages à l'étape 2), la part `reformulation` / `originale`, la part retouchée, et l'abandon entre la confirmation et l'étape 2. Au-delà de 80 % de descriptions gardées, rouvrir la question (D5, Risks). Noter les chiffres ici.
- Archiver le chantier, puis vérifier que `openspec/specs/recherche/reformulation/` existe et que `openspec validate --all` passe.
