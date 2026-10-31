# Tasks

## 1. Relevé initial

- [ ] 1.1 Relever en lecture seule, sur les projets des comptes mesurés (`comptesMesures()`), la base de comparaison de ce chantier : répartition de `project.minLength`, part de `matchMode = 'all'` sur plusieurs extensions, nombre d'extensions par projet, projets avec `likedExamples` ou `dislikedExamples` non vides, briefs qui fixent une longueur sous 6. Lancer aussi `python3 - funnel` et `python3 - ajouts` (`scripts/analyze-logs.py`). Vérification : chiffres datés notés sous cette tâche, sans description ni adresse recopiée. La requête du 31/10/2026 a été refusée par le contrôle des lectures de production ; elle est à lancer par Nicolas, ou à autoriser.

## 2. Bornes de longueur côté serveur (API)

- [x] 2.1 Créer `web/src/app/components/wizard/bornes-de-longueur.cas.json`, la table partagée des cas de D2 : brief [4, 5] → [6, 6] ; brief [null, 8] → [6, 8] ; brief [8, null] → [8, 10] ; rien → [6, 10] ; réglage `maxLength` 9 sur brief [4, 5] → [6, 9] ; `maxLength` 30 → [6, 30] ; `minLength` hérité 5 → [6, 10] ; `minLength` hérité 7 → [7, 10] ; brief [8, null] et `maxLength` 7 → [6, 7]. Vérification : fichier JSON valide, lu par 2.2.
- [x] 2.2 Passer `MIN_NAME_LENGTH_FLOOR` à 6 et le défaut à [6, 10], puis réécrire `bornesDeLongueur` selon D2. `recherche-boucle.spec.ts` lit la table de 2.1 via `fs` et remplace les six cas actuels. Vérification : `cd api && npx jest src/domain/recherche-boucle.spec.ts` passe.
  - 13 cas de la table passent. Ajouts de la table : brief « au moins 11 » → [11, 13] (le maximum par défaut suit, deux de plus), « au plus 12 » sur « au moins 8 » → [8, 12].
  - Écart nécessaire à la spec (« au plus N », « 6 à 10 par défaut ») : `respecteLesContraintes` ne donne plus de lettre de tolérance au-delà du maximum quand le brief n'en fixe pas. Sans ce retrait, « au plus 10 » rendait des noms de 11. Tests mis à jour : `filtre-contraintes.spec.ts` et `contraintes.spec.ts` (défauts [6, 10]).
- [x] 2.3 `SearchDomainsDto.maxLength` passe à `@Min(6)` ; `minLength` reste accepté de 5 à 12 et relevé au plancher. Vérification : un test du DTO (pattern de `contraintes.spec.ts`) accepte `{ minLength: 5 }` et `{ maxLength: 30 }`, et refuse `{ maxLength: 5 }`.
- [x] 2.4 Dans `generateDomainIdeas`, décider le mode court par `maxLen <= 7`, retirer les exemples courts sous le plancher, et ne citer en contre-exemple « trop court » que des noms de moins de `minLen` caractères (D4). Vérification : un test sur la consigne construite, sur le modèle du test `excludeNames.slice(-200)`, couvre trois cas : avec [6, 10], pas de « SHORT » ni de « trelox » ; avec [6, 7], le mode court sans « orva » ; avec [8, 10], « trelox » cité comme trop court.
- [x] 2.5 Mettre à jour `requetes-openai.spec.ts` pour les nouvelles bornes par défaut. Dans CLAUDE.md, section « Fournisseur du modèle », mentionner l'écart de parité ; section « Cahier des charges du nom », remplacer « Plancher technique : 5 » et « sans jamais élargir un maximum demandé » par les règles de D1 et D2. Vérification : `cd api && npx jest && npm run build` passent, et le diff de CLAUDE.md porte les deux sections.
  - 36 suites et 370 tests passent, `nest build` aussi. `requetes-openai.spec.ts` passe sans retouche : il ne vérifie pas le texte des bornes.
- [ ] 2.6 Vérifier sur `claude-haiku-5-5` réel, par un script jetable hors dépôt, la génération pour trois briefs paraphrasés : « nom court, 4-5 lettres » ; « pas plus de 8 lettres » ; aucun brief de longueur. Vérification : bornes de `search_completed` notées sous cette tâche ([6, 6], [6, 8], [6, 10]), et au moins 8 noms sur 10 dans les bornes avant filtrage.
  - Relevé du 31/10/2026, script jetable hors dépôt. **Bornes conformes dans les trois cas** : [6, 6] (brief « 4-5 lettres », origine `brief`), [6, 8] et [6, 10] (`defaut`).
  - `gpt-5.6-terra` (fournisseur du `.env` local) : 97 %, 93 % et 100 % des noms inventés dans les bornes avant filtrage.
  - `claude-haiku-5-5` avant retouche : 63 %, 73 % et 94 %. La consigne dit désormais de compter les lettres (« EXACTLY 6 », essayé aussi, donnait 43 %). Après retouche, deux passes : [6, 6] 55 % puis 80 %, [6, 8] 83 % puis 77 %, [6, 10] 93 % puis 100 %.
  - **Critère non tenu de façon stable sur [6, 6] avec Haiku** : le filtre garantit le résultat, mais jusqu'à la moitié des noms d'une tentative sont générés puis écartés. Tâche laissée ouverte, décision demandée : accepter, ou traiter la longueur exacte dans le chantier « diversité ».

## 3. Longueur maximale persistée

- [x] 3.1 Écrire `api/migrations/2026-11-01-longueur-maximale-du-projet.sql` : `ALTER TABLE project ADD COLUMN IF NOT EXISTS maxLength INT NULL`, avec en en-tête la commande d'application et le retour arrière. Vérification : appliqué deux fois sur la base locale sans erreur, et `SHOW COLUMNS FROM project LIKE 'maxLength'` rend une ligne.
  - Appliqué deux fois sur `namorama-db` (local) sans erreur ; `maxLength int(11) NULL`, défaut `NULL`.
- [x] 3.2 Ajouter `maxLength` (nullable) à l'entité `Project` et aux DTO de création et de mise à jour du projet. Cesser d'écrire `minLength`. Vérification : un test du service des projets enregistre puis relit `maxLength: 8`, et un projet créé sans valeur la relit à `null`.
  - `api/src/projects/longueur-maximale.spec.ts` : 4 cas, dont « une recherche sans maximum garde celui déjà choisi ». 37 suites, 374 tests passent.
  - Champ ajouté à `search_started` : `maxLength` (le maximum reçu), à côté de `minLength`.

## 4. Réglage de longueur à l'écran (web)

- [ ] 4.1 Écrire `bornesAffichees(contraintes, reglage)`, fonction pure, dans `web/src/app/components/wizard/`. Son test Vitest importe la table de 2.1. Vérification : `cd web && npx ng test --watch=false` passe, avec les mêmes cas que 2.2.
- [ ] 4.2 Remplacer le `p-selectButton` de longueur minimale par « Au plus N caractères » (6 à 12, « sans limite »), suivi de la phrase d'aide de `bornesAffichees`, de la marque d'origine (« par défaut », « repris de votre description », « modifié ») et de l'alerte « plage étroite » pour un maximum de 7 ou moins. N'envoyer `maxLength` que si l'utilisateur l'a touché, et `30` pour « sans limite ». Retirer la puce de longueur des contraintes. Vérification au navigateur, avec un brief « 4-5 lettres » : le réglage affiche « Au plus 6 caractères » et la phrase d'explication ; la requête n'a pas de `maxLength` ; les 10 noms rendus font 6 caractères.
- [ ] 4.3 Remplacer `minLengthTouched` par `maxLengthTouched` dans l'état `localStorage` et dans la restauration d'un projet (D5), et faire monter le maximum dans `relaxLengthAndRetry` (D9). Vérification au navigateur : régler « Au plus 8 », enregistrer, recharger, rouvrir le projet, et lire « Au plus 8 », marqué « modifié » ; sur une recherche vide, « Assouplir » passe à « Au plus 10 » et relance.
- [ ] 4.4 Libellés fr et en dans `web/public/assets/i18n/`. Vérification : aucune clé `WIZARD.*` brute à l'étape 2, en `fr-FR` comme en `en-US`.

## 5. Mise en page de l'étape 2 (web)

- [ ] 5.1 Nommer l'étape « Cadrage » (« Framing ») dans le titre comme dans le stepper, puis réordonner l'écran en trois `<section>` : « Le nom » (style, longueur, contraintes du brief), « Les domaines » (extensions, critère), « Affiner — facultatif ». Mise en page en styles en ligne (CLAUDE.md). Les libellés de style deviennent « Inventés », « Inventés + descriptifs », « Inventés + culturels ». Vérification au navigateur, sur un projet existant aux 6 mots-clés et aux 2 extensions : ordre et titres conformes à la spec `recherche/ecran-de-cadrage`, et plus aucun « Vos préférences ».
- [ ] 5.2 Ajouter la phrase-résumé en tête, un `computed` sur les signaux existants, avec fragments i18n, sans fragment vide. Vérification : test Vitest de la fonction de composition sur les trois scénarios de la spec ; au navigateur, passer le critère à « toutes » change « ou » en « et » sans clic de plus.
- [ ] 5.3 Replier « Affiner » à l'arrivée, avec son résumé (premiers mots-clés et « +N », public, inspirations ou « Aucune »). Garder l'ouverture au retour depuis les résultats. Expliquer le rôle des mots-clés, et n'afficher le compteur qu'à partir de 40. Placer le repérage du marché sous les inspirations, en lien secondaire avec « environ 15 s ». Vérification au navigateur : arrivée repliée ; ouvrir, lancer, revenir, et le bloc est ouvert ; aucun appel `/domain/competitors` sans clic (onglet réseau).
- [ ] 5.4 Barre d'action collée : « Lancer la recherche », puis coût (`SEARCH_COST_HINT`) et solde (`credits$`) pour un compte connecté ; motif « au moins un mot-clé » à la place du coût quand le bouton est désactivé ; « Voir les résultats » sans coût quand des noms existent. Réserver la hauteur de la barre sous le dernier bloc. Vérification au navigateur, à 1280 px et à 390 px, « Affiner » ouvert : le bouton reste visible en défilant et ne masque aucun champ ; connecté, la barre lit le solde réel ; déconnecté, pas de solde.
- [ ] 5.5 Émettre `wizard_refine_opened` au premier clic d'ouverture, une fois par projet et par session, pas lors d'une réouverture d'office. Documenter l'événement dans CLAUDE.md, section « Nommage des événements ». Vérification : ouvrir, fermer, rouvrir, et un seul événement dans les logs locaux de l'API ; le paragraphe figure dans CLAUDE.md.
- [ ] 5.6 Lancer `cd web && npx ng build && npx ng test --watch=false`. Vérification : tout passe, et le canevas de revue (https://claude.ai/artifact/8xYMAjFZcEN5qScP3La7ju) est comparé à l'écran réel ; les écarts sont notés sous cette tâche.

## 6. Livraison

- [ ] 6.1 Ouvrir la PR depuis `feat/refonte-ecran-de-cadrage`, avec la CI verte. Vérification : `gh pr checks` au vert.
- [ ] 6.2 Appliquer `2026-11-01-longueur-maximale-du-projet.sql` en production, sauvegarde datée faite d'abord, **avant** de déployer l'image. Vérification : `SHOW COLUMNS FROM project LIKE 'maxLength'` en production rend une ligne.
- [ ] 6.3 Fusionner, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web` sur `namorama-prod`. Vérification : `docker compose ps` affiche les deux conteneurs à jour, et une recherche réelle aboutit.

## Workflow follow-up

- Une semaine après le déploiement, lire `search_completed` : la part de `stopReason: time` et de recherches incomplètes, comparée au relevé de 1.1 (18,7 % au 20/10/2026) ; les cas `origineDesBornes: brief` avec `minLengthUsed: 6` ; la part de `maxLengthUsed <= 7`, pour recalibrer le seuil de l'alerte (Open Questions du design).
- Compter `wizard_refine_opened` sur les visites qui atteignent l'étape 2 (`wizard_step_viewed`), et comparer les mots-clés modifiés avant et après.
- Archiver `respecter-le-cahier-des-charges` d'abord, puis ce chantier (design, D10) ; vérifier ensuite que `openspec/specs/recherche/` porte `cahier-des-charges` et `ecran-de-cadrage`, et que `openspec validate --all` passe.
