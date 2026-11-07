# Spec Delta

## Purpose

Décrire les actions que porte la carte d'un nom dans les résultats : ce que chacune dit, ce qu'elle coûte, et ce qui change une fois le nom vérifié, pour qu'on comprenne chaque bouton sans l'essayer.

## ADDED Requirements

### Requirement: Un seul bouton de vérification, qui nomme ce qu'il vérifie
Le pied de la carte d'un nom non vérifié MUST porter un seul bouton d'action, intitulé « Vérifier marques déposées et réseaux sociaux » (« Check trademarks and social media » en anglais). Le coût en crédits MUST être écrit sous le bouton, avant tout clic. Aucun autre bouton du pied ne SHALL mener à l'achat.

#### Scenario: Nom non vérifié
- **WHEN** l'utilisateur voit la carte de « velvio », dont la marque n'a pas été vérifiée, avec un tarif de 50 crédits
- **THEN** le pied de carte présente le bouton « Vérifier marques déposées et réseaux sociaux »
- **AND** la mention « 50 crédits » figure sous ce bouton
- **AND** aucun bouton « Rapport complet » n'est affiché

#### Scenario: La confirmation avant débit reste due
- **WHEN** l'utilisateur clique sur « Vérifier marques déposées et réseaux sociaux »
- **THEN** une confirmation rappelant le coût et le solde s'affiche avant tout débit

### Requirement: Le bouton devient l'accès au rapport une fois le nom vérifié
Une fois le rapport du nom acheté, le même emplacement MUST porter « Voir le rapport de vérification » (« View verification report »), qui ouvre le rapport sans débit. La hauteur du pied de carte MUST rester identique dans les deux états.

#### Scenario: Nom vérifié
- **WHEN** l'utilisateur voit la carte de « norvane », dont le rapport a été acheté
- **THEN** le pied de carte présente le bouton « Voir le rapport de vérification »
- **AND** un clic ouvre le rapport de « norvane » sans débit de crédits

#### Scenario: Cartes voisines comparables
- **WHEN** une carte vérifiée et une carte non vérifiée sont affichées côte à côte
- **THEN** leurs pieds de carte ont la même hauteur

### Requirement: Trois icônes dans l'en-tête, sur la ligne du nom
L'en-tête de chaque carte MUST présenter, à droite du nom et sur la même ligne, trois icônes dans cet ordre : j'aime, je n'aime pas, partager — la notation seule étant masquée en lecture seule. Chaque icône MUST porter un libellé accessible qui nomme le geste et le nom concerné, et offrir une cible tactile d'au moins 44 px.

#### Scenario: Ordre de lecture
- **WHEN** l'utilisateur voit la carte de « velvio »
- **THEN** l'en-tête présente « velvio », puis 👍, 👎 et l'icône de partage, alignés sur une ligne

#### Scenario: Nom long
- **WHEN** le nom « platsvegetauxadomicile » ne tient pas sur une ligne à côté des trois icônes
- **THEN** le nom passe à la ligne dans sa colonne, et les trois icônes restent à droite de sa première ligne

#### Scenario: Projet consulté en lecture seule
- **WHEN** un invité en lecture seule voit la carte de « velvio »
- **THEN** 👍 et 👎 ne sont pas affichés, la notation lui étant refusée
- **AND** l'icône de partage est affichée à droite du nom

#### Scenario: Lecteur d'écran
- **WHEN** un lecteur d'écran atteint l'icône de partage de « velvio »
- **THEN** il annonce « Partager velvio »

### Requirement: Copier le nom depuis la carte
Le menu de partage d'un nom non vérifié MUST proposer « Copier le nom », qui copie le nom dans le presse-papiers sans débit et confirme la copie. Ce geste MUST rester disponible sur un projet consulté en lecture seule.

#### Scenario: Copie d'un nom non vérifié
- **WHEN** l'utilisateur choisit « Copier le nom » dans le menu de partage de « velvio »
- **THEN** « velvio » est dans le presse-papiers
- **AND** une confirmation brève indique que le nom est copié

#### Scenario: Projet en lecture seule
- **WHEN** un invité en lecture seule ouvre le menu de partage de « velvio »
- **THEN** « Copier le nom » est proposé
- **AND** « Vérifier puis partager » ne l'est pas
