# Tasks

## 1. Mesure de départ

- [ ] 1.1 Chiffrer l'usage actuel de la reformulation sur les 30 derniers jours : `ssh namorama-prod "python3 - http" < scripts/analyze-logs.py`, en rapportant les `POST /domain/refine` aux `POST /domain/keywords`. Vérification : les deux nombres, le ratio et la date du relevé sont notés sous cette tâche, et la phrase « pas encore mesurée » de proposal.md est remplacée par le chiffre.

## 2. Consigne de reformulation (API)

- [ ] 2.1 Réécrire la consigne de `refineDescription` selon D3 (langue de la description, aucun fait ajouté, paragraphe final recopiant les instructions de nommage). Vérification : `requetes-openai.spec.ts` est mis à jour pour la nouvelle consigne de `refine` et `cd api && npx jest src/common/modele-ia` passe. L'écart de parité est noté dans CLAUDE.md, section « Fournisseur du modèle ».
- [ ] 2.2 Vérifier sur `claude-haiku-5-5` réel, puis sur luna, par un script jetable hors dépôt qui appelle `refineDescription` puis `extractNamingConstraints` sur l'original et sur la version proposée, cinq briefs paraphrasés : « 4-5 lettres, sans -ora/-ia », « 6 lettres exactement », « composé avec bloom », « dans l'esprit de Qonto », une description en anglais sans contrainte ni public. Vérification : résultats notés sous cette tâche. Contraintes identiques avant et après dans au moins 4 cas sur 5 pour chaque modèle, réponse anglaise en anglais, et aucun public ajouté au dernier cas.

## 3. Une seule description (web)

- [ ] 3.1 Remplacer les lectures `refinedDescription() || description()` par `description()` (D2), et retirer `refinedDescription` de l'état sauvegardé avant connexion, en ignorant ce champ à la restauration d'un ancien état. Vérification : `cd web && npx ng build` passe. Au navigateur, un état localStorage ancien contenant `refinedDescription` se restaure sans erreur et la recherche porte `description`.

## 4. Confirmation dans « Continuer » (web)

- [ ] 4.1 Retirer le bouton « Reformuler avec l'IA ». Faire appeler la reformulation par `goToKeywords()` quand le texte diffère du dernier texte reformulé, afficher le panneau de confirmation (description saisie, `textarea` prérempli, « Utiliser cette version » en principal, « Garder ma description »), puis enchaîner sur le cadrage avec le texte choisi (D1). Styles de layout en inline. Vérification : au navigateur, avec une description réelle, la confirmation s'affiche, une retouche puis « Utiliser » ouvre l'étape 2, et la requête `keywords` (onglet réseau) porte le texte retouché.
- [ ] 4.2 Traiter les cas sans confirmation (D4) : texte inchangé depuis la dernière reformulation, erreur, délai de 10 s dépassé, réponse identique au texte saisi. Vérification : au navigateur, un retour à l'étape 1 sans modification ouvre l'étape 2 directement. L'API arrêtée (ou la requête `refine` bloquée dans les outils de développement) ouvre l'étape 2 avec la description saisie, sans message d'erreur.
- [ ] 4.3 Vérifier la persistance : retenir la version proposée, lancer une recherche, rouvrir le projet. Vérification : au navigateur, la description du projet rouvert est la version retenue, et la requête `search/stream` suivante la porte.
- [ ] 4.4 Libellés fr et en (titre du panneau, attente, deux boutons) dans `web/public/assets/i18n/`, et suppression des clés `REFINE_BTN` et `SUGGESTION_TITLE` devenues inutiles. Vérification : au navigateur, en `fr-FR` et en `en-US`, aucune clé brute à l'étape 1. `grep -r REFINE_BTN web/src` ne rend rien.
- [ ] 4.5 Émettre `description_refine_shown` et `description_refine_chosen` (D5) par `AnalyticsService.track()`, et les documenter dans CLAUDE.md, section « Nommage des événements ». Vérification : les deux événements apparaissent dans les logs locaux de l'API, sans texte de description.
- [ ] 4.6 Mettre à jour CLAUDE.md, section « Fonctionnalités » (« Description → Reformulation IA confirmée → Mots-clés »). Vérification : relecture.

## 5. Livraison

- [ ] 5.1 Merger la PR, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web`. Vérification : conteneurs `Up`, et un passage à l'étape 2 en production affiche la confirmation.

## Workflow follow-up

- Après 14 jours : relever le taux d'affichage (`description_refine_shown` / passages à l'étape 2), la part `reformulation` / `originale`, la part retouchée, et l'abandon entre la confirmation et l'étape 2. Au-delà de 80 % de descriptions gardées, rouvrir la question (D5, Risks). Noter les chiffres ici.
- Archiver le chantier, puis vérifier que `openspec/specs/recherche/reformulation/` existe et que `openspec validate --all` passe.
