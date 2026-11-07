# Tasks

## 1. Origine d'une visite (API)

- [x] 1.1 Écrire `api/migrations/2026-11-07-canaux-d-acquisition.sql` : cinq colonnes nullables sur `visitor_session` en `ADD COLUMN IF NOT EXISTS`, avec la commande d'application et le retour arrière en en-tête. Vérification : le script s'applique deux fois de suite sans erreur sur la base locale `namorama_w3`, et `SHOW COLUMNS FROM visitor_session` liste les cinq colonnes.
- [x] 1.2 Ajouter les colonnes à `VisitorSession`, et créer `api/src/common/funnel/origine.ts` avec `origineDeLaVisite()` (nettoyage) et `canalDe()` (classement). Vérification : `origine.spec.ts` couvre chaque scénario de `specs/canaux-d-acquisition/spec.md` et passe sous `npx jest origine`.
- [x] 1.3 Faire écrire l'origine par `FunnelService.visite()` à l'insertion seulement, et la faire lire par `EventsController` depuis `page_viewed`. Vérification : un test de `funnel` montre qu'un second `page_viewed` de la même visite ne modifie ni la page d'arrivée ni la source, et que `marquer()` crée une visite sans origine.
- [x] 1.4 Documenter dans CLAUDE.md, « Parcours utilisateur » : ce que retient une visite, ce qui n'est jamais gardé, et où se corrige le classement. Vérification : relecture du paragraphe.

## 2. Origine envoyée par le navigateur (web)

- [x] 2.1 Lire l'origine dans le constructeur de `AnalyticsService` et la joindre au seul premier `page_viewed` du document, référent réduit à son domaine. Vérification : un test de `analytics` montre que le premier envoi porte `utmSource` et `referent`, que le second n'en porte pas, et qu'un référent `https://mail.example.com/inbox?user=x` part sous la forme `mail.example.com`.
- [x] 2.2 Vérifier de bout en bout en local : ouvrir `http://localhost:4203/generateur-nom-de-marque?utm_source=chatgpt.com` dans un navigateur neuf, puis lire la ligne `visitor_session` de la visite dans `namorama_w3`. Vérification : `landingPath = /generateur-nom-de-marque` et `utmSource = chatgpt.com`, puis inchangés après la navigation vers `/app`.
  - 07/11/2026, Chromium sans interface : arrivée `/generateur-nom-de-marque?utm_source=chatgpt.com&utm_medium=referral`, référent `https://www.google.fr/search?q=…`, puis rechargement complet de `/app` dans la même visite. Ligne écrite : `landingPath=/generateur-nom-de-marque`, `utmSource=chatgpt.com`, `utmMedium=referral`, `referrerHost=google.fr`, inchangée après le rechargement.

## 3. Section « Canaux d'acquisition » (tableau de bord)

- [x] 3.1 Ajouter l'agrégat `acquisition` à `AdminService`, avec sa fenêtre bornée par le début de la mesure et son `try/catch` qui renvoie `null`. Vérification : tests d'`admin.service` sur une base semée (classement, regroupement « Autres pages » au-delà de 8, visites antérieures à la mesure exclues, connectées à l'arrivée retirées du dénominateur des comptes).
- [x] 3.2 Afficher la section dans `AdminDashboardComponent` : deux `nm-table`, taux masqués sous 5 visites, « mesuré depuis le … », état « indisponible ». Vérification : au navigateur sur `http://localhost:4203/admin/dashboard`, avec une base semée d'au moins 20 visites réparties sur 4 canaux et 10 pages, en thème clair et sombre, à 390 px et sur ordinateur ; capture notée sous la tâche.
  - 07/11/2026, Chromium sans interface, base `namorama_w3` semée de 27 visites (`seed-canaux-*`, dont 2 antérieures à la mesure), compte admin temporaire du Keycloak local. Ordinateur 1280 px et 390 px, thèmes clair et sombre : ChatGPT 11 visites, 4 comptes (40 %) pour 10 visites arrivées sans compte, 6 recherches ; les 2 visites antérieures n'apparaissent nulle part ; « Autres pages » regroupe 4 pages ; lignes sous 5 visites sans pourcentage ; « mesuré depuis le 1 novembre 2026 » ; aucun débordement horizontal à 390 px. Deux corrections faites en vérifiant : texte illisible en thème sombre (couleur héritée), et tableaux côte à côte trop serrés (empilés désormais).
- [x] 3.3 Passer `just design-check`. Vérification : la commande se termine sans erreur.
- [x] 3.4 Documenter dans CLAUDE.md, « Entonnoir de conversion » : la section des canaux, son début de mesure et ses limites (référent vide, « ou inconnu »). Vérification : relecture du paragraphe.

## 4. Livraison

- [x] 4.1 Ouvrir la pull request, attendre la CI verte. Vérification : `gh pr checks` tout vert.
  - PR #183, 07/11/2026 : cinq contrôles verts (tests API, système de design, images API et web).
- [x] 4.2 Appliquer `2026-11-07-canaux-d-acquisition.sql` en production, sauvegarde datée de la table faite d'abord dans `backups/`, **avant** de déployer l'image. Vérification : `SHOW COLUMNS FROM visitor_session LIKE 'landingPath'` rend une ligne en production.
  - 07/11/2026 10:29 : sauvegarde `backups/visitor_session-2026-11-07-avant-canaux-d-acquisition.sql`, migration appliquée, colonne présente, 752 visites intactes.
- [x] 4.3 Fusionner, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web` sur `namorama-prod`. Vérification : `docker compose ps` montre les deux conteneurs recréés, les logs de démarrage sont sans erreur, et une visite de test sur `https://namorama.com/?utm_source=test-deploiement` crée une ligne portant cette source.
  - 07/11/2026 10:34 : fusion `2c4d5fb`, images tirées, conteneurs recréés, « Nest application successfully started » sans erreur. Visite de test (Chromium, référent google.fr) : `landingPath=/`, `utmSource=test-deploiement`, `referrerHost=google.fr`.

## Workflow follow-up

- Après une semaine, lire la section au tableau de bord et noter sous 4.3 la part de chaque canal, en particulier celle de « Direct ou inconnu ». Si elle dépasse la moitié, revoir le classement des référents.
- Supprimer la visite de test `test-deploiement` de `visitor_session`, après confirmation.
- Archiver le chantier (`/opsx:archive`) une fois ce suivi noté.
