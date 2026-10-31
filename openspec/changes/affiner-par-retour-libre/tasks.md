# Tasks

## 1. Retours sur le projet (données et API projet)

- [x] 1.1 Écrire `api/migrations/2026-11-XX-retours-sur-les-noms.sql` : `ALTER TABLE project ADD COLUMN IF NOT EXISTS retours TEXT NULL`, idempotent, avec commande d'application et retour arrière en en-tête. Vérification : appliquée deux fois de suite sur la base locale sans erreur, colonne présente (`SHOW COLUMNS FROM project LIKE 'retours'`).
  - Fichier : `2026-11-01-retours-sur-les-noms.sql`, daté après `2026-11-01-longueur-maximale-du-projet.sql` (#171).
  - Appliquée deux fois sur `namorama_w2` sans erreur, et la colonne `retours text NULL` est présente.
- [x] 1.2 Ajouter `retours: string[]` à l'entité `Project` (JSON en `text`, D4) et l'accepter dans la création et la mise à jour de `ProjectsService`, bornée à 10 × 200 caractères, avec les droits d'écriture existants (propriétaire ou collaborateur en écriture). Vérification : nouveaux cas dans `partage.spec.ts`. Un collaborateur en écriture enregistre un retour, un invité en lecture est refusé, et un retour contenant une virgule est relu intact.
  - Colonne `simple-json` (stockée en `text`). Validation unique dans `projects/retours.ts` (`lireRetours`), qui refuse un onzième retour ou plus de 200 caractères sans rien tronquer.
  - Enregistrement par `createOrUpdate` (la recherche aboutie, D4 corrigé) et par `update` (`PATCH`, retrait d'une puce).
  - `partage.spec.ts` gagne 5 cas : écriture par un collaborateur, refus en lecture, virgule conservée, non-effacement par une recherche sans retours, bornes. `npx jest src/projects` : 17 tests passent.
- [x] 1.3 Documenter la migration dans CLAUDE.md (liste des migrations à appliquer avant déploiement). Vérification : la ligne y figure avec son nom de fichier.
  - Nouvelle section « Retours sur les noms (« Affiner ») », avec la ligne de migration.

## 2. Interprétation des retours (API)

- [x] 2.1 Ajouter `SCHEMA_RETOURS` à `schemas.ts` (D1) et un exemple qui passe par son parseur dans `schemas.spec.ts`. Vérification : `cd api && npx jest src/common/modele-ia/schemas.spec.ts` passe.
  - `SCHEMA_RETOURS` et `FORMES_DE_NOM` ajoutés. Le cas `feedback` de `schemas.spec.ts` fait passer un exemple par `interpreterRetours` et refuse une forme hors énumération : 10 tests passent.
  - Opération `feedback` ajoutée à `OperationModele`, et libellée « Retours sur les noms » dans l'onglet Coûts IA.
- [x] 2.2 Écrire `interpreterRetours(retours, bornesCourantes)` dans `domain.service.ts` : appel `simple` (`operation: 'feedback'`), nettoyage de la sortie (bornes, mot imposé absent des retours écarté, formes hors énumération ignorées, `preference` ≤ 200), repli D6 et cache D5. Vérification : nouveau `retours.spec.ts` avec modèle simulé. Il couvre « pas de noms composés » → `formesRetirees: [compound]`, « plus de -ia » → `avoidEndings: [ia]`, « plus longs » puis « plus courts » → maximum abaissé, un mot imposé inventé écarté, une réponse vide → `preference` reprenant les retours, et un second appel identique servi par le cache sans appel au modèle.
  - `retours.spec.ts` : 13 tests, avec en plus des cas demandés :
    - le repli n'est pas mis en cache ;
    - des bornes différentes ne partagent pas le cache ;
    - aucun appel sans retour ;
    - le texte est assaini avant d'entrer dans la consigne ;
    - une langue invalide est ignorée ;
    - les bornes sont remises dans l'ordre ;
    - la préférence est bornée à 200 caractères, le repli à 400.
  - Écart trouvé par les tests : le brief compare des sous-chaînes, si bien que « plus chaleureux » imposait « chaleur ». Pour les retours, un mot imposé doit désormais figurer comme mot entier, ce qu'exige la spécification (« tel quel »).
- [x] 2.3 Vérifier sur `claude-haiku-5-5` réel, puis sur luna, par un script jetable hors dépôt, six retours paraphrasés : « plus francophone », « je n'aime pas les noms composés », « plus courts », « pas de -ia ni -ora », « plus sérieux, moins startup », « plus longs » puis « plus courts ». Vérification : résultats notés sous cette tâche, interprétation conforme dans au moins 5 cas sur 6 pour chaque modèle.
  - Premier relevé du 31/10/2026 (bornes courantes [6, 10]) : 5 sur 6 pour Haiku, 6 sur 6 pour Luna. Deux interprétations contredisaient pourtant l'intention :
    - Luna retirait la forme `short` sur « plus courts » ;
    - Haiku retirait `compound` sur « plus sérieux ».
  - La consigne n'autorise plus une forme retirée que sur un rejet explicite, jamais déduite du ton ou de la longueur.
  - Second relevé : 6 sur 6 sur les deux modèles, identiques :
    - « plus francophone » → `langue: French` ;
    - « pas de composés » → `formesRetirees: [compound]` ;
    - « plus courts » → `maxLength: 8` ;
    - « pas de -ia ni -ora » → `avoidEndings: [ia, ora]` ;
    - « plus sérieux » → préférence seule ;
    - « plus longs » puis « plus courts » → `maxLength: 8`.

## 3. Retours appliqués à la génération (API)

- [x] 3.1 Ajouter `retours` à `SearchDomainsDto` (`@ArrayMaxSize(10)`, `@MaxLength(200, { each: true })`) et le transmettre jusqu'à `findAvailableDomains`. Vérification : test DTO dans `recherche-flux.controller.spec.ts`. 11 retours ou un retour de 201 caractères donnent un 400, et une requête sans `retours` est inchangée.
  - Transmis aux deux points d'entrée (`search/stream` et la route classique) et à `createOrUpdate` (D4).
  - Tests DTO : 10 retours de 200 caractères acceptés, une requête sans retours acceptée, un onzième retour ou un retour de 201 caractères refusés.
- [x] 3.2 Dans `findAvailableDomains`, fusionner l'interprétation selon D2 : bornes d'un retour à la place de celles du brief, listes ajoutées, `OrigineDesBornes` à `retour`. Vérification : cas dans `recherche-boucle.spec.ts`. Brief [8, 10] et retour max 6 sans réglage → [≤ 6], origine `retour`. Même cas avec `maxLength: 9` reçu → max 9, origine `utilisateur`. Un retour « pas de -ia » écarte `velmia` via `ecartes.terminaison`.
  - Fusion dans une fonction pure, `appliquerRetours`. Une borne du brief que le retour contredit tombe : sans cela, le minimum de 8 du brief l'emportait sur « 6 max ».
  - L'interprétation reçoit les bornes qu'on appliquerait sans retour (« plus courts » se mesure à quelque chose), et le test le vérifie.
  - Les trois cas demandés passent, ainsi que la transmission des réglages à la génération et le cas sans retour.
- [x] 3.3 Dans `generateDomainIdeas`, appliquer D3 : sous-groupes retirés redistribués, langue à la place de `localeInstruction`, section de préférence assainie. Vérification : tests sur la consigne construite, sur le modèle du test `excludeNames.slice(-200)`. Avec `formesRetirees: [compound]`, la consigne ne contient plus `[compound]` et les 30 noms restent répartis. Avec toutes les formes retirées, la répartition d'origine est conservée. Une préférence contenant des sauts de ligne et des triples guillemets arrive assainie.
  - Répartition extraite dans `repartirSousGroupes`. Les cas demandés passent, plus deux : la langue d'un retour remplace celle du navigateur, et sans réglage la consigne est celle d'avant (quatre sous-groupes, aucune section de retour). `recherche-boucle.spec.ts` : 37 tests.
- [x] 3.4 Journaliser `retours` et `retoursCompris` dans `search_completed`, sans texte. Vérification : test du contrôleur dans `recherche-flux.controller.spec.ts`. Les champs sont présents, et aucun texte de retour ne figure dans l'événement sérialisé.
  - `resumeDesRetours` donne `{ retours, retoursCompris: { bornes, contraintes, formesRetirees, langue, preference } }`. Les tests vérifient les décomptes, l'absence de tout texte de retour et de la langue en clair, et le cas sans retour (zéro partout).
- [x] 3.5 Vérifier la parité OpenAI : sans retour, aucune requête `feedback` et des requêtes identiques. Vérification : `npx jest src/common/modele-ia/requetes-openai.spec.ts` passe, avec un cas « sans retours » ajouté.
  - Deux cas ajoutés : aucune requête sans retours ; avec des retours, un appel simple en JSON (300 tokens, `reasoning_effort: none`). Le cas `generate_names` passe sans modification.
- [x] 3.6 Mettre à jour CLAUDE.md : section « Cahier des charges du nom » (les retours, troisième source de contraintes, et leur priorité), tableau des rôles du modèle (`feedback` en simple), champs de `search_completed`. Vérification : relecture, puis `cd api && npx jest && npm run build` passent.
  - Section « Retours sur les noms » complétée : interprétation, trois parts, priorité, règle des formes retirées, repli, mesure. Renvoi depuis « Cahier des charges du nom », et rôle simple complété.
  - `npx jest` : 39 suites, 416 tests passent. `npm run build` passe.

## 4. Zone « Affiner » (web)

- [ ] 4.1 Ajouter sous la liste des résultats le champ de retour et les cinq suggestions, masqués sans résultat et pour un invité en lecture seule. Styles de layout en inline (conventions PrimeNG). Vérification : au navigateur, avec un projet de 10 noms, la zone apparaît. Ouvert avec un compte invité en lecture, elle n'apparaît pas.
- [ ] 4.2 Envoyer un retour : l'ajouter au signal `retours`, lancer la recherche en ajout avec `retours` et `excludeNames` (la recherche aboutie les enregistre sur le projet, D4), puis vider le champ. Sur refus faute de crédits, le texte reste dans le champ et n'est pas ajouté. Retirer une puce enregistre la liste par `PATCH /projects/:id`. Vérification : au navigateur, onglet réseau, la requête `search/stream` porte `retours` et les exclusions, les 10 premières cartes restent, et `GET /projects/:id` relu après la recherche porte `retours`.
- [ ] 4.3 Afficher les retours actifs en puces retirables, refuser un onzième avec un message, et restaurer les puces à la réouverture du projet. Vérification : au navigateur, deux retours, fermeture, réouverture depuis le drawer → deux puces, description inchangée. Retrait d'une puce → la recherche suivante ne la porte plus.
- [ ] 4.4 Émettre `name_feedback_added` (`origine`, `actifs`) par `AnalyticsService.track()` et le documenter dans CLAUDE.md, section « Nommage des événements ». Vérification : l'événement apparaît dans les logs locaux de l'API après un clic sur une suggestion et après une saisie libre.
- [ ] 4.5 Libellés fr et en dans `web/public/assets/i18n/`. Vérification : au navigateur, en `fr-FR` et en `en-US`, aucune clé brute dans la zone.
- [ ] 4.6 Vérifier le parcours de bout en bout sur le vrai modèle : une recherche, puis « je n'aime pas les noms composés », puis « plus francophone ». Vérification : noms notés sous cette tâche. La part de noms faits de deux racines collées baisse d'un lot à l'autre, et `search_completed` porte `retours: 2`.

## 5. Livraison

- [ ] 5.1 Appliquer la migration 1.1 en production (sauvegarde préalable, cf. accès base prod), puis vérifier la colonne. Vérification : `SHOW COLUMNS FROM project LIKE 'retours'` en production rend une ligne.
- [ ] 5.2 Merger la PR, attendre la fin du build GitHub Actions, puis `docker compose pull api web && docker compose up -d api web`. Vérification : conteneurs `Up`, et une recherche avec retour réussit en production.

## Workflow follow-up

- Après 14 jours : relever la part des recherches portant au moins un retour, la répartition de `name_feedback_added` par origine, et le taux de 👍 sur les noms produits avec retours face à ceux produits sans. Noter les chiffres ici.
- Archiver le chantier, puis vérifier que `openspec/specs/recherche/retours-sur-les-noms/` existe et que `openspec validate --all` passe.
