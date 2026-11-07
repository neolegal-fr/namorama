# Tasks

## 1. Styles et critères expliqués à l'écran de cadrage

- [x] 1.1 Remplacer la ligne d'aide unique du style par la liste des trois styles décrits, celui choisi mis en avant (`aria-current`), avec une classe de `wizard.css` et sans style en ligne. Vérification : au navigateur sur `http://localhost:4203/app`, à l'étape de cadrage, les trois descriptions s'affichent et la mise en avant suit le choix ; en clair et en sombre, à 390 px et sur ordinateur ; captures notées sous la tâche.
  - 07/11/2026, Chromium sans interface, `/app` local : les trois descriptions s'affichent, celle du style choisi en `--nm-app-text` avec `aria-current`, les autres en `--nm-app-text-2`. La mise en avant suit le passage à « Inventés + descriptifs ». Vérifié en clair et en sombre, à 1280 et 390 px, sans débordement horizontal. Le libellé « Inventés » était déjà tronqué à 390 px dans le contrôle de choix avant ce chantier ; ce défaut existant n'est pas traité ici.
- [x] 1.2 Afficher sous le critère de disponibilité la phrase du critère choisi, avec la nouvelle clé `MATCH_ANY_HINT` en fr et en en, et la classe `.critere-aide` à la place du style en ligne existant. Vérification : au navigateur, avec .com et .fr retenus, la phrase change avec le critère, et disparaît avec une seule extension ; mêmes thèmes et largeurs.
  - 07/11/2026 : « Au moins une » puis « Toutes » puis « Au moins une », la phrase suit le choix. Avec `.com` seul (navigateur anglais), ni critère ni phrase ne s'affichent ; en français, `.com` et `.fr` sont retenus par défaut.
- [x] 1.3 Vérifier l'interface anglaise. Vérification : la même étape, ouverte avec un navigateur en anglais, montre les trois descriptions et la phrase du critère en anglais.
  - 07/11/2026 : « Invented — Words coined… e.g. qonto, figma » et les deux autres ; phrase « A name is suggested as soon as one of the selected extensions is free… ».
- [x] 1.4 Passer `just design-check`, et `ng test`. Vérification : les deux se terminent sans erreur ; le nombre de styles en ligne de `wizard.html` ne monte pas.
  - 07/11/2026 : `wizard.html` passe de 197 à 195 styles en ligne, la référence est resserrée (`web/design-reference.json`, 675 valeurs héritées) et `ng test` passe.

## 2. Livraison

- [x] 2.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
  - PR #185, 07/11/2026 : quatre contrôles verts (tests API, système de design, images API et web).
- [x] 2.2 Fusionner, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web` sur `namorama-prod`. Vérification : l'étape de cadrage de `https://namorama.com/app` montre les trois styles décrits (contrôle au navigateur, sans lancer de recherche).
  - 07/11/2026 : fusion `10e3537`, images tirées, conteneurs recréés, démarrage sans erreur. Sur `https://namorama.com/app` (navigateur français, `/events` et `/replay` bloqués), les trois styles sont décrits, la mise en avant suit le choix, et la phrase suit le critère d'extensions.

## Workflow follow-up

- Après deux semaines, relire les sessions enregistrées à l'étape de cadrage : noter combien basculent le style puis reviennent au premier choix, et comparer aux 3 sur 16 du relevé initial.
- Archiver `refondre-l-ecran-de-cadrage` d'abord, puis ce chantier (`/opsx:archive`).
