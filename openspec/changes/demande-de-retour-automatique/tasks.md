# Tasks

## 1. Point de départ et décisions

- [ ] 1.1 Relever en production, en lecture seule, l'état de départ avec la requête préparée (courriels de demande délivrés et comptes touchés, réponses recopiées, feedbacks reçus après un courriel, feedbacks récompensés, délai moyen entre inscription et courriel, inscriptions mesurées des 30 derniers jours avec adresse et avec langue, inscrits jamais contactés). Vérification : chiffres et date notés sous cette tâche, et la phrase « le volume ne se mesure pas encore » de proposal.md remplacée par eux.
- [x] 1.2 Faire confirmer par l'utilisateur les quatre décisions prises par défaut (design, « Décisions produit tranchées sans consultation »), et le texte français de D2. Vérification : réponse notée sous cette tâche, et design et spécification amendés si une décision change.
  - 31/10/2026 : « ok pour les 4 décisions ». Les quatre sont confirmées telles quelles, sans amendement.
  - Le texte français de D2 n'a pas été commenté. Il est pris comme base, et reste relisible sur le premier courriel capturé en local (tâche 4.3).

## 2. Données et liens signés (API)

- [x] 2.1 Écrire `api/migrations/2026-11-XX-demande-de-retour-automatique.sql` (D6), idempotent, avec commande d'application et retour arrière, et mettre à jour les entités `User` et `AdminMail`. Vérification : appliquée deux fois sur la base du worktree sans erreur, colonnes présentes, `cd api && npx tsc --noEmit` passe.
  - Fichier : `2026-11-01-demande-de-retour-automatique.sql`. Appliqué deux fois sur `namorama_w2` : les cinq colonnes de `user` sont présentes, ainsi que `admin_mail.automatique`, et `adminSub` est désormais nullable. `tsc --noEmit` passe.
- [x] 2.2 Écrire `liens-de-retour.ts` : `signer(keycloakId, action)` et `verifier(jeton)` (HMAC-SHA256, comparaison à temps constant, expiration à 90 jours, D3). Vérification : `liens-de-retour.spec.ts` couvre un aller-retour valide, une signature altérée, un compte changé, une action changée, un jeton expiré, et l'absence de secret (refus).
  - `api/src/retours/liens-de-retour.ts` (`signerLien`, `verifierLien`). 7 tests : les cas demandés, plus un autre secret et les entrées malformées.
- [x] 2.3 Capter `langueInscription` à la création du compte depuis `Accept-Language`, limité aux langues de `GABARITS` (D4). Vérification : test de `findOrCreateDetaille` (`de-DE,de;q=0.9` → `de`, `zh-CN` → `null`, compte existant inchangé).
  - `langueDuNavigateur` (`retours/langues.ts`, respecte les poids `q`) et lecture de l'en-tête par le contexte de requête existant.
  - `langues.spec.ts` passe `findOrCreateDetaille` par le vrai intercepteur de contexte. Les trois cas demandés passent, plus l'ordre des poids et l'absence d'en-tête.

## 3. Gabarit en deux temps (API)

- [x] 3.1 Ajouter à `GABARITS` la question d'utilité, la demande détaillée resserrée et le pied de désinscription, dans les sept langues. Rendre `contexte` facultatif dans `composer`. Étendre `verifierBrouillon` aux liens oui / non et aux 100 crédits, et changer `CONSIGNES_VERSION` (D2). Vérification : `admin-mail.spec.ts` couvre les deux compositions (automatique sans phrase, manuelle avec), l'ordre des blocs, et un brouillon privé du lien « non » signalé.
  - `GABARITS` gagne `hier`, `utilite` et `desinscription`. La demande détaillée est resserrée, dans les sept langues. `CONSIGNES_VERSION` passe à `2026-11-01.1`, et la consigne du modèle situe sa phrase avant la question d'utilité.
  - `admin-mail.spec.ts` : 32 tests, dont les deux compositions dans chaque langue, l'ordre des blocs, le lien « non » manquant, et l'absence de secret (bloc retiré, alerte).
- [x] 3.2 Faire suivre au courriel manuel la nouvelle structure, avec des liens oui / non signés pour le compte visé. Vérification : sur `claude-haiku-5-5` réel, deux brouillons pour deux comptes de la base du worktree, notés sous cette tâche, contenant la phrase personnalisée puis les deux temps, sans alerte de `verifierBrouillon`.
  - Écart : le fournisseur configuré en local est OpenAI (le défaut), pas Claude comme en production. La phrase personnalisée passe par la même consigne. Ce qui change dans ce chantier (la structure, les liens signés) ne dépend pas du modèle.
  - Relevé du 31/10/2026, `POST /admin/users/:id/mails/draft`, aucune alerte dans les deux cas :
    - compte 908 (fr) : « J'ai vu que vous avez recherché un nom pour une marque de cosmétiques solides et rechargeables à base d'algues, et acheté un rapport pour refillkelp. », puis oui / non signés, puis la demande détaillée ;
    - compte 2 (en) : « I saw that you explored a name for a connected bracelet helping visually impaired people find lost items, and purchased a brand report for Tagserene. », même structure, en anglais.
- [x] 3.3 Étendre `MailService.send` aux en-têtes, et poser `List-Unsubscribe` et `List-Unsubscribe-Post` sur les courriels automatiques. Vérification : test de `MailService` sur les options transmises à nodemailer.
  - Nouveau `mail.service.spec.ts` (3 tests) : en-têtes transmis, aucun en-tête inventé, un refus SMTP rend `false`. En-têtes vus sur les courriels capturés (4.3).

## 4. Envoi automatique (API)

- [x] 4.1 Écrire `DemandeDeRetourService` (D1, D5) : sélection des éligibles, réservation par `UPDATE … WHERE demandeRetourAt IS NULL`, composition sans modèle, envoi, ligne `admin_mail` automatique, événements `feedback_request_sent` et `demande_retour_passage`. Minuterie horaire, premier passage 5 minutes après le démarrage, inactive sans `FEEDBACK_SIGNATAIRE`, `FEEDBACK_LINK_SECRET` ou `FEEDBACK_AUTO_DEPUIS`. Vérification : `demande-de-retour.spec.ts` couvre chaque cas d'éligibilité de la spécification (interne, admin, sans adresse, moins de 24 h, antérieur à la mise en service, déjà contacté, feedback déjà donné, désinscrit), la réservation concurrente (deux passages simultanés, un seul envoi), l'échec SMTP (noté non délivré, pas de nouvel essai), et l'absence d'appel au modèle.
  - `admin/demande-de-retour.service.ts`. `demande-de-retour.spec.ts` (9 tests) couvre :
    - la composition sans modèle (le service ne dépend pas de `ModeleIA`), la langue d'inscription, les liens signés et les en-têtes ;
    - la réservation déjà prise (aucun envoi) et deux passages simultanés (un seul envoi) ;
    - l'échec SMTP (non délivré, réservation gardée) ;
    - la configuration incomplète (variable nommée, aucune minuterie).
  - Écart : les cas d'éligibilité ne sont pas dans la spec unitaire, car une sélection SQL simulée ne prouverait rien. Ils sont vérifiés sur la vraie base en 4.3, avec un compte par cas.
  - Ajout hors tâche : `POST /admin/demandes-de-retour/passage` (admin) lance un passage tout de suite. Il a servi à la 4.3 et servira au contrôle de la 7.2.
- [x] 4.2 Refuser l'envoi manuel à un compte désinscrit (409). Vérification : test du contrôleur admin.
  - `admin.controller.spec.ts` : 409 sans appel SMTP, et la route de passage (bilan, ou variables manquantes).
- [x] 4.3 Vérifier l'envoi réel en local avec le faux SMTP sur 2525 (cf. mémoire de test local) : un compte de test daté d'il y a 25 heures reçoit le courriel au premier passage, et un second passage n'envoie rien. Vérification : courriel capturé, en français et en allemand (`langueInscription`), noté sous cette tâche avec ses en-têtes.
  - 31/10/2026, base `namorama_w2`, mise en service locale au 30/10, dix comptes de test.
  - Premier passage : `{"eligibles":2,"envoyes":2,"echecs":0}`. Seuls les deux comptes éligibles sont servis. Les huit cas d'exclusion ont tenu : interne, admin, sans adresse, moins de 24 h, antérieur à la mise en service, déjà contacté à la main, feedback déjà donné, désinscrit.
  - Second passage : `{"eligibles":0,"envoyes":0,"echecs":0}`.
  - Courriels capturés :
    - « Une question rapide sur Namorama » (fr, sans langue connue) ;
    - « Eine kurze Frage zu Namorama » (de, depuis `langueInscription`) ;
    - les deux avec `List-Unsubscribe: <…/retours/desinscription?j=…>` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, la question oui / non à 100 crédits, la demande détaillée à 500 crédits, la signature « Nicolas Riousset » et le pied de désinscription.

## 5. Réponse et désinscription (API et web)

- [x] 5.1 Ajouter `POST /retours/utilite` et `POST /retours/desinscription` (publics, D3) : vérification du jeton, enregistrement idempotent, 100 crédits dans la même transaction, événements `feedback_utility_answered` (avec `delaiDepuisEnvoiS`) et `feedback_unsubscribed`. Vérification : tests du contrôleur pour un premier oui (crédité), un second clic (non crédité, `dejaRepondu`), un jeton falsifié (400, rien d'écrit), une désinscription, et le POST de désinscription en un clic (`List-Unsubscribe=One-Click`).
  - `retours.controller.spec.ts` (9 tests) : les cas demandés, plus un lien de désinscription refusé comme réponse, un compte supprimé, une seconde désinscription sans second événement, et un lien « oui » refusé pour la désinscription.
  - Défaut trouvé au navigateur (5.2) : le `@Public()` importé de `common/decorators` n'a aucun effet sur le garde Keycloak (401). C'est désormais celui de `nest-keycloak-connect`, comme partout ailleurs.
- [x] 5.2 Ajouter les pages publiques `/retour` et `/desinscription` : appel au chargement, remerciement et crédits, relance vers le formulaire détaillé (après un non : « qu'est-ce qui vous a manqué ? »), cas « déjà répondu » et « lien invalide », libellés fr et en, sans style en ligne. Vérification : au navigateur, avec un jeton de test, chaque cas s'affiche, et `curl` sur l'adresse du lien (sans exécuter la page) n'enregistre rien. Le cliquet du système de design passe.
  - Navigateur, avec les liens réels des courriels capturés :
    - premier « oui » (fr) : « Merci pour votre réponse ! », 100 crédits ;
    - second « oui », puis « non » : « Votre réponse était déjà notée ». En base, la réponse reste « oui » et les crédits restent à +100 ;
    - premier « non » (en-US) : « Thanks for your answer! », et la relance « What got in your way, or what was missing? » ;
    - désinscription : « Vous êtes désinscrit » ;
    - lien altéré et lien sans jeton : « Ce lien n'est pas valide » ;
    - aucune clé brute.
  - `curl` sur le lien « non » avant tout clic : 200 (la page), et rien en base.
  - Icône de page agrandie (la règle `.pi` de PrimeIcons imposait sa taille), contrôlée à 56 px. Le cliquet passe : aucune valeur en dur ajoutée.
- [x] 5.3 Afficher dans le tableau admin des utilisateurs la demande automatique envoyée, la réponse oui / non et la désinscription. Dans le dialogue de courriel, signaler un compte désinscrit et masquer l'envoi. Vérification : au navigateur, avec des comptes de test dans ces trois états.
  - Navigateur, administrateur de test : le compte français porte `auto` et `oui`, le compte allemand `auto`, `non` et `désinscrit`.
  - Dialogue du compte désinscrit : alerte « s'est désinscrit des demandes de retour le 31/10/26 », pas de bouton Envoyer, aucun brouillon demandé au modèle.

## 6. Documentation

- [x] 6.1 Réécrire la section « Demander un retour à un utilisateur » de CLAUDE.md (envoi automatique, deux temps, liens signés, désinscription, variables), et documenter les trois événements dans « Nommage des événements ». Vérification : relecture, puis `cd api && npx jest && npm run build` et `cd web && npx ng build && npx ng test --watch=false` passent.
  - Section réécrite en trois parties : envoi automatique, liens signés et réponse en un clic, courriel manuel. Les trois événements sont documentés dans « Nommage des événements ».
  - API : 44 suites, 455 tests verts, `npm run build` OK. Web : `ng build` OK, 60 tests verts, cliquet du système de design OK.

## 7. Livraison

- [ ] 7.1 Appliquer la migration en production après sauvegarde datée, et vérifier les colonnes. Vérification : `SHOW COLUMNS` en production.
- [ ] 7.2 Ajouter `FEEDBACK_LINK_SECRET`, `FEEDBACK_SIGNATAIRE` et `FEEDBACK_AUTO_DEPUIS` au `docker-compose.yml` de prod (sauvegarde datée du fichier avant), merger, attendre le build, puis déployer. Vérification : conteneurs `Up`, et `demande_retour_passage` journalisé dans les 10 minutes avec `eligibles: 0`, puisque aucun compte n'a encore 24 h depuis la mise en service.

## Workflow follow-up

- Le lendemain du déploiement : vérifier le premier envoi réel (`feedback_request_sent`, `delivered: true`) et l'absence d'échec.
- Après 30 jours : taux de réponse oui / non, part de oui, feedbacks détaillés reçus, désinscriptions, à comparer au relevé de la tâche 1.1. Signaler les réponses de moins de 10 s (analyseurs qui exécutent la page).
- Archiver le chantier, puis vérifier que `openspec/specs/retours-utilisateurs/demande-de-retour/` existe et que `openspec validate --all` passe.
