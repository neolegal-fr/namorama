# Spec Delta

## Purpose
Faire remonter du navigateur les seules erreurs qu'un visiteur subit, avec de quoi
retrouver l'endroit du code qui les produit.

## ADDED Requirements

### Requirement: Une annulation n'est pas une erreur
Un rejet de promesse non géré dont la raison est une `AbortError` SHALL NOT produire
d'événement `client_unhandled_rejection`.

#### Scenario: Requête annulée par un désabonnement
- **WHEN** une analyse de nom est abandonnée parce que l'utilisateur a changé d'écran, et que le navigateur rejette avec « signal is aborted without reason »
- **THEN** aucun événement `client_unhandled_rejection` n'est envoyé

#### Scenario: Autre rejet
- **WHEN** une promesse est rejetée avec `TypeError: undefined is not an object (evaluating 'n.length')`
- **THEN** un événement `client_unhandled_rejection` est envoyé avec ce message

### Requirement: Pile jointe au rejet
Un événement `client_unhandled_rejection` SHALL porter la pile de la raison du rejet
quand elle en a une, tronquée à 300 caractères.

#### Scenario: Rejet avec une erreur
- **WHEN** une promesse est rejetée avec une `TypeError` levée dans `main-ABC123.js`
- **THEN** l'événement porte un champ `stack` qui contient `main-ABC123.js`

#### Scenario: Rejet avec une valeur qui n'est pas une erreur
- **WHEN** une promesse est rejetée avec la chaîne `"keycloak init timeout"`
- **THEN** l'événement porte ce message et un champ `stack` vide

### Requirement: Source maps hors de portée du public
La compilation de production SHALL produire les source maps des scripts sans que les
scripts servis les référencent, et le serveur web SHALL NOT les servir.

#### Scenario: Script servi
- **WHEN** on télécharge `https://namorama.com/main-<hash>.js`
- **THEN** le fichier ne contient aucun commentaire `sourceMappingURL`

#### Scenario: Map demandée directement
- **WHEN** on demande `https://namorama.com/main-<hash>.js.map`
- **THEN** le fichier n'est pas servi

### Requirement: Pile retraduite vers le code source
L'équipe SHALL pouvoir retraduire une pile remontée par la production en fichiers,
lignes et colonnes du code source, avec les maps de l'image déployée.

#### Scenario: Pile d'un rejet en production
- **WHEN** on passe au script de retraduction la pile `at n (https://namorama.com/chunk-XYZ.js:1:2345)` et les maps extraites du conteneur web
- **THEN** il affiche le fichier source, par exemple `src/app/components/content/content-seo.ts`, et la ligne correspondante
