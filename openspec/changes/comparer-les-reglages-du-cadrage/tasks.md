# Tasks

## 1. Styles et critères expliqués à l'écran de cadrage

- [ ] 1.1 Remplacer la ligne d'aide unique du style par la liste des trois styles décrits, celui choisi mis en avant (`aria-current`), avec une classe de `wizard.css` et sans style en ligne. Vérification : au navigateur sur `http://localhost:4203/app`, à l'étape de cadrage, les trois descriptions s'affichent et la mise en avant suit le choix ; en clair et en sombre, à 390 px et sur ordinateur ; captures notées sous la tâche.
- [ ] 1.2 Afficher sous le critère de disponibilité la phrase du critère choisi, avec la nouvelle clé `MATCH_ANY_HINT` en fr et en en, et la classe `.critere-aide` à la place du style en ligne existant. Vérification : au navigateur, avec .com et .fr retenus, la phrase change avec le critère, et disparaît avec une seule extension ; mêmes thèmes et largeurs.
- [ ] 1.3 Vérifier l'interface anglaise. Vérification : la même étape, ouverte avec un navigateur en anglais, montre les trois descriptions et la phrase du critère en anglais.
- [ ] 1.4 Passer `just design-check`, et `ng test`. Vérification : les deux se terminent sans erreur ; le nombre de styles en ligne de `wizard.html` ne monte pas.

## 2. Livraison

- [ ] 2.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
- [ ] 2.2 Fusionner, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web` sur `namorama-prod`. Vérification : l'étape de cadrage de `https://namorama.com/app` montre les trois styles décrits (contrôle au navigateur, sans lancer de recherche).

## Workflow follow-up

- Après deux semaines, relire les sessions enregistrées à l'étape de cadrage : noter combien basculent le style puis reviennent au premier choix, et comparer aux 3 sur 16 du relevé initial.
- Archiver `refondre-l-ecran-de-cadrage` d'abord, puis ce chantier (`/opsx:archive`).
