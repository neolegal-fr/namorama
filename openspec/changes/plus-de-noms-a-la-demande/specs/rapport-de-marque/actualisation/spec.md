# Spec Delta

## Purpose

Garantir qu'actualiser un rapport de marque vérifie les mêmes domaines que le rapport d'origine, sans y faire apparaître des extensions que l'utilisateur n'a pas demandées.

## ADDED Requirements

### Requirement: L'actualisation conserve les extensions du projet
L'actualisation d'un rapport de marque depuis un projet MUST vérifier les extensions sélectionnées dans ce projet, et elles seules, comme le rapport d'origine.

#### Scenario: Actualisation d'un rapport en .fr et .com
- **WHEN** le projet porte les extensions .fr et .com
- **AND** l'utilisateur actualise le rapport de marque d'un nom
- **THEN** le rapport actualisé présente la disponibilité en .fr et .com
- **AND** il ne présente ni .io, ni .net, ni .app
