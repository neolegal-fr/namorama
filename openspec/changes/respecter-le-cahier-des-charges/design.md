# Design

## Context

Voir proposal.md, section Why, pour les écarts relevés en production. État du code utile ici :

- **Extraction des contraintes.** `extractNamingConstraints` fait un appel au modèle simple, avec la sortie structurée `SCHEMA_CONTRAINTES`, et rend `minLength`, `maxLength`, `avoidWords` et `referenceBrands`. Le front l'appelle par `POST /domain/constraints` à l'entrée de l'étape 2, puis le serveur l'appelle de nouveau au début de chaque recherche.
- **Priorité de la longueur.** Le front pré-remplit `minNameLength` avec le minimum du brief, sauf si l'utilisateur l'a déjà touché, et envoie **toujours** `minLength`. Le serveur traite cet envoi comme un réglage explicite, puis élargit le maximum à « minimum + 3 » (`domain.service.ts:1347`). Ensuite `generateDomainIdeas` l'élargit encore à « minimum + 2 » au besoin.
- **Filtre après génération.** Les noms standard sont bornés à `maxLen + 1`, les noms descriptifs et culturels à 63 caractères (limite DNS). Les mots à éviter sont filtrés par `includes`.
- **Styles.** `applyRegionalDefaults` active `descriptiveNames` et `culturalNames` dès que la région du navigateur est reconnue. Le choix n'est visible qu'en mode local, sous forme de deux cases à cocher.
- **Mots-clés.** La consigne de `generateKeywords` reçoit la description entière, et `lireMotsCles` (PR #160) écarte déjà la prose et les questions.
- **Test manuel.** `addManualDomain` découpe sur `/[\s,;]+/`, puis marque chaque entrée comme aimée d'office.

## Goals / Non-Goals

**Goals :**
- Une seule source de vérité pour les contraintes d'une recherche, calculée côté serveur et appliquée par un filtre déterministe.
- Un choix du type de nom visible pour tous les utilisateurs, plus seulement en mode local.

**Non-Goals :**
- Réécrire la consigne de génération ou ses exemples. Les exemples « veloria », « kalivo », « pivoxen » nourrissent pourtant la répétition des sonorités : `pivoxen` a été rendu trois fois au même compte. C'est le chantier suivant, sur la diversité.
- Garantir le nombre de noms rendus sous des contraintes extrêmes. Le budget de temps existant borne la recherche, et la note de fin le dit.

## Decisions

### D1. Les contraintes du brief et les réglages explicites voyagent séparément

Le front envoie `minLength` et `maxLength` **seulement si l'utilisateur les a modifiés**. Sinon, il n'envoie rien, et le serveur applique les bornes du brief, ou les bornes par défaut.
- Le serveur ne réélargit plus le maximum. La règle « minimum + 3 » ne s'applique que si aucun maximum ne vient ni du brief ni de l'utilisateur.
- Le plancher technique de 5 est conservé : une borne minimale du brief plus basse est relevée à 5, et la borne maximale reste au moins égale au minimum.

*Alternative écartée : un drapeau `minLengthTouched` envoyé avec la valeur.* Ce serait deux champs pour une seule information, alors que l'absence de valeur dit déjà « pas de réglage explicite ».

*Alternative écartée : déduire les bornes côté front et toujours les envoyer.* Le front n'a l'extraction qu'une fois, à l'entrée de l'étape 2. Une description modifiée ensuite, ou un projet rouvert, enverrait des bornes périmées.

### D2. Schéma des contraintes enrichi, valeurs vérifiées après le modèle

`SCHEMA_CONTRAINTES` gagne trois champs :
- `avoidEndings: string[]` ;
- `requiredWords: string[]` ;
- `nameType: "invented" | "descriptive" | "any" | null`.

Comme pour les champs existants, la sortie du modèle est nettoyée côté serveur :
- minuscules, lettres et chiffres seulement ;
- terminaisons de 2 à 5 caractères ;
- mots imposés de 3 à 15 caractères, au plus 3 ;
- `nameType` hors énumération ramené à `null`.

Un mot imposé n'est retenu que s'il figure dans la description, une fois normalisée : le modèle ne doit pas inventer d'obligation. Les prénoms à inclure (« estela », « laury ») passent par `requiredWords`.

### D3. Un filtre unique, appliqué à tous les styles

Le filtre de `generateDomainIdeas` est extrait en fonction pure, `respecteLesContraintes(nom, style, contraintes)`, testable sans modèle, qui rend aussi le motif du rejet (`longueur`, `terminaison`, `mot_a_eviter`, `mot_impose`).
- Longueur : bornes exactes pour le style standard, sans la tolérance « + 1 » quand le maximum vient du brief.
- Terminaisons, mots à éviter et mots imposés : **tous les styles**.
- Pas de borne du brief pour les styles descriptif et culturel. L'utilisateur qui les choisit accepte des noms plus longs, et la carte les signale.

Les rejets sont comptés par motif sur toute la recherche et journalisés dans `search_completed` (`ecartes: { longueur, terminaison, mot_a_eviter, mot_impose }`). La consigne donnée au modèle reprend les mêmes contraintes, ce qui limite le gaspillage, mais c'est le filtre qui garantit le résultat.

### D4. Type de nom : un choix à trois positions pour tous, « inventés » par défaut

- `applyRegionalDefaults` ne touche plus aux styles : il ne règle que les extensions et la langue.
- Les deux cases du mode local sont remplacées par un `p-selectButton` à trois positions (inventés, inventés et descriptifs, inventés et culturels), affiché pour tous.
- Le contrat API reste `descriptiveNames` et `culturalNames`, qui ne sont plus réservés au mode local.
- La pré-sélection suit `nameType` du brief, tant que l'utilisateur n'a pas choisi lui-même (même logique « touché » que pour la longueur) :
  - `descriptive` → inventés et descriptifs ;
  - `invented`, `any` ou `null` → inventés.

*Alternative écartée : garder le défaut régional et le couper seulement quand le brief l'exige.* C'est l'option rejetée lors de la validation du 31/10/2026 : l'utilisateur choisit, et le produit l'incite à élargir s'il n'est pas satisfait.

### D5. Inciter à élargir au bon moment

La suggestion « inclure les noms descriptifs » apparaît dans deux cas :
- **Dans la note de fin de recherche** (capacité `recherche/note-de-fin-de-recherche`), quand `found < requested` et que seuls les noms inventés étaient demandés. Un bouton active le style et relance une recherche en ajout, sans vider les cartes.
- **Dans un bandeau au-dessus des résultats**, quand le projet compte au moins 5 noms rejetés et aucun aimé. Il se ferme, et ne revient pas dans la session une fois fermé.

Le texte dit le compromis : « plus faciles à trouver libres, mais plus longs et moins distinctifs ».

L'événement `naming_style_widened` (origine `note` ou `bandeau`) mesure si l'incitation sert. Le nom est au passé, selon la convention du projet.

### D6. Mots-clés : consigne cadrée, plus un filtre du vocabulaire du nommage

- La consigne de `generateKeywords` demande de décrire l'activité seule, et d'ignorer tout ce qui porte sur le nom (longueur, ton, marques à imiter, consignes adressées à une IA).
- `lireMotsCles` reçoit un filtre `estVocabulaireDeNommage` : une liste courte en fr, en, es, it, de, appliquée au mot-clé entier normalisé. Exemples : nom, marque, brand, name, naming, nom de marque, nom de domaine, identité de marque, court, short, premium, mémorable, prononçable, lettres, letters.
- Exception : si la consigne détecte une activité de nommage ou de création de marque, le filtre ne s'applique pas. La détection repose sur un drapeau `activiteDeNommage`, demandé au même appel en passant la réponse au format JSON : `{ "keywords": [...], "namingBusiness": bool }`, avec un schéma.

Le passage au JSON modifie la requête OpenAI de `keywords` (ajout de `response_format`). `requetes-openai.spec.ts` est mis à jour en conséquence, et l'écart est documenté dans CLAUDE.md, qui promet des requêtes identiques.

*Alternative écartée : un second appel pour séparer activité et cahier des charges.* Il doublerait la latence de l'étape 1, qui est publique et appelée à chaque description.

### D7. Test manuel : séparateurs de liste uniquement

- `addManualDomain` découpe sur `/[,;\n]+/`.
- Chaque entrée est normalisée : extension retirée, puis espaces retirés si elle compte 3 mots ou moins.
- Une entrée de plus de 3 mots bloque toute la saisie. Un toast l'explique, en citant l'entrée fautive tronquée à 40 caractères, et le champ garde le texte.
- La règle est extraite en fonction pure du front, `lireNomsSaisis(texte)`, qui rend `{ noms, refus }`.

## Risks / Trade-offs

- **Contraintes strictes, moins de noms.** Pour « 5 lettres exactement », la plupart des `.com` sont pris. → Le budget de temps borne la recherche. La note de fin propose d'élargir (D5) et dit que la contrainte est stricte. `ecartes.longueur` mesure l'effet.
- **Le modèle invente une contrainte.** Par exemple, il lit « éviter » dans une phrase qui n'en est pas une. → Les contraintes s'affichent et se retirent à l'étape 2. Les mots imposés doivent figurer dans la description (D2).
- **Moins de noms descriptifs pour ceux qui les aimaient.** → L'option reste à un clic, et l'incitation la rappelle. `naming_style_widened` dira si le défaut doit être revu.
- **Liste du vocabulaire de nommage incomplète ou trop large.** → Elle s'applique au mot-clé entier, pas à une sous-chaîne (« namecheap » n'est pas visé). Les tests portent sur des descriptions paraphrasées des cas relevés.
- **Projets enregistrés avec `descriptiveNames` actif.** Le réglage n'est pas stocké sur le projet : un projet rouvert repart des défauts, donc des noms inventés. Le choix est visible et se change d'un clic.

## Migration Plan

Aucune migration de données. Déploiement ordinaire : l'API et le web partent ensemble, et les champs ajoutés sont optionnels.
- Un front ancien envoie toujours `minLength`. Il garde donc l'ancienne priorité, sans casser.
- Retour arrière : redéployer l'image précédente.
