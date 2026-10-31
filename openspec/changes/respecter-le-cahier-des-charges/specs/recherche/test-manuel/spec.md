# Spec Delta

## Purpose

Garantir que la saisie libre du champ « tester un nom » des résultats ne vérifie, et n'ajoute aux favoris, que des noms que l'utilisateur a réellement voulu tester.

## ADDED Requirements

### Requirement: Noms séparés par des séparateurs de liste
Le champ de test manuel MUST considérer comme séparateurs de noms la virgule, le point-virgule et le retour à la ligne, et eux seuls. Une espace SHALL ne jamais séparer deux noms.

#### Scenario: Liste à virgules
- **WHEN** l'utilisateur saisit « velmora, homiara; vellune »
- **THEN** trois noms sont vérifiés : `velmora`, `homiara`, `vellune`

#### Scenario: Liste sur plusieurs lignes
- **WHEN** l'utilisateur colle trois noms, un par ligne
- **THEN** trois noms sont vérifiés

### Requirement: Nom en plusieurs mots collé
Une entrée de deux ou trois mots MUST devenir un seul nom, mots collés, après la même normalisation qu'aujourd'hui (minuscules, extension retirée).

#### Scenario: Nom en deux mots
- **WHEN** l'utilisateur saisit « Neo Legal »
- **THEN** un seul nom est vérifié : `neolegal`

#### Scenario: Extension saisie
- **WHEN** l'utilisateur saisit « goldelis.com »
- **THEN** le nom vérifié est `goldelis`

### Requirement: Phrase refusée avec une explication
Une entrée de plus de trois mots MUST être refusée sans rien vérifier ni ajouter aux favoris. Le système SHALL afficher un message qui explique comment saisir des noms, et garder la saisie dans le champ pour que l'utilisateur la corrige.

#### Scenario: Phrase saisie
- **WHEN** l'utilisateur saisit « mon choix se porte sur goldelis »
- **THEN** aucun nom n'est vérifié ni ajouté aux favoris
- **AND** un message invite à séparer les noms par des virgules
- **AND** le texte saisi reste dans le champ

#### Scenario: Liste mêlant un nom et une phrase
- **WHEN** l'utilisateur saisit « goldelis, je préfère celui-ci à tous les autres »
- **THEN** rien n'est vérifié, et le message signale l'entrée qui pose problème
