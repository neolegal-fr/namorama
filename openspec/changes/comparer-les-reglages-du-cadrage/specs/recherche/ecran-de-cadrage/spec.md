# Spec Delta

## ADDED Requirements

### Requirement: Les trois styles décrits ensemble
Sous le choix du style, l'écran de cadrage SHALL décrire les trois styles en même temps,
chacun avec un exemple de nom, et SHALL distinguer la description du style sélectionné.
Lire la description d'un style SHALL NOT demander de le sélectionner.

#### Scenario: Comparer avant de choisir
- **WHEN** l'utilisateur arrive à l'étape de cadrage avec « Inventés » sélectionné
- **THEN** il lit, sans cliquer, la description d'« Inventés » (ex : qonto, figma), celle d'« Inventés + descriptifs » et celle d'« Inventés + culturels »
- **AND** la description d'« Inventés » est mise en avant

#### Scenario: Changer de style
- **WHEN** l'utilisateur sélectionne « Inventés + descriptifs »
- **THEN** les trois descriptions restent affichées, et c'est celle d'« Inventés + descriptifs » qui est mise en avant

### Requirement: Chaque critère de disponibilité expliqué
Quand plusieurs extensions sont retenues, l'écran de cadrage SHALL afficher sous le
critère de disponibilité une phrase qui dit ce que le critère choisi change, pour
« Au moins une extension disponible » comme pour « Toutes les extensions disponibles ».

#### Scenario: Au moins une extension
- **WHEN** l'utilisateur retient .com et .fr avec le critère « Au moins une extension disponible »
- **THEN** une phrase dit qu'un nom est proposé dès qu'une des extensions est libre

#### Scenario: Toutes les extensions
- **WHEN** l'utilisateur retient .com et .fr avec le critère « Toutes les extensions disponibles »
- **THEN** une phrase dit que chaque nom doit être libre sur les deux, et que la recherche peut être plus longue

#### Scenario: Une seule extension
- **WHEN** l'utilisateur ne retient que .com
- **THEN** ni le critère ni sa phrase ne s'affichent
