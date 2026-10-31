# Proposal

## Why

La demande de retour est aujourd'hui une tâche quotidienne de l'administrateur : ouvrir **Administration → Utilisateurs**, choisir un compte, faire rédiger le courriel, le relire, l'envoyer (`admin-mail.service.ts:576-646`). Rien ne part seul, et c'était voulu (`admin-mail.service.ts:483-489`). Mais l'effort se répète pour chaque inscrit, et le moment qui compte se joue en un jour.

- **On décroche dès le premier jour.** Relevé du 22/09/2026 : 70 comptes sur 75 n'ont aucune activité après leur premier jour, et la durée de vie médiane d'un compte est d'environ 3 minutes (CLAUDE.md, « Fidélité »). Un courriel écrit à la main plusieurs jours après arrive quand la personne a oublié ce qu'elle cherchait.
- **La demande actuelle coûte cher à la personne.** Elle demande d'écrire : ce qu'on a aimé, ce qui a bloqué, ce qui mérite d'être amélioré, contre 500 crédits validés à la main (`GABARITS`, `feedback.service.ts`). Il n'existe pas de premier pas qui se fasse en un clic. On ne sait donc rien de ceux qui n'écrivent pas, c'est-à-dire de presque tout le monde.
- **Le volume ne se mesure pas encore.** Combien de demandes ont été envoyées, combien de réponses obtenues, sous quel délai : les tables `admin_mail` et `feedback` le disent, mais la lecture de la base de prod n'était pas ouverte à la rédaction de ce chantier. La tâche 1.1 en fait le relevé, qui servira de point de comparaison.

## What Changes

- **La demande part seule, 24 h après la création du compte.** Elle va une fois à chaque nouveau compte mesuré qui a une adresse (hors comptes administrateurs et internes, hors comptes déjà contactés à la main ou désinscrits). L'administrateur n'a plus rien à faire pour les nouveaux inscrits.
- **Le courriel est reformulé en deux temps.**
  - D'abord une question en un clic : « Namorama vous a-t-il été utile ? », avec deux liens, **Oui** et **Non**. L'une ou l'autre réponse rapporte **100 crédits**, une seule fois par compte, crédités tout de suite, sans connexion.
  - Ensuite, pour qui veut en dire plus, la demande d'aujourd'hui : ce qu'on a aimé, ce qui a bloqué, ce qui mérite d'être amélioré, par réponse au courriel ou par le formulaire, contre **500 crédits**, toujours validés à la main dans l'onglet Feedbacks.
- **La page qui suit le clic remercie et relance.** Elle confirme les 100 crédits, puis propose le formulaire détaillé. Après un « non », elle demande ce qui a manqué.
- **Le courriel automatique a un lien de désinscription**, en un clic et sans connexion, avec l'en-tête `List-Unsubscribe`. Un compte désinscrit ne reçoit plus de demande, automatique ou manuelle.
- **Le courriel automatique ne passe pas par le modèle.** Gabarit fixe, traduit, signé d'un signataire configuré. Sans relecture humaine, aucune phrase générée ne part.
- **Le courriel écrit à la main adopte la même structure en deux temps.** Il garde sa phrase personnalisée et sa relecture, pour les comptes antérieurs au chantier ou les relances choisies.
- **La mesure suit.** Événements `feedback_request_sent`, `feedback_utility_answered` (`reponse`), `feedback_unsubscribed`. Le tableau des utilisateurs signale « demande auto envoyée », la réponse oui / non, et la désinscription.

Hors périmètre :

- envoyer aux comptes créés avant la mise en service : ils restent traités à la main ;
- relancer qui n'a pas répondu ;
- valider automatiquement les 500 crédits : ils restent à la main ;
- borner à un seul versement les 500 crédits par compte (aujourd'hui, un compte qui écrit deux fois peut être récompensé deux fois, et seule la validation manuelle l'empêche) : relevé, à traiter à part ;
- une préférence générale de courriel sur le compte, au-delà de la désinscription des demandes de retour.

## Capabilities

### New Capabilities

- `retours-utilisateurs/demande-de-retour` : quand et à qui part la demande de retour, ce qu'elle contient, la réponse oui / non et sa récompense, la page qui suit, la désinscription, et la mesure.

### Modified Capabilities

Aucune. La demande de retour écrite à la main n'a pas de spécification dans `openspec/specs/`. Son nouveau contenu est décrit dans la capacité ci-dessus.

## Impact

- **API**
  - `api/src/admin/admin-mail.service.ts` : gabarit en deux temps (`GABARITS`, `CONSIGNES_VERSION`), `verifierBrouillon`.
  - Nouveau service d'envoi planifié, une minuterie horaire sur le modèle des purges quotidiennes. Il n'y a pas de `@nestjs/schedule` dans le projet.
  - Liens signés (HMAC, nouvelle variable `FEEDBACK_LINK_SECRET`) pour oui / non et la désinscription. Routes publiques de réponse et de désinscription.
  - `api/src/mail/mail.service.ts` : en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post`.
  - `UsersService.addExtraCredits` pour les 100 crédits.
- **Front** : page publique de réponse (merci, crédits, formulaire détaillé), page de désinscription, et marqueurs dans le tableau admin des utilisateurs.
- **Données** : migration SQL. Colonnes sur `user` (demande envoyée, réponse oui / non et date, désinscription, langue captée à l'inscription), et sur `admin_mail` (`automatique`, `adminSub` nullable).
- **Configuration de prod** : `FEEDBACK_LINK_SECRET`, `FEEDBACK_SIGNATAIRE`, `FEEDBACK_AUTO_DEPUIS` (date de mise en service), à reporter dans le `docker-compose.yml` de prod, qui liste ses variables une à une.
- **Coût** : aucun appel au modèle pour l'envoi automatique. 100 crédits offerts par compte qui répond. Volume d'envoi : une poignée par jour, au rythme des inscriptions.
- **Contrat** : nouvelles routes publiques (`POST /retours/utilite`, `POST /retours/desinscription`). Aucun contrat existant ne change.
