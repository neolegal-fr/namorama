# Spec Delta

## Purpose

Demander un retour à chaque nouvel inscrit au moment où il se souvient encore de sa visite, en commençant par une question en un clic récompensée, puis en proposant un retour détaillé, sans travail quotidien pour l'administrateur.

## ADDED Requirements

### Requirement: Envoi automatique 24 h après l'inscription
Le système SHALL envoyer une demande de retour à chaque compte éligible dès que 24 heures se sont écoulées depuis sa création, au plus une fois par compte. L'envoi MUST se faire sans action de l'administrateur.

#### Scenario: Inscrit de la veille
- **WHEN** un compte créé hier à 10 h 00 est éligible et qu'il est 10 h 30 aujourd'hui
- **THEN** la demande de retour lui a été envoyée, et elle ne lui sera plus jamais envoyée automatiquement

#### Scenario: Compte de moins de 24 heures
- **WHEN** un compte a été créé il y a 20 heures
- **THEN** aucune demande ne lui est encore envoyée

#### Scenario: Envoi en échec
- **WHEN** le serveur de courriel refuse l'envoi
- **THEN** l'échec est journalisé, la tentative est notée comme non délivrée, et le compte n'est pas resollicité en boucle

### Requirement: Comptes éligibles
Un compte SHALL être éligible seulement s'il a une adresse, n'est ni administrateur ni interne, a été créé après la date de mise en service, n'a jamais reçu de demande délivrée (automatique ou manuelle), n'a pas déjà envoyé un feedback, et n'est pas désinscrit.

#### Scenario: Compte interne
- **WHEN** un compte marqué interne a été créé il y a 25 heures
- **THEN** aucune demande ne lui est envoyée

#### Scenario: Déjà contacté à la main
- **WHEN** l'administrateur a écrit à un nouveau compte dans ses premières heures
- **THEN** la demande automatique ne part pas

#### Scenario: Compte antérieur à la mise en service
- **WHEN** un compte a été créé une semaine avant la mise en service
- **THEN** il ne reçoit aucune demande automatique, et reste traitable à la main

#### Scenario: Retour déjà donné
- **WHEN** un compte a envoyé un feedback par le formulaire dans ses premières heures
- **THEN** la demande automatique ne part pas

### Requirement: Contenu en deux temps
La demande SHALL poser d'abord la question « Namorama vous a-t-il été utile ? » avec deux liens, Oui et Non, en annonçant 100 crédits pour un clic. Elle SHALL ensuite proposer un retour détaillé (ce qui a plu, ce qui a bloqué, ce qui mérite d'être amélioré), par réponse au courriel ou par le formulaire, en annonçant 500 crédits.

#### Scenario: Courriel automatique en français
- **WHEN** la demande automatique part à un compte francophone
- **THEN** elle contient, dans l'ordre, la question d'utilité avec les liens Oui et Non et la mention des 100 crédits, puis la demande détaillée avec le lien du formulaire et la mention des 500 crédits, puis la signature et le lien de désinscription

#### Scenario: Courriel manuel
- **WHEN** l'administrateur fait rédiger une demande pour un compte ancien
- **THEN** le brouillon suit la même structure en deux temps, avec en plus sa phrase personnalisée, et reste relu avant envoi

### Requirement: Aucune phrase générée sans relecture
Le courriel automatique MUST NOT contenir de texte produit par le modèle. Il SHALL être composé d'un gabarit fixe, traduit, et signé d'un signataire configuré.

#### Scenario: Envoi automatique
- **WHEN** la demande automatique est composée
- **THEN** aucun appel au modèle n'est fait, et la signature est celle du signataire configuré

### Requirement: Langue de la demande
La demande SHALL être rédigée dans la langue du compte, ou à défaut dans la langue du navigateur au moment de l'inscription si elle fait partie des langues traduites, ou à défaut en français.

#### Scenario: Langue captée à l'inscription
- **WHEN** un compte sans langue Keycloak s'est inscrit depuis un navigateur réglé en allemand
- **THEN** la demande lui est envoyée en allemand

#### Scenario: Langue inconnue
- **WHEN** ni le compte ni l'inscription ne disent rien de la langue
- **THEN** la demande est envoyée en français

### Requirement: Réponse oui ou non en un clic
Un clic sur Oui ou Non SHALL enregistrer la réponse du compte et lui accorder 100 crédits, sans connexion. Les deux réponses MUST rapporter les mêmes crédits. Un compte MUST n'être récompensé qu'une fois, quel que soit le nombre de clics.

#### Scenario: Premier clic sur Non
- **WHEN** l'utilisateur clique Non dans sa demande
- **THEN** la réponse « non » est enregistrée, son solde augmente de 100 crédits, et la page affichée le confirme

#### Scenario: Second clic
- **WHEN** l'utilisateur clique Oui après avoir déjà répondu Non
- **THEN** la première réponse reste enregistrée, aucun crédit n'est ajouté, et la page dit que la réponse était déjà notée

#### Scenario: Lien falsifié
- **WHEN** un lien de réponse porte une signature invalide ou un compte modifié
- **THEN** rien n'est enregistré ni crédité, et la page indique que le lien n'est pas valide

### Requirement: Un clic de robot ne vaut pas réponse
L'ouverture du lien par un analyseur de courriel (prévisualisation, antivirus) MUST NOT suffire à enregistrer une réponse. L'enregistrement SHALL demander l'exécution de la page de réponse dans un navigateur.

#### Scenario: Analyseur qui suit les liens
- **WHEN** un service de messagerie récupère l'adresse du lien Oui sans exécuter la page
- **THEN** aucune réponse n'est enregistrée et aucun crédit n'est accordé

### Requirement: La page qui suit invite au retour détaillé
Après la réponse, la page SHALL proposer le retour détaillé récompensé de 500 crédits. Après un Non, elle SHALL demander ce qui a manqué.

#### Scenario: Après un Oui
- **WHEN** l'utilisateur vient de répondre Oui
- **THEN** la page confirme les 100 crédits, et propose de dire ce qui lui a plu ou ce qui pourrait être amélioré, contre 500 crédits

#### Scenario: Après un Non
- **WHEN** l'utilisateur vient de répondre Non
- **THEN** la page confirme les 100 crédits et demande ce qui l'a bloqué ou ce qui lui a manqué, contre 500 crédits

### Requirement: Désinscription en un clic
Toute demande automatique SHALL porter un lien de désinscription, actif sans connexion, et l'en-tête de désinscription en un clic. Un compte désinscrit MUST NOT recevoir de nouvelle demande de retour, automatique ou manuelle.

#### Scenario: Désinscription depuis le courriel
- **WHEN** l'utilisateur clique le lien de désinscription
- **THEN** son compte est marqué désinscrit, et la page le confirme

#### Scenario: Tentative d'envoi manuel à un désinscrit
- **WHEN** l'administrateur ouvre la demande de retour d'un compte désinscrit
- **THEN** l'interface l'indique et l'envoi est refusé

### Requirement: L'administrateur voit où en est chaque compte
Le tableau des utilisateurs SHALL indiquer, pour chaque compte, si la demande automatique est partie, la réponse oui / non éventuelle, et la désinscription.

#### Scenario: Compte qui a répondu
- **WHEN** un compte a reçu la demande automatique et répondu Oui
- **THEN** sa ligne affiche la demande envoyée et la réponse « oui »

### Requirement: Mesure sans donnée personnelle
Chaque envoi automatique SHALL émettre `feedback_request_sent`, chaque réponse `feedback_utility_answered` avec `reponse`, et chaque désinscription `feedback_unsubscribed`. Ces événements MUST NOT contenir d'adresse ni de texte saisi.

#### Scenario: Réponse enregistrée
- **WHEN** un compte répond Oui
- **THEN** `feedback_utility_answered` est journalisé avec `reponse: oui` et le `sub` du compte, sans adresse
