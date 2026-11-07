# Spec Delta

## Purpose

Permettre de transmettre le rapport de vérification d'un nom qu'on aime — par lien, par e-mail ou en PDF — depuis la carte du nom comme depuis le rapport, en disant clairement ce que le destinataire pourra voir.

## ADDED Requirements

### Requirement: Le partage d'un nom vérifié offre trois moyens
L'icône de partage d'un nom dont le rapport est acheté MUST ouvrir un menu proposant, sans débit : « Copier le lien », « Envoyer par e-mail » (rapport joint) et « Télécharger le PDF ». Ces trois moyens MUST être les mêmes que ceux du menu « Partager » de la page du rapport.

#### Scenario: Menu d'un nom vérifié
- **WHEN** l'utilisateur ouvre le menu de partage de « norvane », dont le rapport est acheté
- **THEN** le menu propose « Copier le lien », « Envoyer par e-mail » et « Télécharger le PDF »
- **AND** aucun crédit n'est débité

#### Scenario: Même offre que dans le rapport
- **WHEN** l'utilisateur ouvre ensuite le rapport de « norvane » et son menu « Partager »
- **THEN** il y trouve les trois mêmes moyens

### Requirement: Copier le lien depuis la carte sans ouvrir le rapport
« Copier le lien » MUST copier l'adresse publique du rapport (`/rapport/<jeton>`) sans quitter les résultats, et confirmer la copie en rappelant que toute personne qui reçoit ce lien pourra consulter le rapport sans compte.

#### Scenario: Lien copié depuis la carte
- **WHEN** l'utilisateur choisit « Copier le lien » sur la carte de « norvane »
- **THEN** l'adresse publique du rapport de « norvane » est dans le presse-papiers
- **AND** les résultats restent affichés
- **AND** la confirmation rappelle que le lien donne accès au rapport sans compte

### Requirement: Le lien public est annoncé avant d'être copié
Le menu de partage d'un nom vérifié MUST afficher, avant tout choix, que toute personne qui reçoit le lien pourra consulter le rapport sans compte.

#### Scenario: Avertissement visible
- **WHEN** l'utilisateur ouvre le menu de partage de « norvane »
- **THEN** le menu affiche « Toute personne qui reçoit ce lien pourra consulter le rapport, sans compte. »

### Requirement: Télécharger le PDF depuis la carte
« Télécharger le PDF » MUST ouvrir le rapport du nom et lancer aussitôt la boîte d'impression du navigateur, dont la destination proposée par défaut est un PDF.

#### Scenario: PDF demandé depuis la carte
- **WHEN** l'utilisateur choisit « Télécharger le PDF » sur la carte de « norvane »
- **THEN** le rapport de « norvane » s'affiche
- **AND** la boîte d'impression s'ouvre une fois le rapport affiché

### Requirement: Envoyer par e-mail un rapport payé par le propriétaire du projet
L'envoi par e-mail MUST fonctionner pour tout utilisateur qui peut lire le rapport, y compris un invité d'un projet partagé dont le rapport a été payé par le propriétaire. Il MUST ne jamais générer ni débiter de rapport.

#### Scenario: Invité d'un projet partagé
- **WHEN** un invité ouvre le projet d'un autre compte, dont le propriétaire a acheté le rapport de « norvane »
- **AND** il choisit « Envoyer par e-mail » et saisit une adresse
- **THEN** le rapport de « norvane » est envoyé à cette adresse, avec le lien public et le rapport joint
- **AND** aucun crédit n'est débité, ni à l'invité ni au propriétaire

#### Scenario: Aucun rapport pour ce nom
- **WHEN** une demande d'envoi porte sur un nom sans rapport accessible à l'utilisateur
- **THEN** l'envoi est refusé et aucun rapport n'est produit

### Requirement: Partager un nom non vérifié passe par la vérification
L'icône de partage d'un nom non vérifié MUST ouvrir un menu qui explique que le partage envoie le rapport de vérification, et propose « Vérifier puis partager » avec son coût. Ce choix MUST suivre le parcours d'achat habituel, confirmation comprise, puis afficher le rapport et son menu « Partager ».

#### Scenario: Partage demandé avant vérification
- **WHEN** l'utilisateur ouvre le menu de partage de « velvio », non vérifié, avec un tarif de 50 crédits
- **THEN** le menu indique que le partage envoie le rapport de vérification
- **AND** il propose « Vérifier puis partager — 50 crédits »

#### Scenario: Vérification confirmée
- **WHEN** l'utilisateur choisit « Vérifier puis partager » et confirme le débit
- **THEN** le rapport de « velvio » est produit et affiché, avec son menu « Partager »

#### Scenario: Vérification annulée
- **WHEN** l'utilisateur choisit « Vérifier puis partager » puis annule la confirmation
- **THEN** aucun crédit n'est débité et les résultats restent affichés
