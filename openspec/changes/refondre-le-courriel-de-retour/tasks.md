# Tasks

## 1. Clore le chantier d'origine

- [ ] 1.1 Archiver `demande-de-retour-automatique`, livré en production le 01/11/2026 et dont la capacité `retours-utilisateurs/demande-de-retour` est celle que ce chantier modifie. Avant l'archivage :
  - cocher 7.1 et 7.2 avec la preuve en production : les colonnes `user.demandeRetourAt`, `utilite`, `desinscritRetoursAt` et `admin_mail.automatique` existent, et `demande_retour_passage` est journalisé chaque heure ;
  - noter sous son suivi le relevé du 25/11/2026 : 36 délivrés, 0 réponse, 1 désinscription, mail-tester 10/10.

  Vérification : `openspec/specs/retours-utilisateurs/demande-de-retour/spec.md` existe, `openspec validate --all` passe, et `openspec validate refondre-le-courriel-de-retour` passe contre la spec archivée.

## 2. Le gabarit : question, ordre, objet (API)

- [ ] 2.1 Réécrire dans `GABARITS` (sept langues) le bloc de réponse en un clic :
  - la question « Avez-vous trouvé un nom qui vous plaît ? » ;
  - les réponses « Oui, j'en ai un » (lien `oui`) et « Pas encore » (lien `non`), chacune de moins de 20 caractères ;
  - la phrase « Un clic suffit : il vous rapporte 100 crédits. »

  Puis remettre l'ordre de `composer` selon D2 : la question avant la présentation, et la phrase du modèle après les réponses. Vérification : `admin-mail.spec.ts` vérifie l'ordre des blocs en français pour l'automatique et pour le manuel, les libellés anglais de la spec, et que `verifierBrouillon` ne lève aucune alerte sur un brouillon complet.
- [ ] 2.2 Remplacer `OBJET` par la question, dans les sept langues, sans emoji. Le courriel manuel reprend cet objet. Vérification : test sur l'objet français et allemand. Dans `demande-de-retour.spec.ts`, le courriel automatique capturé porte le nouvel objet.
- [ ] 2.3 Passer `CONSIGNES_VERSION` à la date de réalisation. Vérification : `admin-mail.spec.ts` et `demande-de-retour.spec.ts` lisent la nouvelle valeur dans la ligne `admin_mail` écrite.

## 3. Les réponses en boutons (API)

- [ ] 3.1 Dans `mettreEnPage`, rendre en bouton tout lien nommé dont l'adresse contient `/retour?j=` (D3). Les liens d'un même paragraphe vont côte à côte dans un seul tableau. Les boutons sont identiques : fond `#0d7a4e`, texte blanc gras, `padding` 14 × 22 px, rayon 8 px. Rien d'autre ne change : texte échappé, liens ordinaires, aucune image. Vérification, dans `admin-mail.spec.ts` :
  - deux liens de réponse donnent deux boutons de styles identiques ;
  - un lien vers le site ou le formulaire reste un `<a>` simple ;
  - un guillemet dans un libellé reste échappé ;
  - `versionTexte` rend « Oui, j'en ai un (https://…) » ;
  - un brouillon retouché qui garde les deux liens garde ses boutons.
- [ ] 3.2 Ajouter au §5 de `docs/systeme-de-design.md` le **bouton de réponse d'e-mail** : quand l'employer (une réponse en un clic, jamais un appel commercial), son rendu, et l'exception assumée à la règle 5 (deux boutons identiques pour deux réponses de même valeur). Vérification : relecture, et le §2 renvoie au §5 pour les e-mails.
- [ ] 3.3 Envoi réel d'un courriel automatique de la nouvelle version, depuis un worktree (`just agent-env`), avec le vrai SMTP et vers des boîtes de test uniquement : mail-tester, une adresse Gmail et une adresse Outlook.com. Vérification :
  - mail-tester reste à 10/10 ;
  - sur Gmail mobile (390 px), Gmail web et Outlook.com, les deux boutons s'affichent côte à côte, de même taille, avec une hauteur d'au moins 44 px ;
  - l'objet et la première ligne de l'aperçu montrent la question ;
  - un clic sur chaque bouton ouvre `/retour` et enregistre la réponse dans la base du worktree.

  Noter les résultats sous la tâche.

## 4. La version dans la mesure

- [ ] 4.1 Ajouter `version` à `feedback_request_sent` (`CONSIGNES_VERSION`, dans `demande-de-retour.service.ts`). Ajouter aussi `version` à `feedback_utility_answered` : le `promptVersion` du dernier `admin_mail` délivré au compte, ou `null` s'il n'y en a pas (dans `retours.service.ts`). Vérification :
  - `demande-de-retour.spec.ts` lit la version dans l'événement d'envoi ;
  - `retours.controller.spec.ts` couvre une réponse après un courriel de la nouvelle version, une réponse après un courriel en `'2026-11-01.1'` (ancienne version), et une réponse sans courriel (`version: null`).
- [ ] 4.2 Ajouter la commande `retours` à `scripts/analyze-logs.py`. Par `version`, elle donne : envois délivrés, réponses, part de « oui », délai médian de réponse, désinscriptions (rattachées à la version du dernier envoi au même `sub`). Vérification : `ssh namorama-prod "python3 - retours" < scripts/analyze-logs.py` rend, avant déploiement, une seule ligne `2026-11-01.1` qui concorde avec le relevé : 33 envois automatiques délivrés, 0 réponse, 1 désinscription.
- [ ] 4.3 Dans `admin-users.component.ts`, remplacer l'infobulle « Réponse à « Namorama vous a-t-il été utile ? » » par un libellé neutre : « Réponse en un clic à la demande de retour ». Vérification : au navigateur, sur la page admin des utilisateurs d'un worktree, avec un compte de test ayant répondu, en clair et en sombre. `just design-check` passe.
- [ ] 4.4 Mettre à jour CLAUDE.md :
  - « Demander un retour à un utilisateur » : la question, l'ordre, l'objet, les boutons, la version, et le relevé du 25/11/2026 ;
  - « Nommage des événements » : le champ `version` ;
  - « Consulter les logs en prod » : la commande `retours`.

  Vérification : relecture. `cd api && npx jest && npm run build` passent.

## 5. Livraison

- [ ] 5.1 Rebaser sur `main`, ouvrir la PR, attendre la CI verte, merger, attendre le build, puis déployer l'API seule (`docker compose pull api && docker compose up -d api`). Vérification : conteneur `Up`, et `demande_retour_passage` journalisé au passage horaire suivant, sans erreur.

## Workflow follow-up

- Au premier envoi réel : `feedback_request_sent` porte la nouvelle `version`, et `admin_mail` montre le nouvel objet.
- Après 30 envois de la nouvelle version (environ un mois), lancer `python3 - retours` et comparer à `2026-11-01.1` (0 réponse sur 33). Noter ici : taux de réponse, part de « oui », désinscriptions, réponses en moins de 10 s (analyseurs).
- Archiver le chantier, puis vérifier que `openspec validate --all` passe.
