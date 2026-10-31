# Spec Delta

## Purpose

Garantir que les noms proposés respectent ce que l'utilisateur a demandé dans sa description (longueur, terminaisons, mots à éviter ou à inclure, type de nom), et qu'il voie et puisse corriger ce que le système a compris avant de payer une recherche.

## ADDED Requirements

### Requirement: Longueur demandée dans le brief appliquée aux noms inventés
Quand la description fixe une longueur minimale ou maximale, et que l'utilisateur n'a pas réglé la longueur lui-même, le système MUST ne rendre que des noms inventés dont la longueur respecte ces bornes. Il SHALL ne jamais élargir une borne maximale demandée. Seul le plancher technique de 5 caractères relève une borne minimale plus basse.

#### Scenario: Longueur exacte
- **WHEN** la description demande « un nom de 6 lettres exactement »
- **AND** l'utilisateur n'a pas modifié le réglage de longueur
- **THEN** chaque nom inventé rendu compte exactement 6 caractères

#### Scenario: Borne maximale respectée
- **WHEN** la description demande « nom court : 4-5 lettres »
- **THEN** aucun nom inventé rendu ne dépasse 5 caractères
- **AND** aucun ne compte moins de 5 caractères, le plancher technique

#### Scenario: Pas de longueur dans le brief
- **WHEN** la description ne mentionne aucune longueur
- **THEN** les bornes par défaut s'appliquent, comme avant ce changement

### Requirement: Réglage explicite de l'utilisateur prioritaire sur le brief
Quand l'utilisateur a modifié lui-même le réglage de longueur à l'étape 2, ce réglage MUST primer sur la longueur déduite de la description.

#### Scenario: L'utilisateur élargit après lecture
- **WHEN** la description demande « 5 lettres »
- **AND** l'utilisateur règle la longueur minimale sur 7
- **THEN** la recherche rend des noms d'au moins 7 caractères

### Requirement: Terminaisons et mots à éviter exclus des résultats
Les terminaisons et les mots ou racines que la description demande d'éviter MUST être absents de tout nom rendu, quel que soit son style. Une terminaison interdite SHALL écarter tout nom qui se termine par elle.

#### Scenario: Terminaisons interdites
- **WHEN** la description demande « sans terminaisons type 'ora' ou 'ia' »
- **THEN** aucun nom rendu ne se termine par « ora » ni par « ia »

#### Scenario: Mot à éviter
- **WHEN** la description demande d'éviter « cyber »
- **THEN** aucun nom rendu ne contient « cyber »

### Requirement: Mot imposé présent dans les noms
Quand la description impose un mot ou une racine à inclure, chaque nom rendu MUST le contenir.

#### Scenario: Racine imposée
- **WHEN** la description demande « un nom composé avec BLOOM »
- **THEN** chaque nom rendu contient « bloom »

### Requirement: Noms inventés par défaut
Sans choix de l'utilisateur ni indication du brief, le système MUST ne générer que des noms inventés, quelle que soit la région ou la langue du navigateur. Les styles descriptif et culturel SHALL n'être produits que si l'utilisateur les a choisis.

#### Scenario: Navigateur réglé en français
- **WHEN** un visiteur au navigateur en « fr-FR » lance une recherche sans toucher au type de nom
- **THEN** aucun nom descriptif ni culturel n'est rendu

#### Scenario: Choix explicite des noms descriptifs
- **WHEN** l'utilisateur choisit « inventés et descriptifs » à l'étape 2
- **THEN** la recherche peut rendre des noms descriptifs, signalés comme tels sur leur carte

### Requirement: Type de nom pré-sélectionné d'après le brief
L'étape 2 MUST présenter le choix du type de nom (inventés, descriptifs, les deux), pré-sélectionné d'après la description. L'utilisateur SHALL pouvoir le changer avant de lancer la recherche.

#### Scenario: Brief qui refuse le descriptif
- **WHEN** la description dit « avoid descriptive words »
- **THEN** l'étape 2 présente « noms inventés » sélectionné

#### Scenario: Brief qui veut un nom explicite
- **WHEN** la description demande « un nom qui dise clairement ce que fait l'entreprise »
- **THEN** l'étape 2 présente « inventés et descriptifs » sélectionné

### Requirement: Contraintes comprises affichées et corrigeables
Avant la recherche, l'étape 2 MUST afficher les contraintes que le système a tirées de la description : longueur, terminaisons et mots à éviter, mots à inclure, type de nom. L'utilisateur SHALL pouvoir retirer une contrainte avant de lancer la recherche.

#### Scenario: Contrainte mal comprise retirée
- **WHEN** l'étape 2 affiche « éviter : sport »
- **AND** l'utilisateur retire cette contrainte
- **THEN** la recherche n'écarte pas les noms contenant « sport »

#### Scenario: Aucune contrainte
- **WHEN** la description ne contient aucune consigne sur le nom
- **THEN** l'étape 2 n'affiche pas de bloc de contraintes vide

### Requirement: Élargissement aux noms descriptifs suggéré
Quand une recherche limitée aux noms inventés rend moins que demandé, ou que l'utilisateur a rejeté au moins 5 noms du projet sans en aimer aucun, le système MUST proposer d'inclure les noms descriptifs. L'utilisateur SHALL pouvoir accepter en un clic, ce qui relance la recherche.

#### Scenario: Recherche incomplète
- **WHEN** une recherche en noms inventés rend 4 noms sur 10
- **THEN** la note de fin de recherche propose d'inclure les noms descriptifs

#### Scenario: Rejets sans favori
- **WHEN** l'utilisateur a rejeté 5 noms du projet et n'en a aimé aucun
- **THEN** la proposition d'inclure les noms descriptifs s'affiche

#### Scenario: Déjà élargi
- **WHEN** les noms descriptifs sont déjà inclus
- **THEN** la proposition ne s'affiche pas

### Requirement: Effet des contraintes mesuré
Chaque recherche MUST journaliser, sans contenu de la description, les contraintes appliquées (bornes de longueur, nombre de terminaisons et de mots à éviter ou à inclure, type de nom) et le nombre de noms générés écartés par elles.

#### Scenario: Recherche contrainte
- **WHEN** une recherche s'exécute avec une longueur maximale de 6 et deux terminaisons interdites
- **THEN** l'événement de fin de recherche porte ces bornes, ces décomptes et le nombre de noms écartés
- **AND** il ne contient ni la description ni les mots eux-mêmes
