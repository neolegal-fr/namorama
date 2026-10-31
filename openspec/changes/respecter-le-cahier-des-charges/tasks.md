# Tasks

## 1. Contraintes du brief : extraction enrichie (API)

- [x] 1.1 Dans `schemas.ts`, ajouter à `SCHEMA_CONTRAINTES` les champs `avoidEndings`, `requiredWords` et `nameType` (D2), et compléter `schemas.spec.ts` pour qu'un exemple passe par le parseur. Vérification : `npx jest src/common/modele-ia/schemas.spec.ts` passe.
- [x] 1.2 Dans `extractNamingConstraints`, étendre la consigne (terminaisons à éviter, mots ou prénoms à inclure, type de nom) et nettoyer la sortie selon D2. En particulier, un mot imposé absent de la description normalisée est écarté. Vérification : un nouveau `contraintes.spec.ts`, avec un modèle simulé, couvre « sans -ora ni -ia », « composé avec BLOOM », un mot imposé inventé par le modèle (écarté), un `nameType` hors énumération (`null`), et des descriptions paraphrasées des cas relevés.
- [x] 1.3 Vérifier sur `claude-haiku-5-5` réel, par un script jetable hors dépôt, l'extraction sur cinq descriptions paraphrasées : « 4-5 lettres », « 6 lettres exactement », « sans terminaisons ora/ia », « nom composé avec bloom », « avoid descriptive words ». Vérification : résultats notés sous cette tâche, champs conformes dans au moins 4 cas sur 5.
  - Relevé du 31/10/2026, 5 cas conformes sur 5 :
    - « 4-5 lettres » → min 4, max 5, `invented` ;
    - « 6 lettres exactement » → min 6, max 6 ;
    - « sans ora/ia » → terminaisons `ora`, `ia`, `invented` ;
    - « avec BLOOM » → mot imposé `bloom` ;
    - « avoid descriptive, 5-8 letters » → min 5, max 8, `invented`.
  - Aucun mot imposé ni aucun mot à éviter inventé.

## 2. Contraintes appliquées : priorité et filtre (API)

- [x] 2.1 Rendre `minLength` optionnel et ajouter `maxLength` à `SearchDomainsDto` (bornes 5 à 30, min ≤ max). Dans `findAvailableDomains`, appliquer D1 : une valeur reçue prime, sinon celle du brief, sans réélargir un maximum connu ; plancher à 5. Vérification : tests de `recherche-boucle.spec.ts`. Sans `minLength` et avec un brief « 6 lettres exactement », les bornes valent [6, 6]. Avec `minLength = 7` reçu, le minimum vaut 7.
- [x] 2.2 Extraire `respecteLesContraintes(nom, style, contraintes)` (D3) et l'utiliser dans `generateDomainIdeas`, en comptant les rejets par motif. Vérification : un nouveau `filtre-contraintes.spec.ts` couvre chaque scénario de `recherche/cahier-des-charges` sur la longueur, les terminaisons, les mots à éviter et les mots imposés, y compris pour un nom descriptif qui finit par une terminaison interdite.
- [x] 2.3 Reprendre `avoidEndings` et `requiredWords` dans la consigne de génération. Vérification : un test sur la consigne construite, sur le modèle du test `excludeNames.slice(-200)`, y trouve les deux listes.
- [x] 2.4 Journaliser dans `search_started` les bornes appliquées et leur origine (`brief`, `utilisateur` ou `defaut`), les décomptes de terminaisons, de mots à éviter et de mots imposés, et le type de nom. Journaliser dans `search_completed` l'objet `ecartes` par motif. Ni description ni mots en clair. Vérification : test du contrôleur sur le modèle de `recherche-flux.controller.spec.ts`.
  - Écart assumé : tout part dans `search_completed`, comme le dit la spec. Les contraintes ne sont connues qu'une fois la recherche lancée, et `search_started` part avant. Champs ajoutés : `maxLengthUsed`, `origineDesBornes`, `terminaisonsInterdites`, `motsAEviter`, `motsImposes`, `typeDuBrief`, `styles`, `ecartes`.
- [x] 2.5 Lancer `cd api && npx jest` puis `npm run build`. Vérification : tout passe.

## 3. Mots-clés limités à l'activité (API)

- [x] 3.1 Passer `generateKeywords` en JSON avec schéma `{ keywords: string[], namingBusiness: boolean }` (nouveau `SCHEMA_MOTS_CLES`), avec une consigne qui exclut le cahier des charges du nom (D6). `lireMotsCles` reste la lecture de secours si le texte n'est pas du JSON. Vérification : `schemas.spec.ts` couvre le nouveau schéma, `keywords.spec.ts` couvre les deux formes de réponse.
- [x] 3.2 Ajouter `estVocabulaireDeNommage` et l'appliquer, sauf si `namingBusiness` est vrai. Vérification : `keywords.spec.ts` couvre « nom de marque » écarté pour une boutique, « création de marque » gardé pour une agence de nommage, et « namecheap » non visé.
- [x] 3.3 Mettre à jour `requetes-openai.spec.ts` (ajout de `response_format` sur `keywords`) et la phrase de CLAUDE.md qui promet des requêtes OpenAI identiques. Vérification : `npx jest src/common/modele-ia` passe, et CLAUDE.md mentionne l'écart.
- [x] 3.4 Vérifier sur `claude-haiku-5-5` réel trois descriptions paraphrasées qui mêlent activité et cahier des charges (SEO + « 6 lettres », e-commerce + « avoid descriptive words », « Act as a naming agency… » + coaching). Vérification : aucun mot de nommage dans les mots-clés, résultats notés sous cette tâche.
  - Relevé du 31/10/2026, sur `claude-haiku-5-5` : 15 mots-clés par cas, aucun mot de nommage.
    - SEO + « 6 lettres » : marketing digital, SEO, référencement naturel, SEA, réseaux sociaux…
    - E-commerce + « avoid descriptive » : home goods, home decor, homeware, lifestyle products…
    - « Act as a naming agency » + coaching : fitness coaching app, personal training plans, client management software…

## 4. Étape 2 : contraintes visibles, type de nom choisi (web)

- [x] 4.1 Ne plus activer les styles dans `applyRegionalDefaults`. Remplacer les deux cases du mode local par un `p-selectButton` à trois positions, affiché pour tous, et pré-sélectionné depuis `nameType` tant que l'utilisateur n'a pas choisi (D4). Vérification : `ng build` passe, et au navigateur, en `fr-FR`, une recherche sans toucher au réglage n'envoie ni `descriptiveNames` ni `culturalNames` à `true` (requête vue dans l'onglet réseau).
  - Navigateur `fr-FR`, réglage intact : « Inventés » sélectionné, requête `descriptiveNames: false`, `culturalNames: false`.
- [x] 4.2 N'envoyer `minLength` et `maxLength` que si l'utilisateur les a modifiés, et reprendre le maximum du brief dans l'affichage (D1). Vérification : au navigateur, avec un brief « 6 lettres exactement » et le réglage intact, la requête n'a pas de `minLength`, et les noms rendus font 6 caractères.
  - Brief « 6 lettres exactement », réglage intact : requête sans `minLength`, 10 noms de 6 caractères (`Zeniru`, `Rankiv`…). `search_completed` : bornes [6, 6], origine `brief`.
  - Un projet rouvert ne passe en réglage explicite que si sa longueur diffère du défaut (7) : la colonne vaut 7 par défaut.
- [x] 4.3 Remplacer le bandeau « contraintes détectées » en lecture seule par des puces retirables : longueur, à éviter, terminaisons, à inclure, type. Une puce retirée n'est plus appliquée, ce qui passe par un champ de la requête listant les contraintes retirées, ajouté au DTO. Vérification : au navigateur, retirer « éviter : sport » permet un nom contenant « sport » ; test API du DTO.
  - Puces affichées : « 6 lettres », « pas de fin en -ia », « pas de fin en -ora », « éviter « sport » ». Retrait de « sport » → `contraintesRetirees: ["eviter:sport"]`, et `motsAEviter: 0` journalisé. Tests API : `contraintes.spec.ts` (retrait, DTO).
- [x] 4.4 Libellés fr et en des nouveaux éléments dans `web/public/assets/i18n/`. Vérification : aucune clé brute affichée au navigateur, en fr comme en en.
  - Parcours en `en-US` et en `fr-FR` : aucune clé `WIZARD.*` brute à l'étape 2 ni aux résultats.

## 5. Incitation à élargir aux noms descriptifs (web)

- [x] 5.1 Dans la note de fin de recherche, quand `found < requested` et que seuls les noms inventés étaient demandés, ajouter un bouton qui active les noms descriptifs et relance une recherche en ajout (D5). Vérification : au navigateur, avec un brief très contraint, la note propose l'élargissement, et le clic ajoute des cartes sans vider les premières.
  - Brief impossible (5 lettres contenant « meditation ») : 0 nom, et le panneau propose « Inclure les noms descriptifs ».
  - Ajout hors tâche, prévu par le design (« la note dit que la contrainte est stricte ») : `done` porte `ecartes`, et le panneau dit « 300 noms ont été écartés avant toute vérification » au lieu de « tout est pris ».
  - Le cas « incomplet mais non vide » ne s'est pas produit en local : sa condition est la même (`found < requested`), et le bandeau partage le bouton.
- [x] 5.2 Ajouter un bandeau fermable au-dessus des résultats quand le projet a au moins 5 rejets et aucun favori, sauf si les noms descriptifs sont déjà inclus. Vérification : au navigateur, rejeter 5 noms fait apparaître le bandeau, le fermer le fait disparaître pour la session.
  - 5 rejets sur un projet sans favori → bandeau « Aucun nom ne vous plaît… ». Clic → recherche en ajout, `descriptiveNames: true`, 10 exclusions, cartes conservées.
- [x] 5.3 Émettre `naming_style_widened` (`origine` : `note` ou `bandeau`) par `AnalyticsService.track()`, et le documenter dans CLAUDE.md, section « Nommage des événements ». Vérification : l'événement apparaît dans les logs locaux de l'API après un clic.
  - `naming_style_widened` `{ origine: "bandeau" }` relevé dans les logs locaux de l'API. Documenté dans CLAUDE.md.
- [x] 5.4 Signaler les noms descriptifs et culturels sur leur carte par une étiquette. Vérification : au navigateur, une recherche « inventés et descriptifs » affiche l'étiquette sur ces cartes seulement.
  - Après élargissement, `agenceseopme` porte l'étiquette « descriptif », les noms inventés n'en portent pas.

## 6. Champ de test manuel (web)

- [x] 6.1 Extraire `lireNomsSaisis(texte)` (D7) dans un fichier testable, et l'utiliser dans `addManualDomain` : refus avec un toast, saisie conservée. Vérification : un test unitaire (vitest, à configurer s'il manque, sinon une fonction pure couverte par un test exécutable avec `node --test`) couvre chaque scénario de `recherche/test-manuel`.
  - `noms-saisis.spec.ts`, 7 tests verts via `ng test --watch=false` (Vitest était installé sans aucun test : la cible fonctionne dès le premier fichier).
- [x] 6.2 Libellé du toast et texte d'aide du champ (« séparez les noms par des virgules ») en fr et en. Vérification : au navigateur, saisir « mon choix se porte sur goldelis » affiche le message, et rien n'est ajouté aux favoris.
  - « mon choix se porte sur goldelis » → toast « Ceci ressemble à une phrase », saisie conservée, 15 cartes avant et après. « wqxbelmor, neo pyqtaz » → `wqxbelmor` et `neopyqtaz` vérifiés et ajoutés.

## 7. Intégration et mesure

- [x] 7.1 Parcours complet en local, au navigateur, avec des données non vides : description contrainte → étape 2 (puces, type de nom) → recherche → note de fin → élargissement → test manuel. Vérification : captures ou notes ajoutées sous cette tâche.
  - Parcours du 31/10/2026, API locale sur Claude (Haiku et Sonnet 5.5), compte de test temporaire, captures hors dépôt. Les relevés figurent sous les tâches 4.x à 6.x.
  - Constats hors périmètre : variantes orthographiques non filtrées (`inkalm` pour « éviter calm ») ; exemples de la consigne repris (`navioq`) ; noms imprononçables (`examzn`).
- [x] 7.2 Documenter dans CLAUDE.md la règle « le brief fixe la longueur, sauf réglage explicite », le défaut « noms inventés », et les champs ajoutés à `search_started` et `search_completed`. Vérification : relecture du diff de CLAUDE.md.
  - CLAUDE.md : nouvelle section « Cahier des charges du nom », `naming_style_widened` sous « Nommage des événements », écart de parité OpenAI sur `keywords`.

## Workflow follow-up

- Après déploiement, relire une semaine de `search_completed` et `naming_style_widened` : part des recherches contraintes qui rendent moins que demandé, motifs d'écart, taux d'élargissement, part des projets avec au moins un favori. Comparer avec le relevé du 31/10/2026 (22 projets sur 133 avec un favori), puis archiver le chantier.
