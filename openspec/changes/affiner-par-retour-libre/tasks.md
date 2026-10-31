# Tasks

## 1. Retours sur le projet (données et API projet)

- [ ] 1.1 Écrire `api/migrations/2026-11-XX-retours-sur-les-noms.sql` : `ALTER TABLE project ADD COLUMN IF NOT EXISTS retours TEXT NULL`, idempotent, avec commande d'application et retour arrière en en-tête. Vérification : appliquée deux fois de suite sur la base locale sans erreur, colonne présente (`SHOW COLUMNS FROM project LIKE 'retours'`).
- [ ] 1.2 Ajouter `retours: string[]` à l'entité `Project` (JSON en `text`, D4) et l'accepter dans la création et la mise à jour de `ProjectsService`, bornée à 10 × 200 caractères, avec les droits d'écriture existants (propriétaire ou collaborateur en écriture). Vérification : nouveaux cas dans `partage.spec.ts`. Un collaborateur en écriture enregistre un retour, un invité en lecture est refusé, et un retour contenant une virgule est relu intact.
- [ ] 1.3 Documenter la migration dans CLAUDE.md (liste des migrations à appliquer avant déploiement). Vérification : la ligne y figure avec son nom de fichier.

## 2. Interprétation des retours (API)

- [ ] 2.1 Ajouter `SCHEMA_RETOURS` à `schemas.ts` (D1) et un exemple qui passe par son parseur dans `schemas.spec.ts`. Vérification : `cd api && npx jest src/common/modele-ia/schemas.spec.ts` passe.
- [ ] 2.2 Écrire `interpreterRetours(retours, bornesCourantes)` dans `domain.service.ts` : appel `simple` (`operation: 'feedback'`), nettoyage de la sortie (bornes, mot imposé absent des retours écarté, formes hors énumération ignorées, `preference` ≤ 200), repli D6 et cache D5. Vérification : nouveau `retours.spec.ts` avec modèle simulé. Il couvre « pas de noms composés » → `formesRetirees: [compound]`, « plus de -ia » → `avoidEndings: [ia]`, « plus longs » puis « plus courts » → maximum abaissé, un mot imposé inventé écarté, une réponse vide → `preference` reprenant les retours, et un second appel identique servi par le cache sans appel au modèle.
- [ ] 2.3 Vérifier sur `claude-haiku-5-5` réel, puis sur luna, par un script jetable hors dépôt, six retours paraphrasés : « plus francophone », « je n'aime pas les noms composés », « plus courts », « pas de -ia ni -ora », « plus sérieux, moins startup », « plus longs » puis « plus courts ». Vérification : résultats notés sous cette tâche, interprétation conforme dans au moins 5 cas sur 6 pour chaque modèle.

## 3. Retours appliqués à la génération (API)

- [ ] 3.1 Ajouter `retours` à `SearchDomainsDto` (`@ArrayMaxSize(10)`, `@MaxLength(200, { each: true })`) et le transmettre jusqu'à `findAvailableDomains`. Vérification : test DTO dans `recherche-flux.controller.spec.ts`. 11 retours ou un retour de 201 caractères donnent un 400, et une requête sans `retours` est inchangée.
- [ ] 3.2 Dans `findAvailableDomains`, fusionner l'interprétation selon D2 : bornes d'un retour à la place de celles du brief, listes ajoutées, `OrigineDesBornes` à `retour`. Vérification : cas dans `recherche-boucle.spec.ts`. Brief [8, 10] et retour max 6 sans réglage → [≤ 6], origine `retour`. Même cas avec `maxLength: 9` reçu → max 9, origine `utilisateur`. Un retour « pas de -ia » écarte `velmia` via `ecartes.terminaison`.
- [ ] 3.3 Dans `generateDomainIdeas`, appliquer D3 : sous-groupes retirés redistribués, langue à la place de `localeInstruction`, section de préférence assainie. Vérification : tests sur la consigne construite, sur le modèle du test `excludeNames.slice(-200)`. Avec `formesRetirees: [compound]`, la consigne ne contient plus `[compound]` et les 30 noms restent répartis. Avec toutes les formes retirées, la répartition d'origine est conservée. Une préférence contenant des sauts de ligne et des triples guillemets arrive assainie.
- [ ] 3.4 Journaliser `retours` et `retoursCompris` dans `search_completed`, sans texte. Vérification : test du contrôleur dans `recherche-flux.controller.spec.ts`. Les champs sont présents, et aucun texte de retour ne figure dans l'événement sérialisé.
- [ ] 3.5 Vérifier la parité OpenAI : sans retour, aucune requête `feedback` et des requêtes identiques. Vérification : `npx jest src/common/modele-ia/requetes-openai.spec.ts` passe, avec un cas « sans retours » ajouté.
- [ ] 3.6 Mettre à jour CLAUDE.md : section « Cahier des charges du nom » (les retours, troisième source de contraintes, et leur priorité), tableau des rôles du modèle (`feedback` en simple), champs de `search_completed`. Vérification : relecture, puis `cd api && npx jest && npm run build` passent.

## 4. Zone « Affiner » (web)

- [ ] 4.1 Ajouter sous la liste des résultats le champ de retour et les cinq suggestions, masqués sans résultat et pour un invité en lecture seule. Styles de layout en inline (conventions PrimeNG). Vérification : au navigateur, avec un projet de 10 noms, la zone apparaît. Ouvert avec un compte invité en lecture, elle n'apparaît pas.
- [ ] 4.2 Envoyer un retour : l'ajouter au signal `retours`, lancer la recherche en ajout avec `retours` et `excludeNames`, enregistrer le projet, puis vider le champ. Sur refus faute de crédits, le texte reste dans le champ et n'est pas ajouté. Vérification : au navigateur, onglet réseau, la requête `search/stream` porte `retours` et les exclusions, les 10 premières cartes restent, et la mise à jour du projet porte `retours`.
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
