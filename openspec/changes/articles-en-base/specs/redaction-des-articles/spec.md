# Spec Delta — redaction-des-articles

## Purpose

Permettre d'écrire, corriger, publier, dépublier et restaurer un article du blog sans
déploiement ni passage par le dépôt : à la main depuis l'administration, ou par Claude
au moyen d'un jeton d'API de rédaction.

## ADDED Requirements

### Requirement: Rédaction réservée aux administrateurs
L'écran de rédaction et ses routes SHALL n'être accessibles qu'à un compte portant le rôle
`admin`, ou à un jeton d'API de rédaction valide pour les seules routes des articles. Toute
autre requête SHALL être refusée (401 sans authentification, 403 sans le droit).

#### Scenario: Compte ordinaire
- **WHEN** un compte connecté sans le rôle `admin` demande la liste des articles à rédiger
- **THEN** la réponse est 403 et aucun brouillon n'est renvoyé

#### Scenario: Jeton hors de sa portée
- **WHEN** un jeton de rédaction valide est présenté sur une route du tableau de bord
  d'administration
- **THEN** la réponse est 401

### Requirement: Échange au format Markdown à en-tête
Un article SHALL pouvoir être lu et envoyé sous la forme d'un unique texte Markdown dont
l'en-tête porte `path`, `title`, `description`, `titre`, `extrait`, `categorie`, `publie`
et `misAJour` — le format des fichiers d'avant la migration. Lire puis renvoyer ce texte
sans le modifier SHALL laisser l'article inchangé.

#### Scenario: Aller-retour sans modification
- **WHEN** l'article `/guides/trouver-nom-de-produit` est lu au format Markdown puis
  renvoyé tel quel
- **THEN** aucune révision n'est créée et la page servie est identique

### Requirement: Enregistrement qui refuse un article invalide
L'enregistrement SHALL être refusé, sans rien modifier, avec la liste des causes, quand
l'article a un en-tête incomplet ou un champ inconnu, une catégorie inconnue, une date non
ISO, une mise à jour antérieure à la publication, un chemin déjà pris, un bloc ou un
attribut inconnu, du HTML brut, ou un lien interne vers une adresse que le site ne sert
pas.

#### Scenario: Catégorie mal orthographiée
- **WHEN** un article est envoyé avec `categorie: Secteur`
- **THEN** l'enregistrement est refusé et la cause liste les catégories admises

#### Scenario: Lien interne cassé
- **WHEN** un article contient `[le guide](/guides/trouver-un-nom-de-marque)` alors que
  le site sert `/guides/trouver-nom-de-marque`
- **THEN** l'enregistrement est refusé en citant l'adresse inconnue

#### Scenario: HTML brut
- **WHEN** le corps contient `<div class="encart">`
- **THEN** l'enregistrement est refusé et la cause désigne la ligne fautive

### Requirement: Vérification sans enregistrement
Un article SHALL pouvoir être vérifié sans être enregistré : la vérification SHALL
renvoyer soit les causes de refus, soit le rendu qu'aurait la page (segments et temps de
lecture), sans créer de révision ni modifier le site.

#### Scenario: Claude vérifie un nouvel article
- **WHEN** un jeton de rédaction soumet à la vérification un article valide de 1 300 mots
- **THEN** la réponse donne le rendu et « 6 min de lecture », et l'article n'existe pas
  en base

### Requirement: Lien vers un article non paru
Un article publié SHALL NOT pouvoir renvoyer à un article qui ne sera pas paru le jour où
il est servi — sa date de publication, ou aujourd'hui s'il a déjà paru : brouillon, ou
article publié à une date postérieure.

#### Scenario: Guide ancien mis à jour
- **WHEN** `/guides/trouver-nom-de-marque`, publié le 10/06/2026, est mis à jour le
  03/09/2026 pour citer `/generateur-nom-de-marque`, publié le 03/09/2026
- **THEN** la publication est acceptée

#### Scenario: Article programmé qui cite le suivant
- **WHEN** l'article publié le 30/11/2026 renvoie à `/blog/shortlist-de-noms-verifiee`,
  publiée le 07/12/2026
- **THEN** la publication est refusée en citant le lien et la date de parution de sa cible

#### Scenario: Lien dans un brouillon
- **WHEN** un brouillon renvoie à un autre brouillon
- **THEN** l'enregistrement est accepté ; c'est la publication qui vérifie le lien

### Requirement: Nouvel article en brouillon
Un article créé SHALL être à l'état brouillon tant qu'il n'est pas explicitement publié,
que la création vienne de l'écran ou d'un jeton.

#### Scenario: Claude envoie un nouvel article
- **WHEN** un jeton de rédaction envoie un article `/blog/nom-de-restaurant` sans demander
  sa publication
- **THEN** l'article est enregistré en brouillon et `/blog/nom-de-restaurant` répond 404

### Requirement: Publication et dépublication
Un administrateur ou un jeton SHALL pouvoir publier un brouillon valide et repasser un
article publié en brouillon. La dépublication SHALL être refusée tant qu'un article paru
renvoie vers l'article visé, en citant les articles qui le citent.

#### Scenario: Publication immédiate
- **WHEN** un administrateur publie un brouillon daté du jour
- **THEN** l'article est servi à la visite suivante

#### Scenario: Dépublication d'un article cité
- **WHEN** un administrateur dépublie `/recherche-anteriorite-marque-inpi`, cité par
  `/guides/trouver-nom-de-marque`
- **THEN** la dépublication est refusée et le motif nomme `/guides/trouver-nom-de-marque`

### Requirement: Suppression réservée aux brouillons jamais parus
Un article SHALL pouvoir être supprimé seulement s'il n'a jamais été servi publiquement.
Un article déjà paru SHALL seulement pouvoir être dépublié.

#### Scenario: Article déjà paru
- **WHEN** un administrateur tente de supprimer `/namorama-vs-namelix`
- **THEN** la suppression est refusée, et l'écran propose la dépublication

### Requirement: Aperçu dans la mise en page du blog
L'écran de rédaction SHALL afficher, à côté du Markdown, l'aperçu de l'article rendu par
les mêmes composants que la page publique — en-tête, blocs `cta` et `trois-risques`
compris — ou les causes de refus quand le texte est invalide.

#### Scenario: Bloc d'appel à l'action
- **WHEN** l'administrateur ajoute `::: cta label="Tester un nom"` entre deux sections
- **THEN** l'aperçu affiche le bouton « Tester un nom » entre ces deux sections

#### Scenario: Erreur de saisie
- **WHEN** l'administrateur tape un lien vers une adresse inconnue
- **THEN** l'aperçu laisse place à la cause du refus, et l'enregistrement est désactivé

### Requirement: Historique des révisions
Chaque enregistrement qui modifie un article SHALL conserver une révision : texte
Markdown complet, auteur (compte ou jeton) et date. Une révision antérieure SHALL pouvoir
être restaurée, ce qui crée une nouvelle révision sans effacer les suivantes.

#### Scenario: Correction annulée
- **WHEN** un administrateur restaure la révision 3 d'un article qui en compte 5
- **THEN** l'article reprend le texte de la révision 3 et l'historique en compte 6

#### Scenario: Auteur d'une modification
- **WHEN** Claude modifie un article avec le jeton nommé « Claude Code — poste »
- **THEN** la révision créée porte ce nom de jeton comme auteur

### Requirement: Enregistrement concurrent refusé
Un enregistrement SHALL porter la révision sur laquelle il a été écrit, et SHALL être
refusé (409) si l'article a changé depuis, sans rien écraser, en indiquant la révision
courante et son auteur.

#### Scenario: Claude et l'éditeur en même temps
- **WHEN** l'administrateur ouvre la révision 4, Claude enregistre la révision 5, puis
  l'administrateur enregistre sa version
- **THEN** l'enregistrement de l'administrateur est refusé, son texte reste dans
  l'éditeur, et le message nomme la révision 5 et son auteur

### Requirement: Jeton d'API de rédaction
Un administrateur SHALL pouvoir créer un jeton nommé, dont la valeur n'est affichée
qu'une fois. Le jeton SHALL n'être conservé que sous forme hachée, SHALL pouvoir être
révoqué avec effet immédiat, et SHALL afficher sa date de création et sa dernière
utilisation.

#### Scenario: Création
- **WHEN** un administrateur crée le jeton « Claude Code — poste »
- **THEN** sa valeur s'affiche une seule fois, et la liste n'en montre ensuite que le
  préfixe

#### Scenario: Révocation
- **WHEN** un administrateur révoque ce jeton, puis Claude l'emploie pour enregistrer
  un article
- **THEN** la requête est refusée en 401 et rien n'est enregistré

#### Scenario: Valeur lue en base
- **WHEN** la table des jetons est lue
- **THEN** aucune valeur de jeton n'y figure en clair

### Requirement: Publication par Claude depuis le poste
Le dépôt SHALL fournir des commandes qui, avec un jeton lu dans l'environnement du poste,
lisent un article au format Markdown, le vérifient, l'enregistrent et le publient. Une
commande SHALL échouer, avec la cause renvoyée par l'API, sans rien enregistrer quand
l'article est invalide.

#### Scenario: Envoi d'un article invalide
- **WHEN** Claude lance la commande d'envoi sur un fichier dont un lien interne est cassé
- **THEN** la commande sort en erreur en affichant l'adresse inconnue, et l'article en
  base est inchangé

#### Scenario: Jeton absent
- **WHEN** la commande est lancée sans jeton dans l'environnement
- **THEN** elle échoue en nommant la variable attendue, sans appeler l'API

### Requirement: Modifications journalisées sans le texte
Chaque enregistrement, publication, dépublication, restauration, suppression, création ou
révocation de jeton SHALL émettre un événement portant le chemin de l'article, l'auteur
(identifiant de compte ou de jeton) et le numéro de révision, et SHALL NOT porter le texte
de l'article ni la valeur d'un jeton.

#### Scenario: Publication par jeton
- **WHEN** Claude publie `/blog/nom-de-restaurant`
- **THEN** un événement `article_published` est journalisé avec le chemin, l'identifiant
  du jeton et le numéro de révision, sans le corps de l'article
