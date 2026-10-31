# Spec Delta

## Purpose

Permettre à l'utilisateur de dire, après avoir vu des noms, ce qu'il attend des suivants, et faire peser ces retours sur les recherches suivantes du projet sans toucher à sa description ni aux noms déjà affichés.

## ADDED Requirements

### Requirement: Zone de retour sous les résultats
L'étape des résultats SHALL proposer, sous la liste, un champ de retour libre et des suggestions en un clic. La zone MUST n'apparaître qu'une fois au moins un résultat affiché, et MUST être masquée pour un invité en lecture seule.

#### Scenario: Zone visible après une recherche
- **WHEN** une recherche a affiché 10 noms dans un projet dont l'utilisateur est propriétaire
- **THEN** la zone de retour s'affiche sous la liste, avec un champ libre et les suggestions « plus courts », « plus francophones », « pas de noms composés », « plus sérieux », « plus ludiques »

#### Scenario: Invité en lecture seule
- **WHEN** un invité en lecture seule ouvre un projet partagé qui a des résultats
- **THEN** la zone de retour n'est pas affichée

#### Scenario: Aucun résultat
- **WHEN** le projet n'a encore aucun nom affiché
- **THEN** la zone de retour n'est pas affichée

### Requirement: Un retour lance les noms suivants
Envoyer un retour SHALL lancer une recherche en ajout aux mêmes conditions que « 10 de plus » : même débit de crédits, mêmes exclusions de noms déjà vérifiés, cartes existantes conservées.

#### Scenario: Retour envoyé
- **WHEN** l'utilisateur écrit « des noms qui sonnent plus francophones » et l'envoie
- **THEN** une recherche en ajout démarre, les 10 cartes affichées restent en place, et les noms déjà vérifiés ne sont pas reproposés

#### Scenario: Crédits insuffisants
- **WHEN** l'utilisateur envoie un retour avec un solde de 0 crédit
- **THEN** la recherche est refusée comme « 10 de plus » l'aurait été, et le retour reste dans le champ, non enregistré

### Requirement: Les retours s'additionnent
Chaque retour envoyé SHALL s'ajouter aux retours actifs du projet. Toutes les recherches suivantes MUST porter l'ensemble des retours actifs. Un projet MUST accepter au plus 10 retours actifs de 200 caractères chacun au plus.

#### Scenario: Deux retours successifs
- **WHEN** l'utilisateur envoie « plus francophone », puis plus tard « pas de noms composés »
- **THEN** la deuxième recherche applique les deux retours

#### Scenario: Limite atteinte
- **WHEN** le projet a déjà 10 retours actifs et l'utilisateur en saisit un onzième
- **THEN** l'envoi est refusé avec un message invitant à retirer un retour, et aucun retour existant n'est supprimé d'office

### Requirement: Le retour le plus récent l'emporte
Quand deux retours actifs se contredisent, le plus récent SHALL prévaloir.

#### Scenario: Longueur contradictoire
- **WHEN** les retours actifs sont, dans l'ordre, « plus longs » puis « plus courts »
- **THEN** les noms suivants sont plus courts que ceux de la recherche précédente

### Requirement: Retours affichés et retirables
Les retours actifs SHALL s'afficher en puces portant le texte de l'utilisateur, chacune retirable. Un retour retiré MUST ne plus s'appliquer aux recherches suivantes.

#### Scenario: Retrait d'un retour
- **WHEN** l'utilisateur retire la puce « pas de noms composés » puis demande 10 noms de plus
- **THEN** la recherche ne porte plus ce retour, et des noms composés peuvent réapparaître

### Requirement: Les cartes affichées ne changent pas
Un retour MUST NOT modifier les cartes déjà affichées : ni masquage, ni nouveau tri, ni nouvelle note.

#### Scenario: Carte contraire au retour
- **WHEN** la liste contient `taskbloom` et que l'utilisateur envoie « pas de noms composés »
- **THEN** `taskbloom` reste affiché à sa place, et seules les nouvelles cartes tiennent compte du retour

### Requirement: La description du projet reste intacte
Un retour MUST NOT modifier la description du projet. Les retours SHALL être enregistrés à part, sur le projet, et restaurés à sa réouverture.

#### Scenario: Réouverture du projet
- **WHEN** l'utilisateur envoie deux retours, ferme le projet puis le rouvre depuis l'historique
- **THEN** la description est celle d'avant les retours, et les deux puces sont affichées et actives

#### Scenario: Projet partagé en écriture
- **WHEN** un collaborateur en écriture ajoute un retour
- **THEN** le retour est enregistré sur le projet et le propriétaire le voit à la réouverture

### Requirement: Contraintes vérifiables appliquées en dur
Ce qu'un retour exprime en longueur, terminaisons, mots à éviter ou à inclure SHALL être appliqué par le même filtre que le cahier des charges du brief. Un mot imposé MUST n'être retenu que s'il figure dans le texte du retour.

#### Scenario: Terminaison écartée par un retour
- **WHEN** l'utilisateur envoie « plus de noms en -ia »
- **THEN** aucun nom suivant ne se termine par « ia », y compris si le modèle en propose

#### Scenario: Mot imposé inventé
- **WHEN** le retour est « plus chaleureux » et que l'interprétation propose un mot imposé « chaleur »
- **THEN** le mot imposé est écarté, car il ne figure pas tel quel dans le retour

### Requirement: Priorité entre réglages, retours et brief
Pour une même contrainte, un réglage explicite de l'étape 2 SHALL primer sur un retour, et un retour SHALL primer sur le brief.

#### Scenario: Retour contre brief
- **WHEN** le brief demande « 8 à 10 lettres », la longueur n'a pas été réglée à l'étape 2, et un retour demande « plus courts, 6 lettres max »
- **THEN** les noms suivants font au plus 6 caractères

#### Scenario: Réglage explicite contre retour
- **WHEN** l'utilisateur a réglé la longueur maximale à 9 à l'étape 2 et qu'un retour demande « 6 lettres max »
- **THEN** le maximum appliqué reste 9

### Requirement: Un retour peut retirer un style de noms
Un retour qui écarte une forme de nom (composés, métaphores, jeux de sonorités) SHALL retirer cette forme du mélange demandé au modèle, au lieu de la contredire. Un retour qui demande une langue ou une sonorité SHALL orienter la génération vers elle.

#### Scenario: Pas de noms composés
- **WHEN** l'utilisateur envoie « je n'aime pas les noms composés »
- **THEN** la consigne de génération ne demande plus de noms faits de deux racines collées, et ce quota est réparti sur les autres formes

#### Scenario: Plus francophone
- **WHEN** l'utilisateur envoie « des noms qui sonnent plus francophone », sur un navigateur réglé en anglais
- **THEN** la consigne de génération demande des noms faciles à prononcer pour un francophone

### Requirement: Préférence de goût transmise au modèle
Ce qu'un retour exprime sans être vérifiable ni réglable (ton, image, sensation) SHALL être transmis au modèle comme préférence de l'utilisateur, avec la consigne que le plus récent l'emporte.

#### Scenario: Ton demandé
- **WHEN** l'utilisateur envoie « plus sérieux, moins startup »
- **THEN** la consigne de génération porte cette préférence

### Requirement: Retours mesurés sans leur texte
Chaque recherche SHALL journaliser le nombre de retours actifs et le décompte de ce qui en a été compris (contraintes, formes retirées, langue, préférence). Chaque retour envoyé SHALL émettre `name_feedback_added` avec son origine. Le texte d'un retour MUST NOT être journalisé.

#### Scenario: Recherche avec retours
- **WHEN** une recherche porte les retours « plus francophone » et « pas de noms composés »
- **THEN** `search_completed` porte `retours: 2` et des décomptes, et ne contient aucun des deux textes

#### Scenario: Suggestion cliquée
- **WHEN** l'utilisateur clique la suggestion « plus courts »
- **THEN** `name_feedback_added` est émis avec `origine: suggestion`
