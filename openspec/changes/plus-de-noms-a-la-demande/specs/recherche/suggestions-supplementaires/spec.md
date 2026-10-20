# Spec Delta

## Purpose

Garantir qu'une demande de suggestions supplémentaires (« 10 de plus ») rend autant de noms disponibles que le marché le permet dans un temps borné, sans reproposer de noms déjà écartés et sans débiter de noms que l'utilisateur ne voit pas.

## ADDED Requirements

### Requirement: Exclusion des noms déjà vérifiés
Une demande de suggestions supplémentaires MUST exclure tout nom déjà vérifié dans le projet pendant la session, qu'il ait été retenu ou trouvé indisponible. Le système SHALL ne jamais rendre ni vérifier à nouveau un tel nom.

#### Scenario: Un nom trouvé pris n'est pas revérifié
- **WHEN** une première recherche a vérifié le nom « lumora » et l'a trouvé indisponible
- **AND** l'utilisateur demande 10 suggestions supplémentaires dans le même projet
- **THEN** « lumora » ne figure pas parmi les noms vérifiés par la seconde recherche

#### Scenario: Un nom affiché n'est pas reproposé
- **WHEN** le nom « velyra » est affiché dans les résultats
- **AND** l'utilisateur demande 10 suggestions supplémentaires
- **THEN** « velyra » ne figure pas parmi les nouveaux résultats

#### Scenario: Un nom généré mais jamais vérifié reste proposable
- **WHEN** une recherche atteint son objectif avant d'avoir vérifié tous les noms générés
- **THEN** les noms générés et non vérifiés ne sont pas comptés comme déjà vérifiés

### Requirement: Recherche poursuivie tant qu'il manque des noms, dans un budget de temps
Le système SHALL continuer à générer et vérifier des noms tant que le nombre demandé n'est pas atteint. Il MUST s'arrêter dès que l'un de ces seuils est atteint : le nombre demandé, le budget de temps de la recherche, ou le plafond de tentatives. Le budget de temps et le plafond MUST être supérieurs à ceux d'avant ce changement (5 tentatives).

#### Scenario: Marché saturé, objectif atteint au-delà de 5 tentatives
- **WHEN** chaque tentative ne rend qu'un ou deux noms disponibles
- **AND** le budget de temps n'est pas épuisé
- **THEN** la recherche poursuit au-delà de la cinquième tentative jusqu'à rendre 10 noms ou atteindre l'un des seuils

#### Scenario: Budget de temps épuisé
- **WHEN** le budget de temps est atteint avec 6 noms trouvés
- **THEN** la recherche s'arrête, rend les 6 noms et signale qu'elle a rendu moins que demandé

### Requirement: Débit au nombre de noms rendus et vus
Le système MUST débiter exactement un crédit par nom rendu à l'utilisateur, et rien d'autre.

#### Scenario: Recherche partielle
- **WHEN** la recherche rend 6 noms sur 10 demandés
- **THEN** 6 crédits sont débités

### Requirement: Interruption par l'utilisateur
Quand le client ferme la connexion avant la fin d'une recherche, le système MUST arrêter de générer et de vérifier des noms. Il MUST ne rien débiter et ne rien enregistrer pour cette recherche.

#### Scenario: Stop pendant la recherche
- **WHEN** l'utilisateur clique sur Stop après que 3 noms ont été affichés
- **THEN** le serveur cesse toute vérification dans les secondes qui suivent
- **AND** aucun crédit n'est débité
- **AND** aucune suggestion n'est ajoutée au projet

### Requirement: Journalisation de l'issue d'une recherche
L'événement de fin de recherche MUST indiquer le nombre de tentatives consommées et la raison de l'arrêt : objectif atteint, budget de temps, plafond de tentatives ou interruption.

#### Scenario: Arrêt sur budget de temps
- **WHEN** une recherche s'arrête faute de temps
- **THEN** l'événement de fin porte la raison « budget de temps » et le nombre de tentatives consommées
