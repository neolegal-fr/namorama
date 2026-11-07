# Design

## Context

Le pourquoi est dans proposal.md, et les exigences dans `specs/langue-de-la-page/spec.md`.

- **Un gabarit, deux usages.** `web/src/index.html` sert de gabarit aux pages prérendues
  et à la coquille cliente `index.csr.html`. nginx sert cette coquille pour toute route
  qui n'a pas de fichier (`web/nginx.conf:99`).
- **Ce qui distingue les deux à la lecture du HTML.** Une page prérendue porte
  `<app-root … ng-server-context="ssg">`, et son `<html lang>` a été posé au rendu par
  `applySeo()`. La coquille porte un `<app-root>` nu, avec le `lang="fr"` du gabarit.
- **La langue de l'application** est fixée dans l'initialiseur de `app.config.ts`,
  **après** l'initialisation de Keycloak (étapes 1 et 2), puis posée sur `<html>` dans
  `App.ngOnInit` (`app.ts:594`).
- **Un précédent existe** : `index.html` porte déjà un script en ligne, celui du thème,
  exécuté avant l'affichage pour éviter un éclair de thème clair.

## Goals / Non-Goals

**Goals:**
- La coquille porte la bonne langue avant le premier rendu, et donc avant la décision de
  traduire.
- Aucune page prérendue ne change, à l'octet près, hormis le script ajouté.

**Non-Goals:**
- Changer l'ordre de démarrage de l'application, par exemple en chargeant le dictionnaire
  avant Keycloak : ce serait plus risqué, pour un gain nul sur ce défaut.

## Decisions

### D1. Un script en ligne placé juste après `<app-root>`, qui ne fait rien sur une page prérendue

Le script se place à la fin du `<body>`, après `<app-root>`. Il s'exécute pendant
l'analyse du document, avant les modules de l'application, qui sont différés. Si
`app-root` porte `ng-server-context`, la page est prérendue et le script s'arrête.
Sinon, il calcule la langue et pose `document.documentElement.lang`.

- *Rejeté : le placer dans `<head>`, comme le script du thème.* À cet endroit,
  `<app-root>` n'est pas encore analysé : le script ne saurait pas si la page est
  prérendue, et il remplacerait le `fr` de la landing par `en` pour un navigateur
  anglais.
- *Rejeté : retirer `lang` du gabarit et compter sur `applySeo()`.* Une page prérendue
  qui oublierait d'appeler `applySeo()` perdrait alors sa langue sans que rien ne le
  signale, et le script lui en donnerait une fausse.
- *Rejeté : réordonner l'initialiseur pour poser la langue avant Keycloak.* La langue
  serait posée plus tôt, mais toujours après le téléchargement du bundle et des
  dictionnaires, donc après le chargement de la page : le défaut resterait.

### D2. Deux exemplaires de la règle, comparés par un test

`langueInitiale(chemin, langueNavigateur)` est exportée par `app.config.ts`, et
l'initialiseur l'utilise à la place de son calcul en ligne. Le comportement est
inchangé. Le script en ligne reproduit cette règle en ES5.

`langue-initiale.spec.ts` lit `index.html`, extrait le script, puis l'exécute dans un
document simulé, pour chaque couple (chemin, langue du navigateur) des scénarios. Il
compare ensuite l'attribut posé au résultat de `langueInitiale`.

- *Rejeté : un script externe, servi comme fichier.* Il ajouterait une requête bloquante
  au rendu, et le chemin dépendrait du hachage de compilation.

## Risks / Trade-offs

- **La règle évolue d'un côté seulement.** → Le test de D2 échoue.
- **Le traducteur peut décider sur autre chose que `lang`.** Chrome analyse aussi le
  texte. Aucun outil de test ne simule ce traducteur. → On vérifie ce qui est mesurable
  (`lang` à la fin du chargement), puis on relit les sessions enregistrées après
  déploiement : les balises `<font>` sur `/app` doivent disparaître pour les visiteurs
  anglophones.
