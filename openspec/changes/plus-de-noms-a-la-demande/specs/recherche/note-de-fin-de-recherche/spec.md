# Spec Delta

## Purpose

Dire honnêtement à l'utilisateur pourquoi une recherche a rendu moins de noms que demandé, en nommant les extensions et le mode de disponibilité qu'il a réellement choisis.

## ADDED Requirements

### Requirement: La note cite les extensions et le mode demandés
Quand une recherche rend moins de noms que demandé, la note affichée MUST nommer les extensions sélectionnées par l'utilisateur et le mode choisi. Le mode s'énonce avec « ou » quand une extension libre suffit, avec « et » quand toutes doivent l'être. La note MUST ne jamais citer une extension non demandée.

#### Scenario: Une extension libre suffit
- **WHEN** l'utilisateur a choisi .fr et .com, et qu'une extension libre suffit
- **AND** la recherche rend 4 noms sur 10
- **THEN** la note indique que seuls 4 noms étaient disponibles en .fr ou .com

#### Scenario: Toutes les extensions doivent être libres
- **WHEN** l'utilisateur a choisi .fr et .com, et que toutes doivent être libres
- **AND** la recherche rend 2 noms sur 10
- **THEN** la note indique que seuls 2 noms étaient disponibles en .fr et .com

#### Scenario: Extension unique autre que .com
- **WHEN** l'utilisateur n'a choisi que .io
- **THEN** la note ne mentionne pas .com
