# Spec Delta

## Purpose

Permettre à l'administrateur de revoir ce qu'un visiteur consentant a fait et vu dans
l'application. La capacité couvre la capture masquée, la conservation bornée et la
relecture. Elle complète les logs, qui ne disent que où le visiteur s'est arrêté.

## ADDED Requirements

### Requirement: Consentement dédié à l'enregistrement de session
Le bandeau de cookies SHALL proposer une catégorie « Enregistrement de session »,
distincte de la mesure d'audience et désactivée par défaut. Aucun événement de session
MUST NOT être capté ni envoyé tant que le visiteur ne l'a pas acceptée.

#### Scenario: Visiteur qui refuse
- **WHEN** un visiteur clique « Refuser » sur le bandeau puis décrit un projet de boulangerie et lance une recherche
- **THEN** aucune requête `POST /replay` ne part
- **AND** le code d'enregistrement n'est pas téléchargé

#### Scenario: Visiteur qui accepte tout
- **WHEN** un visiteur clique « Tout accepter » sur la page d'accueil
- **THEN** l'enregistrement démarre sur la page courante, sans rechargement

#### Scenario: Accepter l'audience sans l'enregistrement
- **WHEN** un visiteur accepte « Cookies analytiques » mais laisse « Enregistrement de session » désactivée dans les préférences
- **THEN** GA4 reçoit le consentement
- **AND** aucune session n'est enregistrée

#### Scenario: Page prérendue
- **WHEN** un robot récupère `/guides/...` prérendu
- **THEN** le HTML ne contient ni le code d'enregistrement ni de requête vers `/replay`

### Requirement: Retrait du consentement
Chaque page de l'application SHALL offrir un lien « Gérer les cookies » qui rouvre les
préférences. Le retrait de la catégorie MUST arrêter l'enregistrement en cours, sans
rechargement.

#### Scenario: Retrait en cours de visite
- **WHEN** un visiteur qui avait accepté rouvre « Gérer les cookies » depuis le pied de page et désactive « Enregistrement de session »
- **THEN** plus aucun événement n'est envoyé à partir de cet instant
- **AND** les lots déjà reçus restent soumis à la durée de conservation ordinaire

### Requirement: Mesure du choix de consentement
Chaque choix fait sur le bandeau ou dans les préférences SHALL produire un événement
anonyme `consent_recorded`, qui porte les catégories acceptées et rien d'autre.

#### Scenario: Refus mesuré
- **WHEN** un visiteur clique « Refuser »
- **THEN** le journal contient `consent_recorded` avec `analytics: false` et `replay: false`, rattaché à l'identifiant de visite

#### Scenario: Visiteur qui ignore le bandeau
- **WHEN** un visiteur repart sans toucher au bandeau
- **THEN** aucun `consent_recorded` n'est émis pour sa visite, et le résumé des logs distingue « sans réponse » de « refusé »

### Requirement: Saisies masquées
L'enregistrement MUST remplacer le contenu de tout champ de saisie par un masque de même
longueur, avant tout envoi. Aucune valeur saisie ne quitte le navigateur.

#### Scenario: Description du projet
- **WHEN** un visiteur consentant tape une description de café-librairie de quartier dans le wizard
- **THEN** le lot envoyé contient des `*` à la place du texte, et la frappe reste visible au rejeu

#### Scenario: Adresse de partage
- **WHEN** un utilisateur saisit l'adresse d'un associé dans le dialogue de partage
- **THEN** l'adresse n'apparaît dans aucun lot

### Requirement: Textes personnels masqués
Les textes affichés qui reprennent une saisie de l'utilisateur ou une adresse e-mail MUST
être masqués à l'enregistrement : description reformulée, mots-clés, extrait de
description de la liste des projets, adresses du propriétaire, d'un invité ou du compte.

#### Scenario: Mots-clés en puces
- **WHEN** l'étape 2 affiche les mots-clés « artisanal », « quartier », « livres »
- **THEN** le rejeu montre des puces de même taille au texte masqué

#### Scenario: Noms de domaine proposés
- **WHEN** l'étape 3 affiche les noms générés et leur disponibilité
- **THEN** ces noms restent lisibles au rejeu : ils sont produits par le service et nécessaires à comprendre le parcours

### Requirement: Sessions exclues de l'enregistrement
Les pages sous `/admin` et toute session dont le jeton porte le rôle `admin` MUST NOT être
enregistrées.

#### Scenario: Administrateur connecté
- **WHEN** un administrateur ayant accepté tous les cookies parcourt le wizard
- **THEN** aucune requête `POST /replay` ne part

#### Scenario: Visiteur qui ouvre une URL d'administration
- **WHEN** un visiteur consentant navigue vers `/admin/users`
- **THEN** l'enregistrement est suspendu tant que la route reste sous `/admin`

### Requirement: Erreurs console dans le rejeu
L'enregistrement SHALL inclure les messages console de niveau `error`, bornés en taille,
à leur instant dans la session.

#### Scenario: Erreur pendant une recherche
- **WHEN** une erreur JavaScript survient juste après le clic sur « Rechercher »
- **THEN** le lecteur montre le message à l'instant du clic

### Requirement: Réception bornée des lots
`POST /replay` SHALL accepter les lots d'une visite connue de `visitor_session`. Il MUST
refuser un lot trop gros, une visite qui dépasse son plafond et toute réception au-delà
du plafond global du jour. Un refus MUST NOT faire échouer l'application.

#### Scenario: Identifiant de visite inconnu
- **WHEN** un client envoie un lot pour un identifiant jamais vu par `POST /events`
- **THEN** la réponse est un refus 4xx et rien n'est stocké

#### Scenario: Plafond de session atteint
- **WHEN** une visite a déjà envoyé `REPLAY_MAX_SESSION_MB` mégaoctets
- **THEN** le lot suivant est refusé, `replay_capped` est journalisé une seule fois pour cette visite, et le navigateur arrête d'enregistrer

#### Scenario: Envoi en boucle
- **WHEN** un script envoie des lots valides pour des milliers d'identifiants
- **THEN** la réception s'arrête quand le total du jour atteint `REPLAY_MAX_DAY_MB`, et `replay_capped` le signale

#### Scenario: Retour de Keycloak
- **WHEN** un visiteur part se connecter sur Keycloak puis revient dans le même onglet
- **THEN** l'enregistrement reprend sous le même identifiant de visite, en un segment de plus

### Requirement: Conservation limitée
Les enregistrements SHALL être supprimés au plus tard `REPLAY_RETENTION_DAYS` jours (30 par
défaut) après leur réception.

#### Scenario: Purge quotidienne
- **WHEN** un enregistrement reçu le 01/11/2026 atteint le 02/12/2026
- **THEN** il n'existe plus en base et n'apparaît plus dans la liste

### Requirement: Liste des sessions enregistrées
L'administration SHALL lister les visites enregistrées, des plus récentes aux plus anciennes,
avec date, durée, pages vues, drapeaux d'entonnoir et présence d'une erreur. Les visites
des comptes admin ou internes MUST être écartées, comme dans le reste du tableau de bord.

#### Scenario: Retrouver un abandon
- **WHEN** l'administrateur filtre sur « a cherché, pas de compte créé »
- **THEN** seules ces visites s'affichent, chacune avec un bouton de lecture

#### Scenario: Compte interne
- **WHEN** une visite est rattachée à un compte coché « interne »
- **THEN** elle n'apparaît pas dans la liste

#### Scenario: Accès refusé
- **WHEN** un utilisateur sans rôle `admin` appelle `GET /admin/replays`
- **THEN** la réponse est 403

### Requirement: Relecture d'une session
L'administration SHALL rejouer une visite enregistrée de bout en bout, segments compris, avec
une frise qui situe les erreurs.

#### Scenario: Rejeu complet
- **WHEN** l'administrateur ouvre une visite de 4 minutes passée par la connexion
- **THEN** le lecteur enchaîne les segments avant et après Keycloak, et la frise marque l'instant de chaque erreur console

#### Scenario: Enregistrement purgé entre-temps
- **WHEN** l'administrateur ouvre une visite dont les lots viennent d'être purgés
- **THEN** l'écran indique que l'enregistrement n'existe plus, sans erreur 500

### Requirement: Politique de confidentialité à jour
La politique de confidentialité SHALL décrire GA4 et l'enregistrement de session : finalité,
données masquées, hébergement sur le serveur de Namorama, durée de conservation, et retrait
du consentement par « Gérer les cookies ».

#### Scenario: Lecture de la page Cookies
- **WHEN** un visiteur lit la section Cookies de `/privacy`, en français ou en anglais
- **THEN** elle ne prétend plus qu'aucun traceur tiers n'est utilisé, et elle cite les deux catégories facultatives
