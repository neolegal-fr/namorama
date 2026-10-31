# Spec Delta

## Purpose

Faire relire à l'utilisateur, avant le cadrage, une reformulation de sa description qui en garde les faits, la langue et le cahier des charges du nom, et faire du texte qu'il choisit la seule description utilisée par la suite.

## ADDED Requirements

### Requirement: Reformulation proposée avant l'étape 2
Le passage de l'étape 1 à l'étape 2 SHALL demander une reformulation de la description, puis afficher une confirmation montrant la description saisie et la version proposée. L'étape 2 MUST ne s'ouvrir qu'après le choix de l'utilisateur.

#### Scenario: Premier passage
- **WHEN** l'utilisateur saisit la description d'une application de méditation pour soignants et clique « Continuer »
- **THEN** une attente s'affiche, puis la confirmation montre sa description et la version proposée, et l'étape 2 n'est pas encore ouverte

#### Scenario: Le bouton de reformulation séparé n'existe plus
- **WHEN** l'utilisateur est à l'étape 1
- **THEN** seul « Continuer » est proposé, sans bouton « Reformuler avec l'IA »

### Requirement: Deux choix, la version proposée retouchable
La confirmation SHALL offrir deux choix : utiliser la version proposée, éventuellement retouchée par l'utilisateur, ou garder sa description.

#### Scenario: Version proposée retenue après retouche
- **WHEN** l'utilisateur corrige un mot dans la version proposée puis choisit de l'utiliser
- **THEN** l'étape 2 s'ouvre avec le texte retouché comme description

#### Scenario: Description d'origine gardée
- **WHEN** l'utilisateur choisit « garder ma description »
- **THEN** l'étape 2 s'ouvre avec sa description, telle qu'il l'a saisie

### Requirement: Le texte choisi est la seule description
Le texte retenu à la confirmation SHALL devenir la description du projet. Mots-clés, contraintes du nom, nom de projet, repérage du marché et recherches MUST tous utiliser ce texte. Une version proposée et non retenue MUST NOT servir à quoi que ce soit.

#### Scenario: Version écartée
- **WHEN** l'utilisateur garde sa description puis lance une recherche
- **THEN** les mots-clés, les contraintes et la recherche sont calculés sur sa description, et la version proposée n'apparaît dans aucune requête

#### Scenario: Réouverture
- **WHEN** l'utilisateur a retenu la version proposée, lancé une recherche, puis rouvre le projet
- **THEN** la description du projet est la version retenue, et les recherches suivantes l'utilisent

### Requirement: Pas de seconde reformulation d'un texte inchangé
Un texte déjà reformulé et non modifié depuis MUST NOT être reformulé à nouveau. Le passage à l'étape 2 SHALL alors être direct.

#### Scenario: Retour à l'étape 1 sans modification
- **WHEN** l'utilisateur revient de l'étape 2 à l'étape 1 sans toucher au texte, puis clique « Continuer »
- **THEN** l'étape 2 s'ouvre sans nouvelle reformulation ni confirmation

#### Scenario: Texte modifié
- **WHEN** l'utilisateur revient à l'étape 1, ajoute une phrase, puis clique « Continuer »
- **THEN** une nouvelle reformulation est demandée et confirmée

### Requirement: Le cahier des charges du nom est conservé
La version proposée MUST conserver chaque instruction de nommage présente dans la description : longueur, mots ou terminaisons à éviter, mots imposés, marques de référence, type de nom.

#### Scenario: Longueur et terminaisons
- **WHEN** la description d'une boutique d'accessoires pour chiens demande « un nom court, 4-5 lettres, sans terminaison en -ora ou -ia »
- **THEN** la version proposée mentionne toujours 4 à 5 lettres et l'exclusion de -ora et -ia, et les contraintes extraites de la version proposée sont les mêmes que celles de la description

#### Scenario: Marques de référence
- **WHEN** la description demande un nom « dans l'esprit de Qonto ou Alan »
- **THEN** la version proposée cite toujours Qonto et Alan comme références

### Requirement: Aucun fait inventé, même langue
La version proposée MUST être rédigée dans la langue de la description, et MUST NOT ajouter de fonctionnalité, de public, de lieu ou de chiffre absents de la description.

#### Scenario: Description en anglais
- **WHEN** la description est rédigée en anglais
- **THEN** la version proposée est en anglais

#### Scenario: Public non mentionné
- **WHEN** la description d'un outil de facturation ne mentionne aucun public
- **THEN** la version proposée n'en ajoute pas (ni « PME », ni « freelances »)

### Requirement: Un échec ne bloque pas
Si la reformulation échoue, rend un texte vide ou dépasse 10 secondes, l'étape 2 SHALL s'ouvrir avec la description saisie, sans confirmation ni message d'erreur.

#### Scenario: Service indisponible
- **WHEN** la reformulation répond par une erreur 500
- **THEN** l'étape 2 s'ouvre avec la description saisie

### Requirement: Choix mesuré sans texte
L'affichage de la confirmation SHALL émettre `description_refine_shown`, et le choix SHALL émettre `description_refine_chosen` avec le choix fait et l'indication d'une retouche. Le texte d'une description, saisie ou proposée, MUST NOT être journalisé.

#### Scenario: Version retouchée retenue
- **WHEN** l'utilisateur retouche puis retient la version proposée
- **THEN** `description_refine_chosen` est émis avec `choix: reformulation` et `retouchee: true`, sans aucun texte
