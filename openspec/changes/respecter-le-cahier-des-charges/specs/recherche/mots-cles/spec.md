# Spec Delta

## Purpose

Garantir que les mots-clés proposés à l'étape de cadrage décrivent l'activité, le produit, son public et ses bénéfices, et jamais les consignes sur le nom, qui sont traitées comme des contraintes et non comme du vocabulaire.

## ADDED Requirements

### Requirement: Mots-clés tirés de l'activité seule
Les mots-clés proposés MUST porter sur ce que fait l'entreprise ou le produit : activité, public, bénéfices, univers. Ce que la description dit du nom lui-même (longueur, ton, style, marques à imiter, mots à éviter, consignes adressées à une IA) SHALL ne produire aucun mot-clé.

#### Scenario: Description mêlant activité et cahier des charges
- **WHEN** la description est « Agence de conseil en SEO et SEA. Je veux un nom court, premium, facile à prononcer, de 6 lettres »
- **THEN** les mots-clés portent sur le référencement, l'acquisition, le conseil
- **AND** aucun mot-clé n'est « nom », « court », « premium », « prononcer » ni « lettres »

#### Scenario: Consigne adressée à une IA
- **WHEN** la description commence par « Act as a world-class naming agency. Generate 30 brandable names for… »
- **THEN** aucun mot-clé n'est « naming », « agency », « brandable » ni « names », sauf si l'activité décrite est elle-même une agence de nommage

### Requirement: Vocabulaire du nommage écarté même s'il est proposé
Un mot-clé qui ne désigne que la notion de nom ou de marque MUST être écarté de la liste rendue, même si le modèle le propose, sauf quand l'activité décrite porte elle-même sur le nommage ou la création de marque.

#### Scenario: Mot générique de nommage
- **WHEN** le modèle propose « nom de marque », « brand name » ou « identité de marque » pour une boutique de vêtements
- **THEN** ces mots-clés ne figurent pas dans la liste proposée

#### Scenario: Activité de nommage
- **WHEN** la description présente une agence de création de marques
- **THEN** « création de marque » peut figurer parmi les mots-clés

### Requirement: Les noms générés ne reprennent pas le vocabulaire du brief
Les noms générés MUST être construits à partir des mots-clés de l'activité et des contraintes, sans s'inspirer des mots du cahier des charges du nom.

#### Scenario: Brief sur la marque, activité e-commerce
- **WHEN** la description est « Premium international ecommerce brand. Short invented name. Trustworthy. Avoid descriptive words »
- **THEN** les noms rendus ne sont pas bâtis sur « marque », « nom », « brand » ou « name » (pas de `marqora`, `nomvera`, `markio`)
