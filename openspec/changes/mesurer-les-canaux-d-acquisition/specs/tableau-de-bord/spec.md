# Spec Delta

## ADDED Requirements

### Requirement: Canaux d'acquisition sur la période
Le tableau de bord SHALL afficher, sur la période choisie, un tableau des canaux
d'acquisition. Chaque ligne SHALL donner le nombre de visites, le nombre de visites ayant
créé un compte et le nombre de visites ayant lancé une recherche. Les lignes SHALL être
triées par nombre de visites décroissant, et un canal sans visite SHALL être omis.

#### Scenario: Sept jours dominés par un assistant
- **WHEN** sur 7 jours, 40 visites viennent de ChatGPT, dont 10 ont créé un compte et 12 ont lancé une recherche, et 15 visites sont directes
- **THEN** la première ligne est « ChatGPT et assistants IA — 40 visites, 10 comptes, 12 recherches », suivie de « Direct ou inconnu »

### Requirement: Pages d'arrivée sur la période
Le tableau de bord SHALL afficher, sur la période choisie, les huit pages d'arrivée
totalisant le plus de visites, avec les mêmes colonnes que les canaux. Les pages suivantes
SHALL être regroupées en une ligne « Autres pages ». Une visite sans page d'arrivée
SHALL compter dans une ligne « Inconnue ».

#### Scenario: Douze pages d'arrivée distinctes
- **WHEN** la période compte des visites sur 12 pages d'arrivée distinctes
- **THEN** le tableau montre 8 pages, puis une ligne « Autres pages » qui totalise les visites des 4 autres

### Requirement: Taux d'un canal ou d'une page
Le taux de comptes créés d'une ligne SHALL se rapporter aux visites de cette ligne
arrivées sans compte ouvert, et le taux de recherches à toutes ses visites. Sous 5 visites
au dénominateur, la ligne SHALL afficher les nombres sans pourcentage.

#### Scenario: Petite ligne
- **WHEN** une ligne compte 3 visites, dont 1 a créé un compte
- **THEN** elle affiche « 1 » sans pourcentage

#### Scenario: Visites arrivées connectées
- **WHEN** une ligne compte 20 visites, dont 4 arrivées avec un compte ouvert, et 4 comptes créés
- **THEN** le taux de comptes créés affiché est 25 % (4 sur 16)

### Requirement: Début de la mesure des canaux
Quand la période choisie commence avant la première visite dont l'origine a été
enregistrée, la section SHALL l'indiquer par « mesuré depuis le » suivi de cette date,
et SHALL NOT compter les visites antérieures comme « Direct ou inconnu ». Avant toute
visite mesurée, la section SHALL l'annoncer au lieu d'afficher des tableaux vides.

#### Scenario: Trente jours au lendemain du déploiement
- **WHEN** la période couvre 30 jours et que l'origine est enregistrée depuis le 08/11/2026
- **THEN** la section indique « mesuré depuis le 8 novembre », et les visites du 09/10 au 07/11 n'apparaissent dans aucune ligne

### Requirement: Indépendance de la section des canaux
Une erreur de calcul des canaux SHALL NOT empêcher l'affichage du reste du tableau de
bord ; la section SHALL alors dire qu'elle est indisponible.

#### Scenario: Requête en échec
- **WHEN** le calcul des canaux lève une erreur
- **THEN** les autres sections s'affichent, et la section des canaux affiche « indisponible »

### Requirement: Pas d'écart dans les tableaux de canaux
Les lignes des tableaux de canaux et de pages d'arrivée SHALL NOT porter d'écart à la
période précédente.

#### Scenario: Comparaison demandée
- **WHEN** l'administrateur consulte les canaux sur 30 jours
- **THEN** les lignes affichent les seuls chiffres de la période, sans badge d'écart
