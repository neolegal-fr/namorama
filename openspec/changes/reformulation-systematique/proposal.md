# Proposal

## Why

La reformulation de la description par l'IA, à l'étape 1, semble peu utilisée. C'est une impression du 31/10/2026, **pas encore mesurée** : aucun événement ne marque son usage, et la tâche 1.1 la chiffre à partir des requêtes `POST /domain/refine` du journal HTTP, rapportées aux `POST /domain/keywords` (passages à l'étape 2). Le design de l'écran suffit en tout cas à l'expliquer.

- **C'est un bouton secondaire à côté du bouton qui fait avancer** (`wizard.html:122-138`). Rien n'indique ce qu'on y gagne, et « Continuer » mène directement aux mots-clés.
- **Une reformulation non adoptée part quand même.** Si l'utilisateur clique « Reformuler » puis « Continuer » sans cliquer « Utiliser cette version », la version reformulée sert aux mots-clés, aux contraintes, au repérage du marché et à la recherche (`wizard.ts:2615`, `wizard.ts:1665`, `wizard.ts:2861` : `refinedDescription() || description()`). Le projet enregistre pourtant la description d'origine (`wizard.ts:2816`). La recherche porte donc sur un texte que l'utilisateur n'a pas choisi et que le projet ne garde pas. À la réouverture, les recherches suivantes repartent de l'autre texte.
- **La consigne peut effacer le cahier des charges du nom.** Elle demande de « reformuler et compléter » pour « extraire l'essence » du produit (`domain.service.ts:512-520`). Or c'est dans la description que le serveur lit les contraintes du nom, à chaque recherche : 18 projets sur 133 y fixaient une longueur, 18 des mots ou terminaisons à éviter, 13 des marques de référence (relevé du 31/10/2026). Une version « percutante » qui perd « 4-5 lettres » ou « sans -ora » annule le chantier `respecter-le-cahier-des-charges` pour ce projet.
- **« Compléter » autorise à inventer**, et la consigne, rédigée en français, ne dit pas dans quelle langue répondre.

Rendre la reformulation systématique sans corriger ces trois défauts généraliserait le bug à tous les projets. Les corriger sans la rendre visible laisserait la fonction inutilisée.

## What Changes

- **La reformulation est proposée à chaque passage à l'étape 2.** « Continuer » demande la reformulation de la description, puis affiche une confirmation : la description de l'utilisateur et la version proposée, côte à côte (l'une sous l'autre sur mobile).
  - Deux choix : **utiliser la version proposée**, que l'utilisateur peut retoucher avant de valider, ou **garder ma description**.
  - L'étape 2 ne s'ouvre qu'après ce choix.
  - Un texte déjà reformulé, et non modifié depuis, n'est pas reformulé une seconde fois.
- **Le bouton « Reformuler avec l'IA » disparaît**, puisque la reformulation fait désormais partie du parcours.
- **Le texte choisi devient la description du projet, et c'est le seul utilisé ensuite** : mots-clés, contraintes, nom de projet, repérage du marché, recherches. Il n'y a plus de version reformulée « en réserve » qui partirait sans avoir été choisie.
- **La reformulation garde le cahier des charges du nom.** Longueur, mots ou terminaisons à éviter, mots imposés, marques de référence et type de nom figurent dans la version proposée, dans les termes de l'utilisateur.
- **La reformulation n'invente rien et garde la langue de l'utilisateur.** Elle clarifie et structure ce qui est dit, sans ajouter de fonctionnalité, de public ou de chiffre absents de la description.
- **Un échec ne bloque pas.** Si la reformulation échoue ou dépasse le délai, l'étape 2 s'ouvre avec la description d'origine, sans message d'erreur.
- **La mesure suit.** Deux événements, `description_refine_shown` et `description_refine_chosen` (choix, retouche ou non), disent si la version proposée est retenue, ce que personne ne sait aujourd'hui.

Hors périmètre :

- poser un `@nestjs/throttler` sur les routes publiques de l'étape 1, chantier déjà identifié dans CLAUDE.md ;
- guider les descriptions trop courtes ou trop vagues par des questions ;
- reformuler à partir des retours sur les noms (chantier `affiner-par-retour-libre`) ;
- reformuler la description d'un projet existant à sa réouverture.

## Capabilities

### New Capabilities

- `recherche/reformulation` : comment la description saisie à l'étape 1 est reformulée, présentée et confirmée avant le cadrage. Couvre ce que la reformulation doit conserver (cahier des charges, langue, faits) et quel texte sert ensuite de description au projet.

### Modified Capabilities

Aucune. `recherche/cahier-des-charges` n'est pas archivée. Ce chantier garantit que ses entrées survivent à la reformulation, sans en changer les exigences.

## Impact

- **Front** : `wizard.ts` (`refine`, `goToKeywords`, suppression du repli `refinedDescription() || description()` dans les quatre appelants), `wizard.html` (étape 1 : bouton retiré, panneau de confirmation), `web/public/assets/i18n/{fr,en}.json`.
- **API** : `api/src/domain/domain.service.ts`, consigne de `refineDescription`. Le contrat de `POST /domain/refine` est inchangé.
- **Coût** : un appel `simple` par passage à l'étape 1, contre un appel aujourd'hui seulement sur clic. Environ 0,0008 $ sur luna. Sur une route `@Public()`, sans limite de débit : le volume reste faible, et le throttler déjà prévu couvrira aussi cette route.
- **Latence** : 1 à 3 s de plus avant l'étape 2, le temps de la reformulation, affichées comme une attente.
- **Données** : aucune migration. Le projet garde une seule description, celle que l'utilisateur a choisie.
