# Spec Delta

## Purpose
Savoir d'où vient chaque visite (page d'arrivée, paramètres de campagne, site référent) et
la ranger dans un canal, sans rien conserver qui identifie une personne, pour que le
tableau de bord rapporte inscriptions et recherches à leur origine.

## ADDED Requirements

### Requirement: Origine fixée à la première page
Une visite SHALL retenir l'origine de sa première page affichée, et une page affichée
ensuite dans la même visite SHALL NOT la modifier.

#### Scenario: Retour de la page de connexion
- **WHEN** une visite arrive sur `/generateur-nom-de-marque?utm_source=chatgpt.com`, puis revient sur `/app` après la page de connexion
- **THEN** sa page d'arrivée reste `/generateur-nom-de-marque` et sa source `chatgpt.com`

#### Scenario: Visite créée par une étape, sans affichage enregistré
- **WHEN** l'affichage d'une page n'a pas été reçu (balise bloquée) et que la visite naît d'une recherche
- **THEN** la visite existe sans page d'arrivée ni source, et compte comme « direct ou inconnu »

### Requirement: Page d'arrivée sans paramètres
La page d'arrivée SHALL être le chemin de la première page, sans paramètres ni fragment,
dont tout segment ayant la forme d'un identifiant est remplacé par `:id`.

#### Scenario: Lien vers un rapport
- **WHEN** la première page est `/app?rapport=filmoryx`
- **THEN** la page d'arrivée enregistrée est `/app`

#### Scenario: Projet ouvert directement
- **WHEN** la première page est `/projects/03c3d48d-cad6-4690-989f-499d0973e110`
- **THEN** la page d'arrivée enregistrée est `/projects/:id`

### Requirement: Paramètres de campagne bornés
Les paramètres `utm_source`, `utm_medium` et `utm_campaign` SHALL être enregistrés en
minuscules, sans espaces en bordure, tronqués à 60 caractères. Une valeur contenant un
caractère hors des lettres, chiffres, `.`, `_`, `-` et `+` SHALL être ignorée.

#### Scenario: Source d'un assistant
- **WHEN** l'adresse d'arrivée porte `utm_source=ChatGPT.com`
- **THEN** la source enregistrée est `chatgpt.com`

#### Scenario: Valeur suspecte
- **WHEN** l'adresse d'arrivée porte `utm_campaign=<script>`
- **THEN** aucune campagne n'est enregistrée, et la visite l'est quand même

### Requirement: Référent réduit à son domaine
Le site référent SHALL être enregistré sous la forme de son seul nom de domaine, en
minuscules, sans `www.`, sans chemin ni paramètre. Un référent appartenant au produit
lui-même, à son domaine d'authentification compris, SHALL NOT être enregistré.

#### Scenario: Arrivée depuis un moteur
- **WHEN** le référent est `https://www.google.fr/`
- **THEN** le référent enregistré est `google.fr`

#### Scenario: Navigation interne
- **WHEN** le référent est une page de `namorama.com`
- **THEN** aucun référent n'est enregistré

### Requirement: Classement en canaux
Chaque visite SHALL se ranger dans exactement un canal parmi « ChatGPT et assistants IA »,
« Moteurs de recherche », « Réseaux sociaux », « Autres sites » et « Direct ou inconnu ».
La source de campagne SHALL primer sur le référent. Le classement SHALL se faire à la
lecture, de sorte qu'une règle révisée s'applique aussi aux visites déjà enregistrées.

#### Scenario: Lien partagé par ChatGPT
- **WHEN** une visite porte la source `chatgpt.com` et aucun référent
- **THEN** elle compte dans « ChatGPT et assistants IA »

#### Scenario: Source de campagne et référent en désaccord
- **WHEN** une visite porte la source `chatgpt.com` et le référent `google.com`
- **THEN** elle compte dans « ChatGPT et assistants IA »

#### Scenario: Référent inconnu du classement
- **WHEN** une visite n'a pas de source et porte le référent `forum-entrepreneurs.fr`
- **THEN** elle compte dans « Autres sites »

#### Scenario: Ni source ni référent
- **WHEN** une visite n'a ni source ni référent
- **THEN** elle compte dans « Direct ou inconnu »

### Requirement: Aucune donnée identifiante
L'origine d'une visite SHALL NOT contenir d'adresse complète de référent, de paramètre
autre que les trois paramètres de campagne, ni de cookie ou d'identifiant persistant.

#### Scenario: Référent porteur d'un paramètre personnel
- **WHEN** le référent est `https://mail.example.com/inbox?user=jean.dupont`
- **THEN** seul `mail.example.com` est enregistré
