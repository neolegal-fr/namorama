# Design

## Context

Voir proposal.md, section Why. État actuel, relevé dans le code le 31/10/2026 :

- La demande est rédigée par `AdminMailService.rediger` (une phrase du modèle dans un gabarit `GABARITS` en sept langues), puis envoyée par `envoyer`, qui écrit une ligne `admin_mail` (même en cas d'échec, avec `delivered`). Signataire : le nom de l'administrateur connecté, tiré de son jeton.
- Les 500 crédits : `POST /feedback` enregistre un feedback, l'administrateur le récompense dans l'onglet Feedbacks (`FeedbackService.awardCredits` → `UsersService.addExtraCredits`, `extraCredits += n`).
- Aucune planification : pas de `@nestjs/schedule`. Deux `setInterval` quotidiens (purge des logs, purge du rejeu), `unref()`, un seul conteneur.
- Aucun lien signé, aucune désinscription. `MailService.send` n'accepte pas d'en-têtes.
- `user.locale` vient du jeton Keycloak, vide pour la plupart des comptes (64 sur 79 au 25/09/2026).

## Décisions produit tranchées sans consultation

La demande du 31/10/2026 fixe l'envoi à 24 h, la question oui / non à 100 crédits et le retour détaillé à 500 crédits. Les quatre décisions suivantes n'y figuraient pas. Elles sont prises ici par défaut, chacune réversible, et sont à confirmer avant la réalisation :

1. **Tous les nouveaux comptes éligibles**, pas seulement ceux qui ont lancé une recherche. Ceux qui repartent sans chercher sont ceux dont on sait le moins. *Écarté : cibler les comptes actifs*, qui éviterait d'écrire à qui n'a rien fait, mais laisserait muet le décrochage le plus fréquent.
2. **Oui et non rapportent 100 crédits, une fois par compte, sans connexion.** Ne récompenser que le oui biaiserait la mesure, et l'interdiction de récompenser un avis positif vaut aussi pour la plateforme d'avis (CLAUDE.md, « Page d'avis »). *Écarté : créditer après connexion*. C'est plus sûr contre un lien transféré, mais un pas de plus, donc moins de réponses, pour un risque faible : les crédits vont au compte du lien, pas à celui qui clique.
3. **Lien de désinscription dans le courriel automatique.** CLAUDE.md et le commentaire de `admin_mail` l'exigent pour un envoi qui n'est plus relu au cas par cas. *Écarté : s'en passer au motif d'un courriel unique lié au service*, juridiquement plus fragile (droit d'opposition).
4. **Pas d'envoi rétroactif.** Seuls les comptes créés après `FEEDBACK_AUTO_DEPUIS` sont visés. *Écarté : une vague aux anciens comptes jamais contactés*, qui partirait d'un coup le jour du déploiement, à des personnes inscrites depuis des semaines.

## Goals / Non-Goals

**Goals :**
- Zéro action quotidienne de l'administrateur pour les nouveaux inscrits.
- Une réponse en un clic, qui ne peut être ni comptée deux fois ni déclenchée par un robot.
- Aucune phrase non relue dans un courriel automatique.

**Non-Goals :**
- Plusieurs instances de l'API : la minuterie suppose un seul conteneur, comme les purges.
- Une préférence de courriel générale.

## Decisions

### D1. Une minuterie horaire, un verrou par ligne

`DemandeDeRetourService` démarre à `onModuleInit` un `setInterval` d'une heure (`unref`, arrêté à `onModuleDestroy`), sur le modèle de `ReplayService`, et un premier passage 5 minutes après le démarrage. Chaque passage :

1. sélectionne au plus `LOT_MAX` (20) comptes éligibles (exigence « Comptes éligibles »), les plus anciens d'abord ;
2. pour chacun, **réserve** l'envoi par `UPDATE user SET demandeRetourAt = NOW() WHERE id = ? AND demandeRetourAt IS NULL`, et ne continue que si une ligne a changé ;
3. compose, envoie, et écrit la ligne `admin_mail` (`automatique = true`, `adminSub = NULL`, `delivered`).

Un échec d'envoi laisse `demandeRetourAt` posé : le compte n'est pas resollicité en boucle. L'échec se journalise et se lit dans l'historique admin (« non délivré »), d'où l'administrateur peut écrire à la main.

*Écarté : `@nestjs/schedule`.* C'est une dépendance pour un seul minuteur, alors que le projet a déjà son motif. *Écarté : un envoi au moment exact des 24 h* (file différée) : une heure de retard ne change rien, une file ajouterait un état à surveiller.

### D2. Le gabarit en deux temps, partagé par l'automatique et le manuel

`GABARITS` gagne `utilite` (la question et les deux liens, avec les 100 crédits) et une `question` resserrée pour la suite (500 crédits). `composer` reçoit `contexte: string | null` : `null` pour l'automatique, la phrase du modèle pour le manuel. L'automatique ajoute le pied de désinscription. `verifierBrouillon` contrôle aussi les deux liens de réponse et la mention des 100 crédits. `CONSIGNES_VERSION` change.

Texte français de référence (les autres langues suivent, `GABARITS`) :

> Bonjour {prénom},
>
> Je suis {prénom du signataire}, le créateur de namorama.com. Vous avez créé votre compte hier : une seule question.
>
> **Namorama vous a-t-il été utile ?** [Oui]({lien oui}) · [Non]({lien non})
>
> Un clic suffit, et il vous rapporte 100 crédits.
>
> Si vous avez deux minutes de plus, dites-moi ce que vous avez aimé, ce qui vous a bloqué ou ce qui mériterait d'être amélioré : répondez simplement à ce courriel, ou passez par [ce court formulaire]({formulaire}). Je vous offrirai 500 crédits de plus.
>
> Merci d'avance,
>
> {signataire}
> Créateur de Namorama
>
> Vous ne souhaitez plus recevoir ces messages ? [Se désinscrire]({lien désinscription})

*Écarté : garder une phrase personnalisée dans l'automatique.* À 24 h, la plupart des comptes n'ont presque rien fait. La phrase partirait sans relecture, et une hypothèse fausse (« vous avez cherché un nom pour… ») se lit comme une surveillance maladroite.

### D3. Liens signés, réponse enregistrée par la page, pas par le clic

Le jeton est `base64url(keycloakId.action.expiration).hmac`, HMAC-SHA256 avec `FEEDBACK_LINK_SECRET`, comparé à temps constant. Actions : `oui`, `non`, `desinscription`. Durée : 90 jours.

- Les liens du courriel mènent au **front** (`/retour?j=…` et `/desinscription?j=…`). La page, une fois exécutée, appelle `POST /retours/utilite` ou `POST /retours/desinscription` avec le jeton. Un analyseur qui récupère l'adresse sans exécuter la page n'enregistre rien.
- `POST /retours/utilite` est idempotent : `UPDATE user SET utilite = ?, utiliteAt = NOW() WHERE keycloakId = ? AND utiliteAt IS NULL`, puis 100 crédits par `addExtraCredits` seulement si une ligne a changé, dans la même transaction. La réponse dit `{ enregistree, dejaRepondu, credits }`.
- `List-Unsubscribe: <https://…/api/retours/desinscription?j=…>` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` : la désinscription en un clic des messageries (RFC 8058) fait un POST direct, que l'API accepte sur la même route.

*Écarté : enregistrer au GET du lien.* Les antivirus de messagerie suivent les liens : chaque courriel délivré vaudrait un « oui » et 100 crédits. *Écarté : un JWT* : une dépendance de plus pour un jeton à trois champs.

Risque assumé : un analyseur qui exécute le JavaScript de la page enregistrerait une réponse. C'est rare. `feedback_utility_answered` portera le délai depuis l'envoi : une réponse en moins de 10 secondes signalera ce cas.

### D4. La langue captée à l'inscription

`findOrCreateDetaille`, quand il crée un compte sans `locale`, enregistre dans `user.langueInscription` la première langue d'`Accept-Language` qui fait partie des langues de `GABARITS`. La demande prend `locale`, sinon `langueInscription`, sinon `fr`. Le contexte de requête (déjà propagé par `AsyncLocalStorage` pour l'imputation) porte l'en-tête jusqu'au service.

*Écarté : faire deviner la langue au modèle*, comme le courriel manuel : c'est un appel au modèle, sur un compte qui n'a souvent rien écrit.

### D5. Signataire configuré

`FEEDBACK_SIGNATAIRE` (« Nicolas Riousset ») ; le prénom en est tiré. Sans la variable, la minuterie ne démarre pas, et le journalise une fois au démarrage : mieux vaut aucun envoi qu'un courriel signé « Créateur de Namorama » par personne.

### D6. Données

Migration `2026-11-XX-demande-de-retour-automatique.sql` :
- `user` : `demandeRetourAt DATETIME NULL`, `utilite VARCHAR(3) NULL`, `utiliteAt DATETIME NULL`, `desinscritRetoursAt DATETIME NULL`, `langueInscription VARCHAR(5) NULL` ;
- `admin_mail` : `automatique TINYINT(1) NOT NULL DEFAULT 0`, `adminSub` rendu `NULL`.

`FEEDBACK_AUTO_DEPUIS` (date ISO) borne l'éligibilité, et s'applique au déploiement. Sans elle, aucun envoi : un oubli de configuration ne doit pas déclencher une vague rétroactive.

### Contrats externes modifiés

- Nouvelles routes publiques : `POST /retours/utilite` (`{ j }`), `POST /retours/desinscription` (`{ j }` ou `?j=`).
- `GET /admin/users` : champs `demandeRetourAt`, `utilite`, `desinscritRetoursAt`.
- `POST /admin/users/:id/mails` : 409 pour un compte désinscrit.
- Événements : `feedback_request_sent` (`delivered`, `langue`), `feedback_utility_answered` (`reponse`, `delaiDepuisEnvoiS`), `feedback_unsubscribed`.
- Requêtes au modèle : celle du courriel manuel change de consigne (nouvelle `CONSIGNES_VERSION`). L'automatique n'en fait aucune.

## Risks / Trade-offs

- [Délivrabilité : un courriel automatique, des liens, des crédits — un profil de spam] → expéditeur et domaine inchangés (SPF, DKIM et DMARC à « pass »), un seul courriel par compte, désinscription en un clic, texte sobre. Les échecs de livraison se suivent dans `admin_mail.delivered`.
- [Abus des 100 crédits par création de comptes en série] → déjà possible avec les 100 crédits d'inscription : le chantier double la récompense d'un faux compte, sans ouvrir de nouvelle voie. La réponse n'est possible qu'à 24 h, avec l'adresse vérifiée par Keycloak.
- [Fuite de `FEEDBACK_LINK_SECRET`] → permettrait de créditer 100 crédits par compte existant, et de désinscrire. Il est changeable : les jetons émis deviennent invalides, sans autre effet.
- [Minuterie arrêtée sans bruit] → chaque passage journalise son bilan (`demande_retour_passage` : éligibles, envoyés, échecs). Un compte de plus de 48 h, éligible et sans demande, se voit dans le tableau admin.

## Migration Plan

1. Appliquer la migration SQL avant l'image.
2. Ajouter `FEEDBACK_LINK_SECRET` (aléatoire, 32 octets), `FEEDBACK_SIGNATAIRE` et `FEEDBACK_AUTO_DEPUIS` (date du déploiement) au `docker-compose.yml` de prod.
3. Déployer. Le premier passage a lieu 5 minutes après le démarrage. Contrôler `demande_retour_passage` dans les logs.
4. Retour arrière : retirer `FEEDBACK_AUTO_DEPUIS` arrête les envois sans redéployer l'image précédente.

## Open Questions

- Le texte exact des six autres langues : traduit à la réalisation, relu par l'utilisateur pour l'anglais.
