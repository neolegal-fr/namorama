# Spec Delta

## Purpose

Donner à l'administrateur, sur une seule page, les indicateurs standard d'un SaaS —
activité, rétention, satisfaction, revenu, coût — calculés sur les seuls comptes réels,
et dire explicitement quand un indicateur n'a pas de valeur plutôt que d'afficher zéro.

## ADDED Requirements

### Requirement: Population mesurée
Tous les indicateurs du tableau de bord SHALL écarter les comptes administrateurs et les
comptes marqués « interne », ainsi que leurs projets, noms, rapports, visites, paiements
et coûts imputés.

#### Scenario: Compte interne actif
- **WHEN** un compte marqué « interne » a une activité trois jours d'octobre et crée deux projets
- **THEN** il n'entre ni dans le MAU, ni dans le nombre de recherches, ni dans le taux de succès d'octobre

### Requirement: Utilisateurs actifs sur la période
Le tableau de bord SHALL afficher le nombre de comptes distincts ayant au moins un jour
d'activité dans la période choisie, sous le libellé « MAU » quand la période couvre 28
jours ou plus, « utilisateurs actifs » sinon. Une période commençant avant le début du
journal d'activité SHALL afficher « — » avec la date de début du journal.

#### Scenario: Trente derniers jours au 31/10/2026
- **WHEN** l'administrateur choisit « 30 jours » le 31/10/2026 et que 52 comptes mesurés ont une activité dans cette fenêtre
- **THEN** la carte « MAU » affiche 52

#### Scenario: Période antérieure au journal
- **WHEN** la période choisie commence le 01/08/2026 et que le journal d'activité commence le 23/08/2026
- **THEN** la carte affiche « — » et « mesuré depuis le 23 août »

### Requirement: Décomposition des actifs en nouveaux et récurrents
La carte des utilisateurs actifs SHALL indiquer combien de ces comptes ont été créés
pendant la période (nouveaux) et combien avant (récurrents).

#### Scenario: Activité portée par les inscriptions
- **WHEN** 51 des 52 comptes actifs sur 30 jours ont été créés dans ces 30 jours
- **THEN** la carte affiche « 51 nouveaux · 1 récurrent »

### Requirement: Fréquence d'usage
Sur une période de 28 jours ou plus, le tableau de bord SHALL afficher le DAU moyen
(jours d'activité ÷ jours de la période) et le rapport DAU/MAU en pourcentage. Sur une
période plus courte, ces deux valeurs SHALL être absentes.

#### Scenario: Usage occasionnel
- **WHEN** les 52 comptes actifs des 30 derniers jours totalisent 63 jours d'activité
- **THEN** le DAU moyen affiché est 2,1 et le DAU/MAU 4 %

#### Scenario: Période de sept jours
- **WHEN** l'administrateur choisit « 7 jours »
- **THEN** ni DAU moyen ni DAU/MAU ne sont affichés, et la carte des actifs porte le libellé « utilisateurs actifs »

### Requirement: Jours actifs par compte
Le tableau de bord SHALL afficher le nombre moyen de jours d'activité par compte actif
sur la période, et la répartition des comptes actifs en trois tranches : 1 jour, 2 à 3
jours, 4 jours et plus.

#### Scenario: Octobre 2026
- **WHEN** le mois civil d'octobre 2026 compte 52 comptes actifs pour 62 jours d'activité
- **THEN** la moyenne affichée est 1,2 jour, et la somme des trois tranches vaut 52

### Requirement: Profondeur d'usage
Le tableau de bord SHALL afficher, sur la période, le nombre de recherches (projets
créés), le nombre de recherches par compte actif, et le nombre de comptes ayant créé
plus d'un projet.

#### Scenario: Trente derniers jours au 31/10/2026
- **WHEN** 44 comptes ont créé 52 projets sur la période, dont 6 en ont créé plus d'un
- **THEN** le tableau de bord affiche 52 recherches et « 6 comptes sur 44 ont fait plusieurs recherches »

### Requirement: Taux d'activation
Le tableau de bord SHALL afficher la part des comptes créés pendant la période qui ont
créé au moins un projet, avec le numérateur et le dénominateur. Sans inscription sur la
période, le taux SHALL valoir « — ».

#### Scenario: Aucune inscription
- **WHEN** aucun compte n'a été créé pendant la période choisie
- **THEN** le taux d'activation affiche « — » et « aucune inscription sur la période »

### Requirement: Taux de succès des recherches
Le tableau de bord SHALL afficher la part des projets créés pendant la période qui
comptent au moins un nom mis en favori, avec le numérateur et le dénominateur. Sous 5
projets, le taux SHALL être remplacé par les valeurs brutes.

#### Scenario: Trente derniers jours au 31/10/2026
- **WHEN** 8 des 52 projets créés sur la période ont au moins un favori
- **THEN** la carte « Taux de succès » affiche 15 % et « 8 projets sur 52 »

#### Scenario: Trop peu de projets
- **WHEN** 3 projets ont été créés sur la période, dont 1 avec un favori
- **THEN** la carte affiche « 1 sur 3 » sans pourcentage

### Requirement: Notes des noms sans ratio
Le tableau de bord SHALL afficher le nombre de comptes ayant noté au moins un nom sur la
période, et SHALL NOT afficher de pourcentage de 👍 parmi les noms notés.

#### Scenario: Un 👎 utilisé pour écarter
- **WHEN** 8 comptes ont donné 27 👍 et 681 👎 sur la période
- **THEN** le tableau de bord affiche « 8 comptes ont noté des noms » et aucun taux de satisfaction

### Requirement: Retours écrits
Le tableau de bord SHALL afficher le nombre de retours écrits reçus sur la période, avec
un lien vers l'onglet Feedbacks.

#### Scenario: Trois retours en octobre
- **WHEN** 3 retours ont été envoyés dans les 30 derniers jours
- **THEN** la carte affiche 3 et mène à l'onglet Feedbacks

### Requirement: Décomposition mensuelle des actifs
Pour chaque mois civil depuis le début du journal d'activité, le tableau de bord SHALL
répartir les comptes en nouveaux (créés dans le mois), retenus (actifs ce mois et le
précédent), réactivés (actifs ce mois, inactifs le précédent, créés avant) et perdus
(actifs le mois précédent, inactifs ce mois).

#### Scenario: Octobre 2026
- **WHEN** 51 comptes actifs en octobre y ont été créés, 1 était aussi actif en septembre, et 39 comptes actifs en septembre ne le sont plus en octobre
- **THEN** octobre affiche 51 nouveaux, 1 retenu, 0 réactivé, 39 perdus

#### Scenario: Premier mois du journal
- **WHEN** le journal commence le 23/08/2026
- **THEN** août n'affiche ni retenus, ni réactivés, ni perdus, avec la mention « mois incomplet »

### Requirement: Rétention par cohorte mensuelle
Le tableau de bord SHALL afficher, pour chaque mois d'inscription depuis le début du
journal, la part des inscrits actifs pendant chacun des mois suivants (M+1 à M+5). La
case du mois en cours SHALL être estompée et marquée incomplète ; celle d'un mois à venir
SHALL rester vide.

#### Scenario: Cohorte de septembre au 31/10/2026
- **WHEN** 40 comptes se sont inscrits en septembre 2026 et que le mois en cours est octobre
- **THEN** la ligne de septembre affiche M+1 (octobre) estompé comme incomplet, et M+2 à M+5 vides

### Requirement: Retours sous 7 et 30 jours
Le tableau de bord SHALL conserver les taux de retour sous 7 et sous 30 jours, calculés
sur les seuls inscrits dont le délai est écoulé.

#### Scenario: Inscrit d'hier
- **WHEN** un compte s'est inscrit la veille
- **THEN** il n'entre pas dans le dénominateur du retour sous 7 jours

### Requirement: Chiffre d'affaires
Le tableau de bord SHALL afficher la somme des paiements aboutis de la période, par
devise, et le nombre de paiements. Sans paiement, il SHALL afficher 0 € et non « — ».

#### Scenario: Octobre 2026
- **WHEN** aucun paiement n'a abouti dans les 30 derniers jours
- **THEN** la carte affiche « 0 € » et « 0 paiement »

### Requirement: Clients payants et conversion
Le tableau de bord SHALL afficher le nombre de comptes ayant payé sur la période et
depuis l'origine, et la part des comptes mesurés ayant payé au moins une fois.

#### Scenario: Deux paiements en mars
- **WHEN** deux paiements ont été enregistrés en mars 2026 et que 139 comptes sont mesurés
- **THEN** le tableau de bord affiche les payants depuis l'origine et leur part sur 139

### Requirement: Parcours d'achat
Le tableau de bord SHALL afficher, sur la période, le nombre de visites ayant ouvert les
packs, de visites ayant lancé un paiement et de paiements aboutis, à un seul endroit.

#### Scenario: Trente derniers jours au 31/10/2026
- **WHEN** 6 visites sur 322 ont ouvert les packs et aucune n'a lancé de paiement
- **THEN** la monétisation affiche « 6 → 0 → 0 », et « Tarifs consultés » n'apparaît dans aucune autre carte

### Requirement: Coût du modèle résumé
Le tableau de bord SHALL afficher le coût IA de la période, rapporté au nombre de comptes
actifs et au nombre de recherches, et un lien vers l'onglet Coûts IA.

#### Scenario: Aucune recherche
- **WHEN** la période ne compte aucune recherche
- **THEN** le coût par recherche affiche « — »

### Requirement: Onglet Coûts IA
L'administration SHALL proposer un onglet « Coûts IA », réservé aux administrateurs,
présentant le relevé par opération et le simulateur, cadrés par la même période que le
tableau de bord.

#### Scenario: Accès par un non-administrateur
- **WHEN** un compte sans rôle administrateur ouvre `/admin/costs`
- **THEN** l'accès est refusé comme pour les autres onglets d'administration

### Requirement: Comparaison à la période précédente
Chaque indicateur de période SHALL s'afficher avec son écart à la période de même durée
qui précède. Sous 5 sur la période précédente, l'écart SHALL être absolu ; un indicateur
en pourcentage SHALL s'écarter en points.

#### Scenario: Petits nombres
- **WHEN** les recherches passent de 2 à 6
- **THEN** l'écart affiché est « +4 », pas « +200 % »

### Requirement: Choix de la période
La période SHALL se choisir parmi 7 jours, 30 jours (par défaut), un mois civil et une
plage personnalisée. Aucune fenêtre de 24 heures ne SHALL être proposée.

#### Scenario: Mois civil
- **WHEN** l'administrateur choisit « septembre 2026 »
- **THEN** les indicateurs couvrent du 01/09/2026 00:00 au 30/09/2026 23:59, heure de Paris, et se comparent à août 2026

### Requirement: Historique mensuel
Le tableau de bord SHALL présenter quatre courbes au mois, sur douze mois, indépendantes
de la période choisie : actifs décomposés, nouveaux inscrits, chiffre d'affaires, coût IA.
Le mois en cours SHALL être signalé incomplet et exclu des moyennes.

#### Scenario: Mois en cours
- **WHEN** le tableau de bord est ouvert le 31/10/2026
- **THEN** la barre d'octobre est estompée et marquée « mois en cours »
