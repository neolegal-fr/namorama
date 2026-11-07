# Spec Delta

## Purpose
Faire déclarer à chaque page, dès son chargement, la langue qu'elle affiche, pour que les
moteurs, les lecteurs d'écran et les traducteurs des navigateurs ne la prennent pas pour
une autre.

## ADDED Requirements

### Requirement: Langue déclarée dès le chargement d'une page cliente
Une page rendue dans le navigateur SHALL déclarer, avant l'exécution du code de
l'application, la langue dans laquelle l'application l'affichera.

#### Scenario: Navigateur anglais sur l'application
- **WHEN** un navigateur réglé en anglais ouvre `/app`
- **THEN** la page déclare `en` dès la fin de son chargement, et non `fr`

#### Scenario: Navigateur allemand sur l'application
- **WHEN** un navigateur réglé en allemand, langue non servie, ouvre `/projects/:id`
- **THEN** la page déclare `en`, langue de repli de l'application

#### Scenario: Navigateur français sur l'application
- **WHEN** un navigateur réglé en français ouvre `/app`
- **THEN** la page déclare `fr`

### Requirement: Même règle que l'application
La langue déclarée au chargement SHALL suivre la règle de l'application : la langue
portée par le premier segment de l'URL si elle est servie, sinon la langue principale du
navigateur si elle est servie, sinon l'anglais.

#### Scenario: Variante régionale
- **WHEN** la langue principale du navigateur est `fr-CA`
- **THEN** la page déclare `fr`

#### Scenario: L'URL prime sur le navigateur
- **WHEN** un navigateur réglé en français ouvre une page client dont l'URL commence par `/en/`
- **THEN** la page déclare `en`

### Requirement: Langue des pages prérendues inchangée
Une page prérendue SHALL garder la langue posée lors de son rendu, quelle que soit la
langue du navigateur.

#### Scenario: Landing française et navigateur anglais
- **WHEN** un navigateur réglé en anglais ouvre `/`
- **THEN** la page déclare `fr`, comme son contenu

#### Scenario: Landing anglaise et navigateur français
- **WHEN** un navigateur réglé en français ouvre `/en`
- **THEN** la page déclare `en`
