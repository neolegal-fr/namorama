# Spec Delta

## Purpose

Garantir que les articles du blog se lisent dans les deux thèmes de l'application.

## ADDED Requirements

### Requirement: Articles lisibles dans les deux thèmes
Le texte d'un article — titres, chapeau, corps, signature, fil d'Ariane, tableaux, appel à
l'action et bloc « trois risques » — SHALL suivre le thème résolu de l'application et
atteindre un contraste d'au moins 4,5:1 sur son fond, en clair comme en sombre.

#### Scenario: Système en mode sombre
- **WHEN** un visiteur dont le système est en mode sombre ouvre `/namorama-vs-namelix`
- **THEN** le titre de l'article, ses titres de section et les cellules de son tableau
  ont un contraste d'au moins 4,5:1 sur le fond sombre de la page

#### Scenario: Comparatif en mode clair
- **WHEN** un visiteur en mode clair lit le tableau de `/namorama-vs-namelix`
- **THEN** les cellules « Oui » et « Non » ont un contraste d'au moins 4,5:1

#### Scenario: Appel à l'action en mode sombre
- **WHEN** un visiteur en mode sombre atteint l'encart « Lancer une recherche gratuite »
- **THEN** l'encart prend la surface d'accent sombre, et non un fond vert clair
