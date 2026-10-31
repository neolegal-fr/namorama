# Tasks

## 1. Point de départ et décisions

- [ ] 1.1 Relever en production, en lecture seule, l'état de départ avec la requête préparée (courriels de demande délivrés et comptes touchés, réponses recopiées, feedbacks reçus après un courriel, feedbacks récompensés, délai moyen entre inscription et courriel, inscriptions mesurées des 30 derniers jours avec adresse et avec langue, inscrits jamais contactés). Vérification : chiffres et date notés sous cette tâche, et la phrase « le volume ne se mesure pas encore » de proposal.md remplacée par eux.
- [ ] 1.2 Faire confirmer par l'utilisateur les quatre décisions prises par défaut (design, « Décisions produit tranchées sans consultation »), et le texte français de D2. Vérification : réponse notée sous cette tâche, et design et spécification amendés si une décision change.

## 2. Données et liens signés (API)

- [ ] 2.1 Écrire `api/migrations/2026-11-XX-demande-de-retour-automatique.sql` (D6), idempotent, avec commande d'application et retour arrière, et mettre à jour les entités `User` et `AdminMail`. Vérification : appliquée deux fois sur la base du worktree sans erreur, colonnes présentes, `cd api && npx tsc --noEmit` passe.
- [ ] 2.2 Écrire `liens-de-retour.ts` : `signer(keycloakId, action)` et `verifier(jeton)` (HMAC-SHA256, comparaison à temps constant, expiration à 90 jours, D3). Vérification : `liens-de-retour.spec.ts` couvre un aller-retour valide, une signature altérée, un compte changé, une action changée, un jeton expiré, et l'absence de secret (refus).
- [ ] 2.3 Capter `langueInscription` à la création du compte depuis `Accept-Language`, limité aux langues de `GABARITS` (D4). Vérification : test de `findOrCreateDetaille` (`de-DE,de;q=0.9` → `de`, `zh-CN` → `null`, compte existant inchangé).

## 3. Gabarit en deux temps (API)

- [ ] 3.1 Ajouter à `GABARITS` la question d'utilité, la demande détaillée resserrée et le pied de désinscription, dans les sept langues. Rendre `contexte` facultatif dans `composer`. Étendre `verifierBrouillon` aux liens oui / non et aux 100 crédits, et changer `CONSIGNES_VERSION` (D2). Vérification : `admin-mail.spec.ts` couvre les deux compositions (automatique sans phrase, manuelle avec), l'ordre des blocs, et un brouillon privé du lien « non » signalé.
- [ ] 3.2 Faire suivre au courriel manuel la nouvelle structure, avec des liens oui / non signés pour le compte visé. Vérification : sur `claude-haiku-5-5` réel, deux brouillons pour deux comptes de la base du worktree, notés sous cette tâche, contenant la phrase personnalisée puis les deux temps, sans alerte de `verifierBrouillon`.
- [ ] 3.3 Étendre `MailService.send` aux en-têtes, et poser `List-Unsubscribe` et `List-Unsubscribe-Post` sur les courriels automatiques. Vérification : test de `MailService` sur les options transmises à nodemailer.

## 4. Envoi automatique (API)

- [ ] 4.1 Écrire `DemandeDeRetourService` (D1, D5) : sélection des éligibles, réservation par `UPDATE … WHERE demandeRetourAt IS NULL`, composition sans modèle, envoi, ligne `admin_mail` automatique, événements `feedback_request_sent` et `demande_retour_passage`. Minuterie horaire, premier passage 5 minutes après le démarrage, inactive sans `FEEDBACK_SIGNATAIRE`, `FEEDBACK_LINK_SECRET` ou `FEEDBACK_AUTO_DEPUIS`. Vérification : `demande-de-retour.spec.ts` couvre chaque cas d'éligibilité de la spécification (interne, admin, sans adresse, moins de 24 h, antérieur à la mise en service, déjà contacté, feedback déjà donné, désinscrit), la réservation concurrente (deux passages simultanés, un seul envoi), l'échec SMTP (noté non délivré, pas de nouvel essai), et l'absence d'appel au modèle.
- [ ] 4.2 Refuser l'envoi manuel à un compte désinscrit (409). Vérification : test du contrôleur admin.
- [ ] 4.3 Vérifier l'envoi réel en local avec le faux SMTP sur 2525 (cf. mémoire de test local) : un compte de test daté d'il y a 25 heures reçoit le courriel au premier passage, et un second passage n'envoie rien. Vérification : courriel capturé, en français et en allemand (`langueInscription`), noté sous cette tâche avec ses en-têtes.

## 5. Réponse et désinscription (API et web)

- [ ] 5.1 Ajouter `POST /retours/utilite` et `POST /retours/desinscription` (publics, D3) : vérification du jeton, enregistrement idempotent, 100 crédits dans la même transaction, événements `feedback_utility_answered` (avec `delaiDepuisEnvoiS`) et `feedback_unsubscribed`. Vérification : tests du contrôleur pour un premier oui (crédité), un second clic (non crédité, `dejaRepondu`), un jeton falsifié (400, rien d'écrit), une désinscription, et le POST de désinscription en un clic (`List-Unsubscribe=One-Click`).
- [ ] 5.2 Ajouter les pages publiques `/retour` et `/desinscription` : appel au chargement, remerciement et crédits, relance vers le formulaire détaillé (après un non : « qu'est-ce qui vous a manqué ? »), cas « déjà répondu » et « lien invalide », libellés fr et en, sans style en ligne. Vérification : au navigateur, avec un jeton de test, chaque cas s'affiche, et `curl` sur l'adresse du lien (sans exécuter la page) n'enregistre rien. Le cliquet du système de design passe.
- [ ] 5.3 Afficher dans le tableau admin des utilisateurs la demande automatique envoyée, la réponse oui / non et la désinscription. Dans le dialogue de courriel, signaler un compte désinscrit et masquer l'envoi. Vérification : au navigateur, avec des comptes de test dans ces trois états.

## 6. Documentation

- [ ] 6.1 Réécrire la section « Demander un retour à un utilisateur » de CLAUDE.md (envoi automatique, deux temps, liens signés, désinscription, variables), et documenter les trois événements dans « Nommage des événements ». Vérification : relecture, puis `cd api && npx jest && npm run build` et `cd web && npx ng build && npx ng test --watch=false` passent.

## 7. Livraison

- [ ] 7.1 Appliquer la migration en production après sauvegarde datée, et vérifier les colonnes. Vérification : `SHOW COLUMNS` en production.
- [ ] 7.2 Ajouter `FEEDBACK_LINK_SECRET`, `FEEDBACK_SIGNATAIRE` et `FEEDBACK_AUTO_DEPUIS` au `docker-compose.yml` de prod (sauvegarde datée du fichier avant), merger, attendre le build, puis déployer. Vérification : conteneurs `Up`, et `demande_retour_passage` journalisé dans les 10 minutes avec `eligibles: 0`, puisque aucun compte n'a encore 24 h depuis la mise en service.

## Workflow follow-up

- Le lendemain du déploiement : vérifier le premier envoi réel (`feedback_request_sent`, `delivered: true`) et l'absence d'échec.
- Après 30 jours : taux de réponse oui / non, part de oui, feedbacks détaillés reçus, désinscriptions, à comparer au relevé de la tâche 1.1. Signaler les réponses de moins de 10 s (analyseurs qui exécutent la page).
- Archiver le chantier, puis vérifier que `openspec/specs/retours-utilisateurs/demande-de-retour/` existe et que `openspec validate --all` passe.
