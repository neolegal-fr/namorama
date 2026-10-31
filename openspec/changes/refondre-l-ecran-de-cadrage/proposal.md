# Proposal

## Why

L'étape 2 du wizard est l'écran où l'utilisateur confirme ce qu'il demande, juste avant de dépenser des crédits. Elle empile sept réglages de même poids sans dire lesquels sont déjà remplis. La revue UX du 31/10/2026 (canevas « Revue de l'écran de cadrage ») relève huit défauts. Les plus coûteux sont ceux-ci :

- **La longueur se contredit.** Le relevé du 31/10/2026 trouve une longueur fixée dans 18 projets sur 133. Prenons un brief qui demande « 4-5 lettres ». `bornesDeLongueur` (`api/src/domain/domain.service.ts:339`) le ramène au plancher de 5. Le sélecteur affiche alors « ≥ 5 », l'alerte annonce 75 % de .com déjà pris (`TAKEN_RATE`, `web/src/app/components/wizard/wizard.ts:109`, borne basse d'une mesure du 01/08/2026 sur 340 noms), et la puce affiche « 4 à 5 lettres ». Le réglage ne propose qu'un minimum (`MIN_LENGTH_OPTIONS`, `wizard.ts:93`). L'utilisateur, lui, raisonne en maximum : « pas trop long ».
- **Un plancher trop bas.** Avec le plancher de 5, on lance des recherches presque sans issue. Au 20/10/2026, 39 recherches sur 209 (18,7 %) rendaient moins que demandé. Chaque tentative ratée coûte des appels au modèle et au registre.
- **Le prix est invisible au moment où on le paie.** Le bouton « Lancer la recherche » de l'étape 2 lance la recherche (`goToExtensions`, `wizard.ts:1612`). Le coût et le solde n'apparaissent pourtant qu'à l'étape 3 (`wizard.html:682`). Le dialogue des tarifs n'a été ouvert qu'une fois du 12 au 24/09/2026.
- **Une étape, trois noms.** Le stepper dit « Cadrage », le titre « Vos préférences », et le sous-titre ne cite que 4 réglages sur 6 (`fr.json`, `WIZARD.STEP2.TITLE` et `SUBTITLE`).
- **Le facultatif a le même poids que l'essentiel.** Le repérage du marché, qui fait ~0,09 $ et ~18 s par appel, a le même poids visuel que les extensions. Les mots-clés n'expliquent pas leur rôle, et le bouton final se grise à zéro mot-clé sans dire pourquoi (`wizard.html:430`).

L'usage réel de chaque réglage n'a pas pu être relevé en base pour cette proposition : la lecture de production a été refusée le 31/10/2026. La tâche 1.1 en fait le relevé initial.

## What Changes

- **Longueur : un seul réglage, « au plus N caractères ».** Les valeurs vont de 6 à 12, plus « sans limite ». Le minimum n'est plus réglable : c'est un plancher fixé par le produit, **6**. La recherche porte toujours sur [6, N]. **Le maximum par défaut passe à 10** (aujourd'hui [7, 12]).
- **Un brief sous le plancher est ramené à 6, et l'écran le dit.** **BREAKING** pour la règle « ne jamais élargir un maximum demandé » du chantier `respecter-le-cahier-des-charges`. Un brief « 4-5 lettres » donne désormais des noms de 6 caractères, avec une phrase qui explique pourquoi.
- **Une phrase-résumé en tête d'écran**, recalculée à chaque réglage. Elle dit ce qui sera cherché : style, longueur, contraintes, extensions et critère.
- **Trois blocs à la place de sept.** « Le nom » regroupe le style, la longueur et les contraintes du brief. « Les domaines » regroupe les extensions et le critère. « Affiner — facultatif », replié par défaut, regroupe mots-clés, public et inspirations, et résume ce qu'il contient.
- **Les libellés de style disent le cumul** : « Inventés », « Inventés + descriptifs », « Inventés + culturels ».
- **Les mots-clés disent leur rôle.** Leur compteur n'apparaît qu'à l'approche de la limite. À zéro mot-clé, le bouton dit pourquoi il est grisé.
- **Le repérage du marché devient un lien secondaire** du bloc « Affiner », avec sa durée annoncée.
- **Une barre d'action collée en bas** porte « Lancer la recherche », le coût et le solde.
- **Un seul nom pour l'étape** : « Cadrage », dans le stepper comme dans le titre.
- **Mesure** : l'événement `wizard_refine_opened` marque l'ouverture du bloc facultatif. `search_completed` porte déjà les bornes et leur origine.

**Hors périmètre :**
- le critère « libre sur toutes les extensions » reste visible tel quel ; sa place se tranchera sur mesure ;
- le parcours « tester un nom qu'on a », l'étape 1 et l'étape 3, sauf la reprise de la longueur dans « relancer en assouplissant » ;
- la longueur des noms descriptifs et culturels, qui reste libre ;
- la suppression de la colonne `project.minLength`, laissée en place et inutilisée ;
- la diversité des noms générés (chantier suivant du cahier des charges).

## Capabilities

### New Capabilities
- `recherche/ecran-de-cadrage` : ce que l'écran de cadrage montre et dans quel ordre (résumé, blocs, partie facultative, coût avant la recherche).

### Modified Capabilities
- `recherche/cahier-des-charges` : la longueur devient un maximum réglable au-dessus d'un plancher de 6, et la longueur du brief s'affiche dans le réglage plutôt qu'en puce. Cette spécification naît de l'archivage de `respecter-le-cahier-des-charges`, qui doit donc être archivé **avant** celui-ci.

## Impact

- **API** : `bornesDeLongueur`, les constantes `MIN_NAME_LENGTH_FLOOR` et `DEFAULT_*` (`domain.service.ts:320`), et les bornes de `SearchDomainsDto.minLength` et `maxLength`. Une nouvelle colonne `project.maxLength`, avec sa migration SQL à appliquer avant le déploiement. `search_completed` garde ses champs.
- **Web** : l'étape 2 de `wizard.html` et `wizard.ts`, `relaxLengthAndRetry`, la persistance de l'état (`localStorage`, projet rouvert), et les libellés fr et en.
- **Contrat** : le front n'envoie plus que `maxLength`. `minLength` reste accepté, pour les onglets ouverts avant le déploiement.
- **Docs** : CLAUDE.md, sections « Cahier des charges du nom » et « Nommage des événements ».
