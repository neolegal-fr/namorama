# Spec Delta

## Purpose

Garantir que l'écran de cadrage, juste avant une recherche payante, dise en une lecture ce qui va être cherché, distingue l'essentiel du facultatif, et annonce le coût avant que l'utilisateur ne le paie.

## ADDED Requirements

### Requirement: Un seul nom pour l'étape
L'étape 2 du wizard MUST porter le même nom, « Cadrage » (« Framing » en anglais), dans l'indicateur d'étapes et dans son titre.

#### Scenario: Arrivée à l'étape 2
- **WHEN** l'utilisateur passe de la description au cadrage
- **THEN** l'indicateur d'étapes et le titre de l'écran disent tous deux « Cadrage »
- **AND** l'écran n'emploie plus « Vos préférences »

### Requirement: Résumé de la recherche en tête d'écran
L'écran MUST commencer par une phrase qui dit ce qui sera cherché : style de nom, longueur, contraintes reprises de la description, extensions et critère de disponibilité. La phrase SHALL se recalculer à chaque changement de réglage, sans action de l'utilisateur.

#### Scenario: Brief contraint, réglages intacts
- **WHEN** la description demande d'éviter « bank » et l'utilisateur garde .com et .fr, au moins une libre
- **THEN** la phrase dit « Des noms inventés de 10 caractères au plus, sans « bank », libres en .com ou .fr »

#### Scenario: Réglage modifié
- **WHEN** l'utilisateur passe le critère à « toutes les extensions »
- **THEN** la phrase dit « libres en .com et .fr » sans rechargement ni clic supplémentaire

#### Scenario: Aucune contrainte
- **WHEN** la description ne contient aucune consigne sur le nom
- **THEN** la phrase ne mentionne que le style, la longueur et les extensions, sans fragment vide

### Requirement: Réglages essentiels ouverts, réglages facultatifs repliés
L'écran MUST présenter, ouverts et dans cet ordre, un bloc « Le nom » (style, longueur, contraintes du brief) puis un bloc « Les domaines » (extensions, critère). Les mots-clés, le public et les inspirations SHALL être regroupés dans un bloc « Affiner », marqué facultatif et replié à l'arrivée sur l'écran.

#### Scenario: Première arrivée sur l'écran
- **WHEN** l'utilisateur arrive à l'étape 2 depuis la description
- **THEN** les blocs « Le nom » et « Les domaines » sont ouverts
- **AND** le bloc « Affiner » est replié

#### Scenario: Retour depuis les résultats
- **WHEN** l'utilisateur a ouvert « Affiner », lancé une recherche, puis revient à l'étape 2
- **THEN** le bloc « Affiner » est toujours ouvert

### Requirement: Contenu du bloc replié résumé
Replié, le bloc « Affiner » MUST résumer ce qu'il contient : les mots-clés retenus (les premiers, puis le nombre restant), le public et les inspirations saisies, ou « Aucune ».

#### Scenario: Mots-clés nombreux
- **WHEN** le bloc est replié et que le projet a 6 mots-clés : argent de poche, épargne, ados, parents, appli, budget
- **THEN** le résumé affiche les premiers mots-clés et « +N » pour les autres, sur une ligne
- **AND** il affiche « International » pour le public et « Aucune » pour les inspirations

### Requirement: Rôle des mots-clés expliqué
Le champ des mots-clés MUST dire qu'ils orientent les propositions sans devoir figurer dans les noms. Le compteur de mots-clés SHALL n'apparaître qu'à partir de 40 mots-clés sur 50.

#### Scenario: Projet ordinaire
- **WHEN** le projet a 6 mots-clés
- **THEN** aucun compteur « 6 / 50 » n'est affiché
- **AND** une phrase explique le rôle des mots-clés

#### Scenario: Approche de la limite
- **WHEN** le projet a 42 mots-clés
- **THEN** le compteur « 42 / 50 » s'affiche

### Requirement: Libellés de style qui disent le cumul
Le choix du style MUST présenter « Inventés », « Inventés + descriptifs » et « Inventés + culturels », un seul sélectionnable à la fois, sans libellé qui commence par « + ».

#### Scenario: Choix des noms descriptifs
- **WHEN** l'utilisateur sélectionne « Inventés + descriptifs »
- **THEN** « Inventés » seul n'est plus sélectionné
- **AND** la recherche peut rendre des noms inventés et des noms descriptifs

### Requirement: Repérage du marché en action secondaire
Le repérage des concurrents MUST rester déclenché par un clic, jamais par l'affichage de l'écran. Il SHALL être proposé dans le bloc « Affiner », sous les inspirations, en action secondaire qui annonce sa durée (« environ 15 s »).

#### Scenario: Écran affiché sans clic
- **WHEN** l'utilisateur arrive à l'étape 2 et lance la recherche sans ouvrir « Affiner »
- **THEN** aucun appel de repérage du marché n'est fait

#### Scenario: Repérage demandé
- **WHEN** l'utilisateur ouvre « Affiner » et clique sur le repérage
- **THEN** la liste des concurrents s'affiche dans le bloc, notable pouce levé ou baissé comme aujourd'hui

### Requirement: Coût et solde affichés près du bouton de recherche
L'action « Lancer la recherche » MUST rester visible en bas de l'écran pendant le défilement. Elle SHALL afficher, sous le bouton, le coût par nom retenu et le plafond de la recherche. Pour un compte connecté, elle SHALL aussi afficher son solde de crédits.

#### Scenario: Compte connecté
- **WHEN** un compte connecté avec 100 crédits arrive à l'étape 2
- **THEN** la barre d'action affiche « 1 crédit par nom retenu, 10 au maximum · solde 100 crédits »

#### Scenario: Visiteur sans compte
- **WHEN** un visiteur non connecté arrive à l'étape 2
- **THEN** la barre d'action affiche le coût par nom retenu, sans solde

#### Scenario: Écran long sur mobile
- **WHEN** l'utilisateur ouvre « Affiner » sur un écran de 390 px de large et fait défiler
- **THEN** le bouton « Lancer la recherche » reste visible en bas de l'écran

#### Scenario: Noms déjà trouvés
- **WHEN** le projet a déjà des résultats
- **THEN** le bouton devient « Voir les résultats », sans mention de coût

### Requirement: Bouton de recherche désactivé qui dit pourquoi
Quand la recherche ne peut pas être lancée, la barre d'action MUST afficher la raison à la place du coût.

#### Scenario: Aucun mot-clé
- **WHEN** l'utilisateur retire tous les mots-clés
- **THEN** le bouton « Lancer la recherche » est désactivé
- **AND** la barre d'action dit qu'il faut au moins un mot-clé, dans le bloc « Affiner »

### Requirement: Ouverture du bloc facultatif mesurée
L'ouverture du bloc « Affiner » par l'utilisateur MUST émettre l'événement `wizard_refine_opened`, au plus une fois par projet et par session, sans contenu de la description ni des mots-clés.

#### Scenario: Ouverture puis fermeture répétées
- **WHEN** l'utilisateur ouvre, ferme puis rouvre « Affiner » sur le même projet
- **THEN** un seul événement `wizard_refine_opened` est émis

#### Scenario: Ouverture rétablie au retour
- **WHEN** le bloc est rouvert d'office au retour depuis les résultats
- **THEN** aucun événement n'est émis
