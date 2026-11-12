# Spec Delta

## Purpose
Qu'un lien vers un projet mène toujours quelque part : au projet, à la connexion, ou à
un message qui dit pourquoi le projet ne s'ouvre pas.

## ADDED Requirements

### Requirement: Connexion avant un projet
Un visiteur sans session qui ouvre `/projects/:id` SHALL être envoyé vers la connexion,
avec retour sur la même adresse, sans que le projet soit demandé à l'API.

#### Scenario: Adresse copiée, visiteur déconnecté
- **WHEN** un visiteur sans session ouvre `/projects/03c3d48d-cad6-4690-989f-499d0973e110`
- **THEN** il arrive sur l'écran de connexion
- **AND** aucun `GET /projects/03c3d48d-…` n'est envoyé
- **AND** une fois connecté, il revient sur `/projects/03c3d48d-…`

#### Scenario: Lien d'invitation
- **WHEN** un visiteur sans session ouvre `/projects/:id?invite=invite@example.com&nouveau=1`
- **THEN** il arrive sur l'écran d'inscription, adresse pré-remplie, comme aujourd'hui

### Requirement: Projet introuvable dit comme tel
Un utilisateur connecté à qui l'API répond 404 pour le projet de l'URL SHALL voir un
message qui dit que le projet est introuvable ou ne lui est pas partagé, puis être
ramené sur `/app`.

#### Scenario: Projet d'un autre compte
- **WHEN** un utilisateur connecté ouvre `/projects/:id` d'un projet qui ne lui est pas partagé
- **THEN** il lit « Ce projet est introuvable, ou il ne vous a pas été partagé. »
- **AND** il se retrouve sur `/app`, prêt à lancer une recherche

### Requirement: Échec du chargement dit comme tel
Un utilisateur connecté dont le chargement du projet échoue pour une autre raison SHALL
voir un message qui l'invite à réessayer, et rester sur l'adresse du projet.

#### Scenario: API indisponible
- **WHEN** l'API ne répond pas au chargement de `/projects/:id`
- **THEN** il lit « Impossible d'ouvrir ce projet pour le moment. Réessayez dans un instant. »
- **AND** l'adresse reste `/projects/:id`
