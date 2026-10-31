# Tasks

## 1. Contraintes du brief : extraction enrichie (API)

- [ ] 1.1 Dans `schemas.ts`, ajouter à `SCHEMA_CONTRAINTES` les champs `avoidEndings`, `requiredWords` et `nameType` (D2), et compléter `schemas.spec.ts` pour qu'un exemple passe par le parseur. Vérification : `npx jest src/common/modele-ia/schemas.spec.ts` passe.
- [ ] 1.2 Dans `extractNamingConstraints`, étendre la consigne (terminaisons à éviter, mots ou prénoms à inclure, type de nom) et nettoyer la sortie selon D2. En particulier, un mot imposé absent de la description normalisée est écarté. Vérification : un nouveau `contraintes.spec.ts`, avec un modèle simulé, couvre « sans -ora ni -ia », « composé avec BLOOM », un mot imposé inventé par le modèle (écarté), un `nameType` hors énumération (`null`), et des descriptions paraphrasées des cas relevés.
- [ ] 1.3 Vérifier sur `claude-haiku-5-5` réel, par un script jetable hors dépôt, l'extraction sur cinq descriptions paraphrasées : « 4-5 lettres », « 6 lettres exactement », « sans terminaisons ora/ia », « nom composé avec bloom », « avoid descriptive words ». Vérification : résultats notés sous cette tâche, champs conformes dans au moins 4 cas sur 5.

## 2. Contraintes appliquées : priorité et filtre (API)

- [ ] 2.1 Rendre `minLength` optionnel et ajouter `maxLength` à `SearchDomainsDto` (bornes 5 à 30, min ≤ max). Dans `findAvailableDomains`, appliquer D1 : une valeur reçue prime, sinon celle du brief, sans réélargir un maximum connu ; plancher à 5. Vérification : tests de `recherche-boucle.spec.ts`. Sans `minLength` et avec un brief « 6 lettres exactement », les bornes valent [6, 6]. Avec `minLength = 7` reçu, le minimum vaut 7.
- [ ] 2.2 Extraire `respecteLesContraintes(nom, style, contraintes)` (D3) et l'utiliser dans `generateDomainIdeas`, en comptant les rejets par motif. Vérification : un nouveau `filtre-contraintes.spec.ts` couvre chaque scénario de `recherche/cahier-des-charges` sur la longueur, les terminaisons, les mots à éviter et les mots imposés, y compris pour un nom descriptif qui finit par une terminaison interdite.
- [ ] 2.3 Reprendre `avoidEndings` et `requiredWords` dans la consigne de génération. Vérification : un test sur la consigne construite, sur le modèle du test `excludeNames.slice(-200)`, y trouve les deux listes.
- [ ] 2.4 Journaliser dans `search_started` les bornes appliquées et leur origine (`brief`, `utilisateur` ou `defaut`), les décomptes de terminaisons, de mots à éviter et de mots imposés, et le type de nom. Journaliser dans `search_completed` l'objet `ecartes` par motif. Ni description ni mots en clair. Vérification : test du contrôleur sur le modèle de `recherche-flux.controller.spec.ts`.
- [ ] 2.5 Lancer `cd api && npx jest` puis `npm run build`. Vérification : tout passe.

## 3. Mots-clés limités à l'activité (API)

- [ ] 3.1 Passer `generateKeywords` en JSON avec schéma `{ keywords: string[], namingBusiness: boolean }` (nouveau `SCHEMA_MOTS_CLES`), avec une consigne qui exclut le cahier des charges du nom (D6). `lireMotsCles` reste la lecture de secours si le texte n'est pas du JSON. Vérification : `schemas.spec.ts` couvre le nouveau schéma, `keywords.spec.ts` couvre les deux formes de réponse.
- [ ] 3.2 Ajouter `estVocabulaireDeNommage` et l'appliquer, sauf si `namingBusiness` est vrai. Vérification : `keywords.spec.ts` couvre « nom de marque » écarté pour une boutique, « création de marque » gardé pour une agence de nommage, et « namecheap » non visé.
- [ ] 3.3 Mettre à jour `requetes-openai.spec.ts` (ajout de `response_format` sur `keywords`) et la phrase de CLAUDE.md qui promet des requêtes OpenAI identiques. Vérification : `npx jest src/common/modele-ia` passe, et CLAUDE.md mentionne l'écart.
- [ ] 3.4 Vérifier sur `claude-haiku-5-5` réel trois descriptions paraphrasées qui mêlent activité et cahier des charges (SEO + « 6 lettres », e-commerce + « avoid descriptive words », « Act as a naming agency… » + coaching). Vérification : aucun mot de nommage dans les mots-clés, résultats notés sous cette tâche.

## 4. Étape 2 : contraintes visibles, type de nom choisi (web)

- [ ] 4.1 Ne plus activer les styles dans `applyRegionalDefaults`. Remplacer les deux cases du mode local par un `p-selectButton` à trois positions, affiché pour tous, et pré-sélectionné depuis `nameType` tant que l'utilisateur n'a pas choisi (D4). Vérification : `ng build` passe, et au navigateur, en `fr-FR`, une recherche sans toucher au réglage n'envoie ni `descriptiveNames` ni `culturalNames` à `true` (requête vue dans l'onglet réseau).
- [ ] 4.2 N'envoyer `minLength` et `maxLength` que si l'utilisateur les a modifiés, et reprendre le maximum du brief dans l'affichage (D1). Vérification : au navigateur, avec un brief « 6 lettres exactement » et le réglage intact, la requête n'a pas de `minLength`, et les noms rendus font 6 caractères.
- [ ] 4.3 Remplacer le bandeau « contraintes détectées » en lecture seule par des puces retirables : longueur, à éviter, terminaisons, à inclure, type. Une puce retirée n'est plus appliquée, ce qui passe par un champ de la requête listant les contraintes retirées, ajouté au DTO. Vérification : au navigateur, retirer « éviter : sport » permet un nom contenant « sport » ; test API du DTO.
- [ ] 4.4 Libellés fr et en des nouveaux éléments dans `web/public/assets/i18n/`. Vérification : aucune clé brute affichée au navigateur, en fr comme en en.

## 5. Incitation à élargir aux noms descriptifs (web)

- [ ] 5.1 Dans la note de fin de recherche, quand `found < requested` et que seuls les noms inventés étaient demandés, ajouter un bouton qui active les noms descriptifs et relance une recherche en ajout (D5). Vérification : au navigateur, avec un brief très contraint, la note propose l'élargissement, et le clic ajoute des cartes sans vider les premières.
- [ ] 5.2 Ajouter un bandeau fermable au-dessus des résultats quand le projet a au moins 5 rejets et aucun favori, sauf si les noms descriptifs sont déjà inclus. Vérification : au navigateur, rejeter 5 noms fait apparaître le bandeau, le fermer le fait disparaître pour la session.
- [ ] 5.3 Émettre `naming_style_widened` (`origine` : `note` ou `bandeau`) par `AnalyticsService.track()`, et le documenter dans CLAUDE.md, section « Nommage des événements ». Vérification : l'événement apparaît dans les logs locaux de l'API après un clic.
- [ ] 5.4 Signaler les noms descriptifs et culturels sur leur carte par une étiquette. Vérification : au navigateur, une recherche « inventés et descriptifs » affiche l'étiquette sur ces cartes seulement.

## 6. Champ de test manuel (web)

- [ ] 6.1 Extraire `lireNomsSaisis(texte)` (D7) dans un fichier testable, et l'utiliser dans `addManualDomain` : refus avec un toast, saisie conservée. Vérification : un test unitaire (vitest, à configurer s'il manque, sinon une fonction pure couverte par un test exécutable avec `node --test`) couvre chaque scénario de `recherche/test-manuel`.
- [ ] 6.2 Libellé du toast et texte d'aide du champ (« séparez les noms par des virgules ») en fr et en. Vérification : au navigateur, saisir « mon choix se porte sur goldelis » affiche le message, et rien n'est ajouté aux favoris.

## 7. Intégration et mesure

- [ ] 7.1 Parcours complet en local, au navigateur, avec des données non vides : description contrainte → étape 2 (puces, type de nom) → recherche → note de fin → élargissement → test manuel. Vérification : captures ou notes ajoutées sous cette tâche.
- [ ] 7.2 Documenter dans CLAUDE.md la règle « le brief fixe la longueur, sauf réglage explicite », le défaut « noms inventés », et les champs ajoutés à `search_started` et `search_completed`. Vérification : relecture du diff de CLAUDE.md.

## Workflow follow-up

- Après déploiement, relire une semaine de `search_completed` et `naming_style_widened` : part des recherches contraintes qui rendent moins que demandé, motifs d'écart, taux d'élargissement, part des projets avec au moins un favori. Comparer avec le relevé du 31/10/2026 (22 projets sur 133 avec un favori), puis archiver le chantier.
