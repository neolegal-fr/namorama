# Spec Delta

## ADDED Requirements

### Requirement: Plancher de longueur fixé par le produit
Aucune recherche MUST porter sur des noms inventés de moins de 6 caractères. Ce plancher SHALL ne se régler ni à l'écran ni par la description.

#### Scenario: Requête qui demande moins
- **WHEN** une requête de recherche arrive avec une longueur minimale de 5
- **THEN** la recherche ne rend aucun nom inventé de moins de 6 caractères

### Requirement: Longueur maximale par défaut
Sans longueur dans la description ni réglage de l'utilisateur, la recherche MUST porter sur des noms inventés de 6 à 10 caractères.

#### Scenario: Description sans longueur
- **WHEN** la description ne mentionne aucune longueur et que l'utilisateur ne touche pas au réglage
- **THEN** l'écran affiche « Au plus 10 caractères », marqué « par défaut »
- **AND** chaque nom inventé rendu compte de 6 à 10 caractères

### Requirement: Brief sous le plancher ramené au plancher et signalé
Quand la description fixe un maximum inférieur à 6, le système MUST chercher des noms de 6 caractères exactement. L'écran de cadrage SHALL le dire en clair, avant la recherche, sans parler d'erreur.

#### Scenario: « Nom court : 4-5 lettres »
- **WHEN** la description demande un nom de 4 à 5 lettres
- **THEN** le réglage affiche « Au plus 6 caractères », marqué comme repris de la description
- **AND** une phrase dit que sous 6 caractères presque tous les .com sont pris, et que la recherche commence à 6
- **AND** chaque nom inventé rendu compte exactement 6 caractères

## MODIFIED Requirements

### Requirement: Longueur demandée dans le brief appliquée aux noms inventés
Quand la description fixe une longueur minimale ou maximale, et que l'utilisateur n'a pas réglé la longueur lui-même, le système MUST ne rendre que des noms inventés dont la longueur respecte ces bornes, relevées au plancher de 6 caractères. Un maximum demandé au-dessus du plancher SHALL n'être jamais élargi.

#### Scenario: Longueur exacte
- **WHEN** la description demande « un nom de 6 lettres exactement »
- **AND** l'utilisateur n'a pas modifié le réglage de longueur
- **THEN** chaque nom inventé rendu compte exactement 6 caractères

#### Scenario: Borne maximale respectée
- **WHEN** la description demande « pas plus de 8 lettres »
- **THEN** aucun nom inventé rendu ne dépasse 8 caractères
- **AND** aucun ne compte moins de 6 caractères, le plancher

#### Scenario: Borne minimale du brief
- **WHEN** la description demande « au moins 8 lettres »
- **THEN** aucun nom inventé rendu ne compte moins de 8 caractères
- **AND** l'écran affiche le maximum par défaut, 10, et dit que la recherche commence à 8

#### Scenario: Pas de longueur dans le brief
- **WHEN** la description ne mentionne aucune longueur
- **THEN** les bornes par défaut s'appliquent : 6 à 10 caractères

### Requirement: Réglage explicite de l'utilisateur prioritaire sur le brief
L'étape 2 MUST proposer un seul réglage de longueur : un maximum, de 6 à 12 caractères, ou « sans limite ». Quand l'utilisateur l'a modifié, ce maximum MUST primer sur la longueur déduite de la description, et la recherche SHALL porter sur les noms inventés de 6 caractères jusqu'à ce maximum.

#### Scenario: L'utilisateur élargit après lecture
- **WHEN** la description demande « 4-5 lettres »
- **AND** l'utilisateur règle la longueur sur « Au plus 9 caractères »
- **THEN** la recherche rend des noms inventés de 6 à 9 caractères

#### Scenario: L'utilisateur resserre
- **WHEN** l'utilisateur règle la longueur sur « Au plus 7 caractères »
- **THEN** la recherche rend des noms inventés de 6 ou 7 caractères
- **AND** l'écran prévient, avant la recherche, que la plage est étroite et que la recherche sera plus longue

#### Scenario: Sans limite
- **WHEN** l'utilisateur choisit « sans limite »
- **THEN** la recherche rend des noms inventés d'au moins 6 caractères, sans maximum demandé par l'écran

#### Scenario: Minimum envoyé par un ancien onglet
- **WHEN** une requête arrive avec une longueur minimale de 7, sans maximum, depuis un onglet ouvert avant le changement
- **THEN** la recherche aboutit, avec des noms inventés d'au moins 7 caractères

### Requirement: Contraintes comprises affichées et corrigeables
Avant la recherche, l'étape 2 MUST afficher les contraintes que le système a tirées de la description : terminaisons et mots à éviter, mots à inclure, type de nom, dans le bloc « Le nom ». La longueur comprise SHALL s'afficher dans le réglage de longueur, marquée comme reprise de la description, et non comme une puce. L'utilisateur SHALL pouvoir retirer une contrainte avant de lancer la recherche.

#### Scenario: Contrainte mal comprise retirée
- **WHEN** l'étape 2 affiche « éviter : sport »
- **AND** l'utilisateur retire cette contrainte
- **THEN** la recherche n'écarte pas les noms contenant « sport »

#### Scenario: Longueur comprise
- **WHEN** la description demande « pas plus de 8 lettres »
- **THEN** le réglage affiche « Au plus 8 caractères », marqué « repris de votre description »
- **AND** aucune puce de longueur n'est affichée

#### Scenario: Aucune contrainte
- **WHEN** la description ne contient aucune consigne sur le nom
- **THEN** l'étape 2 n'affiche pas de bloc de contraintes vide
