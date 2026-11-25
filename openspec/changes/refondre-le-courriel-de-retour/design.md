# Design

## Context

Voir proposal.md, section Why. État du code au 25/11/2026 :

- Un seul gabarit sert les deux envois. `composer` (`api/src/admin/admin-mail.service.ts:357`) assemble les blocs de `GABARITS` (sept langues). L'envoi automatique (`demande-de-retour.service.ts:144`) passe `contexte = null`. Le courriel manuel passe la phrase du modèle, et son texte reste modifiable dans le dialogue avant `envoyer`.
- Le corps est du **texte**, stocké tel quel dans `admin_mail.body`. Le HTML est produit à l'envoi par `mettreEnPage`, qui échappe tout, fait des paragraphes et transforme `[texte](https://…)` en `<a>`. Il exclut tout bouton par choix (commentaire `admin-mail.service.ts:173-183`). La version texte est produite par `versionTexte`.
- Les liens de réponse sont `${FRONTEND_URL}/retour?j=<jeton>`. Le jeton signe `keycloakId.action.expiration` (`retours/liens-de-retour.ts`) ; l'action vaut `oui`, `non` ou `desinscription`.
- `admin_mail.promptVersion` reçoit `CONSIGNES_VERSION` (`'2026-11-01.1'`) à chaque envoi, automatique ou manuel. CLAUDE.md le demande à chaque retouche du prompt **ou du gabarit**.
- `user.utilite` vaut `oui` ou `non`. Aucun compte ne l'a renseigné en production, donc aucune réponse passée n'est à requalifier.

## Goals / Non-Goals

**Goals :**
- Un message dont la question se lit dans la boîte de réception, et dont les réponses se touchent au doigt.
- Pouvoir comparer les versions du gabarit sur les logs, sans table nouvelle.

**Non-Goals :**
- Un moteur de gabarits HTML : le corps reste du texte, éditable dans le dialogue.
- Changer la valeur stockée de la réponse (`oui` / `non`), le jeton, ou les routes.

## Decisions

### D1. La question porte sur le résultat de la personne

« Avez-vous trouvé un nom qui vous plaît ? » → **« Oui, j'en ai un »** (`oui`) / **« Pas encore »** (`non`). Décision de l'utilisateur, 25/11/2026.

La réponse reste stockée en `oui` / `non` dans `user.utilite`. Le jeton, les routes et la page `/retour` ne changent pas. Après « Pas encore », la page demande déjà « Qu'est-ce qui vous a bloqué ou vous a manqué ? » ; après « Oui », elle invite à dire ce qui a plu. Les deux suites conviennent à la nouvelle question.

*Écarté : garder « Namorama vous a-t-il été utile ? »*, qui ne change que la forme. Les réponses resteraient comparables aux envois passés, mais il n'y en a aucune. *Écarté : « Qu'est-ce qui vous a manqué ? » à choix multiples* : plus riche, mais un choix de plus avant le clic, et une page et une colonne nouvelles.

*Écarté : une colonne `nomTrouve` distincte d'`utilite`.* Une migration pour renommer le sens d'une colonne vide. La version du gabarit (D4) dit à quelle question chaque réponse répond.

### D2. L'ordre du message, et l'objet

Ordre : salutation → **question** → les deux réponses → « Un clic suffit : il vous rapporte 100 crédits. » → présentation du signataire, puis « vous avez créé votre compte hier » (automatique) ou la phrase du modèle (manuel) → demande détaillée à 500 crédits → avis éventuel → merci et signature → désinscription.

`OBJET` devient la question, dans chaque langue : « Avez-vous trouvé un nom qui vous plaît ? », « Did you find a name you like? »… L'objet sert aux **deux** envois : le courriel manuel porte la même question, il en reprend l'objet.

*Écarté : un texte d'aperçu caché (preheader).* Du texte invisible, dans un message qui se veut écrit par une personne, est un signal de publipostage pour les filtres. La première ligne visible fait déjà l'aperçu.

*Écarté : garder la présentation en tête*, par politesse. C'est elle qu'on lit dans l'aperçu aujourd'hui, et la seule réaction mesurée est une désinscription.

### D3. Des boutons pour les seuls liens de réponse, reconnus par leur adresse

`mettreEnPage` rend en **bouton** tout lien nommé dont l'adresse est un lien de réponse (`/retour?j=`). Si un paragraphe ne contient que de tels liens, ils sont posés côte à côte dans **un seul** tableau de mise en page. Tout le reste ne change pas : texte échappé, liens soulignés, aucun logo, aucun pied de page.

- Reconnaître les liens **par leur adresse**, et non par une syntaxe nouvelle, garde le corps éditable. Dans le dialogue manuel, l'administrateur retouche le texte sans connaître de balisage. Tant que les deux liens restent, les boutons restent.
- Le bouton est un « bulletproof button » : une cellule de tableau qui porte le fond, et un `<a>` qui porte le texte, avec des styles en ligne. C'est la seule forme qu'Outlook et Gmail rendent pareil. Valeurs : fond `#0d7a4e` (l'accent des e-mails, §2 du système de design), texte blanc gras, `padding` de 14 px × 22 px, rayon 8 px. Le bouton fait ainsi environ 48 px de haut, au-dessus du plancher `--nm-touch-min` (44). Le `<a>` occupe toute la cellule.
- **Les deux boutons sont identiques** : même couleur, même taille. C'est une exception assumée à « un seul bouton principal par zone » (§1, règle 5). Les deux réponses valent pareil et rapportent pareil ; en mettre une en avant fausserait la mesure, pour la même raison qui fait récompenser les deux également.
- La version texte ne change pas : « Oui, j'en ai un (https://…) ».
- `verifierBrouillon` vérifie toujours la présence des deux liens. Les boutons ne dépendent que d'eux.

*Écarté : une syntaxe de bouton dans le texte* (`[[Oui]](…)`). C'est un balisage de plus à préserver dans le dialogue, et il s'afficherait tel quel dans la version texte. *Écarté : boutons de styles différents* (plein pour « Oui », contour pour « Pas encore ») : cela pousse vers une réponse. *Écarté : des liens texte agrandis*, chacun sur sa ligne : plus proche d'une lettre, mais la cible au doigt reste la hauteur d'une ligne de texte. *Écarté : passer tout le courriel en gabarit HTML* (logo, bandeau) : c'est ce qui le ferait ressembler à une campagne, ce que la règle du « HTML nu » évitait déjà.

Les styles en ligne ne concernent que l'API : le cliquet `just design-check` ne couvre que `web/`. Le §2 du système de design le prévoit déjà pour les e-mails : « toujours clair, styles figés, valeurs recopiées ». Le bouton de réponse s'ajoute au §5 comme composant d'e-mail.

### D4. La version du gabarit dans la mesure

`CONSIGNES_VERSION` passe à `'2026-11-26.1'` (date de réalisation) et sert de **version du gabarit**. Elle est déjà écrite sur chaque `admin_mail`.

- `feedback_request_sent` gagne `version: CONSIGNES_VERSION`.
- `feedback_utility_answered` gagne `version` : le `promptVersion` du **dernier courriel délivré** à ce compte, lu dans `admin_mail` au moment de la réponse. Un clic sur un lien d'avant le changement est donc rattaché à `'2026-11-01.1'` : les jetons restent valables 90 jours.
- `python3 - retours` (`scripts/analyze-logs.py`) regroupe par `version` : envois délivrés, réponses, part de « oui », délai médian, désinscriptions. Les désinscriptions sont rattachées à la version du dernier envoi au même `sub`.

*Écarté : porter la version dans le jeton.* Cela changerait le format des liens et casserait la vérification des jetons déjà émis. *Écarté : une colonne `user.demandeRetourVersion`* : une migration pour une donnée que `admin_mail` porte déjà. *Écarté : un test A/B* (décision de l'utilisateur) : à environ 35 envois par mois, deux groupes de 17 ne départagent rien.

### D5. Les sept langues

Les nouveaux libellés (question, deux réponses, phrase des 100 crédits, objet) sont écrits dans les sept langues de `GABARITS`. Le français et l'anglais font foi ; les cinq autres sont traduits à la réalisation et relus sur un exemple rendu. Les libellés des boutons restent courts (moins de 20 caractères), pour tenir à deux par ligne à 390 px.

### Contrats externes modifiés

- Événements : `feedback_request_sent` et `feedback_utility_answered` gagnent `version` (chaîne). Les champs existants ne changent pas.
- Courriels : l'objet, l'ordre et les libellés changent, et le HTML contient deux boutons. Le jeton, les routes `/retours/*`, l'en-tête `List-Unsubscribe` et la version texte ne changent pas de forme.
- Modèle : la consigne du courriel manuel (`consignes()`) ne change pas. Seule l'insertion de la phrase dans le gabarit change de place.
- Aucune route, aucune migration, aucune variable d'environnement.

## Risks / Trade-offs

- [Un courriel avec boutons ressemble davantage à du marketing pour les filtres] → un seul bloc de boutons, aucune image, aucun lien de suivi, le même expéditeur. Un envoi de test vers mail-tester avant le déploiement doit rester à 10/10 ; c'est une tâche.
- [Rendu des boutons selon la messagerie] → la forme tableau + `<a>` est la plus portable. Vérification sur Gmail web et mobile, et sur Outlook.com, par un envoi réel à des boîtes de test.
- [La comparaison avant / après mêle d'autres effets : saison, source des inscrits] → assumé. Le relevé « avant » est net : 0 réponse sur 36. Le suivi lira au moins les 30 premiers envois de la nouvelle version.
- [Une réponse « oui » ne dit pas *quel* nom] → hors périmètre. La page qui suit invite déjà au retour détaillé.

## Migration Plan

Pas de migration SQL. Merger, attendre le build, déployer l'API seule. Le premier passage horaire suivant envoie la nouvelle version.

Retour arrière : redéployer l'image précédente. Les liens émis restent valables, puisque le jeton ne change pas.
