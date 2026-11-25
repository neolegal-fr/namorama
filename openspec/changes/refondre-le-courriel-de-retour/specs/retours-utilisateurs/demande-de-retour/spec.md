# Spec Delta

## MODIFIED Requirements

### Requirement: Contenu en deux temps
La demande SHALL poser d'abord la question « Avez-vous trouvé un nom qui vous plaît ? », avec deux réponses en un clic, « Oui, j'en ai un » et « Pas encore », en annonçant 100 crédits pour un clic. Elle SHALL ensuite proposer un retour détaillé (ce qui a plu, ce qui a bloqué, ce qui mérite d'être amélioré), par réponse au courriel ou par le formulaire, en annonçant 500 crédits.

#### Scenario: Courriel automatique en français
- **WHEN** la demande automatique part à un compte francophone
- **THEN** elle contient, dans l'ordre : la salutation, la question « Avez-vous trouvé un nom qui vous plaît ? » avec ses deux réponses et la mention des 100 crédits, la présentation du signataire, la demande détaillée avec le lien du formulaire et la mention des 500 crédits, puis la signature et le lien de désinscription

#### Scenario: Courriel manuel
- **WHEN** l'administrateur fait rédiger une demande pour un compte ancien
- **THEN** le brouillon suit le même ordre, sa phrase personnalisée vient après les deux réponses, et il reste relu avant envoi

#### Scenario: Courriel en anglais
- **WHEN** la demande part à un compte dont la langue est l'anglais
- **THEN** la question est « Did you find a name you like? » et les réponses « Yes, I have one » et « Not yet »

### Requirement: Réponse oui ou non en un clic
Un clic sur l'une des deux réponses SHALL enregistrer la réponse du compte (« oui » pour « Oui, j'en ai un », « non » pour « Pas encore ») et lui accorder 100 crédits, sans connexion. Les deux réponses MUST rapporter les mêmes crédits. Un compte MUST n'être récompensé qu'une fois, quel que soit le nombre de clics.

#### Scenario: Premier clic sur Non
- **WHEN** l'utilisateur clique « Pas encore » dans sa demande
- **THEN** la réponse « non » est enregistrée, son solde augmente de 100 crédits, et la page affichée le confirme

#### Scenario: Second clic
- **WHEN** l'utilisateur clique « Oui, j'en ai un » après avoir déjà répondu « Pas encore »
- **THEN** la première réponse reste enregistrée, aucun crédit n'est ajouté, et la page dit que la réponse était déjà notée

#### Scenario: Lien falsifié
- **WHEN** un lien de réponse porte une signature invalide ou un compte modifié
- **THEN** rien n'est enregistré ni crédité, et la page indique que le lien n'est pas valide

#### Scenario: Lien d'un courriel antérieur
- **WHEN** un compte clique « Oui » dans un courriel envoyé avant le changement de question, encore valide
- **THEN** sa réponse est enregistrée et créditée comme avant, et la mesure la rattache à l'ancienne version du gabarit

### Requirement: Mesure sans donnée personnelle
Chaque envoi automatique SHALL émettre `feedback_request_sent`, chaque réponse `feedback_utility_answered` avec `reponse`, et chaque désinscription `feedback_unsubscribed`. `feedback_request_sent` et `feedback_utility_answered` SHALL porter la `version` du gabarit envoyé au compte. Ces événements MUST NOT contenir d'adresse ni de texte saisi.

#### Scenario: Réponse enregistrée
- **WHEN** un compte répond « Oui, j'en ai un » au courriel du nouveau gabarit
- **THEN** `feedback_utility_answered` est journalisé avec `reponse: oui`, la `version` de ce gabarit et le `sub` du compte, sans adresse

#### Scenario: Comparaison des versions
- **WHEN** l'administrateur lance l'analyse des retours sur les logs de production
- **THEN** il lit, pour chaque version du gabarit, le nombre d'envois délivrés, de réponses, la part de « oui » et le nombre de désinscriptions

## ADDED Requirements

### Requirement: La question est l'objet du courriel
L'objet de la demande SHALL être la question elle-même, dans la langue du message, sans emoji.

#### Scenario: Objet en français
- **WHEN** la demande part à un compte francophone
- **THEN** son objet est « Avez-vous trouvé un nom qui vous plaît ? »

#### Scenario: Objet en allemand
- **WHEN** la demande part à un compte dont la langue d'inscription est l'allemand
- **THEN** son objet est la traduction allemande de la question

### Requirement: Les réponses sont des boutons
Dans la version HTML du courriel, les deux réponses SHALL être deux boutons de même apparence, d'au moins 44 px de haut, assez larges pour être touchés au doigt. Le reste du message MUST rester du texte, sans logo, image ni pied de page. La version texte SHALL garder chaque réponse lisible, suivie de son adresse.

#### Scenario: Lecture sur téléphone
- **WHEN** le destinataire ouvre la demande sur un écran de 390 px
- **THEN** il voit deux boutons « Oui, j'en ai un » et « Pas encore » de même taille et de même couleur, et le lien « Se désinscrire » reste un lien texte en bas du message

#### Scenario: Messagerie en texte seul
- **WHEN** la messagerie n'affiche que la version texte
- **THEN** chaque réponse apparaît comme son libellé suivi de son adresse entre parenthèses

#### Scenario: Brouillon manuel modifié
- **WHEN** l'administrateur retouche le texte d'un brouillon sans toucher aux deux liens de réponse
- **THEN** le courriel envoyé affiche toujours les deux réponses en boutons
