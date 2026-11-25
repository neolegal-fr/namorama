# Proposal

## Why

La demande de retour automatique (chantier `demande-de-retour-automatique`) part bien, mais **personne n'y répond**. Relevé en production du 25/11/2026 :

- **36 courriels acceptés par le SMTP** depuis le 01/11 : 33 automatiques, 3 manuels (`admin_mail.delivered = 1`).
- **0 réponse en un clic** : `user.utilite` est vide pour les 184 comptes, aucun appel à `POST /retours/utilite`, et aucune requête vers `/retour` en 14 jours de journal nginx.
- **0 retour écrit** : le dernier feedback date du 20/10/2026.
- **Une seule réaction : une désinscription**, 22 s après l'envoi, depuis un téléphone Android et la même connexion que l'inscription de la veille. La personne a lu le message, et le seul geste qu'elle a fait est le lien du bas.

**Ce n'est pas la délivrabilité.** SPF, DKIM et DMARC sont publiés, l'expéditeur est le compte authentifié, et mail-tester note le courriel **10/10** (relevé du 25/11/2026). Le message arrive en boîte de réception Gmail, puisqu'il a été lu dans la minute.

Le message lui-même fait obstacle, à trois endroits :

1. **Les deux réponses sont deux mots soulignés sur une ligne** : `[Oui](…) · [Non](…)` (`api/src/admin/admin-mail.service.ts:268-270`), rendus en liens nus par `mettreEnPage` (`admin-mail.service.ts:184-199`), qui exclut tout bouton. Au doigt, c'est la plus petite cible du message, et elle a le même poids que « Se désinscrire ».
2. **La question n'est pas ce qu'on lit en premier.** L'objet est générique, « Une question rapide sur Namorama » (`admin-mail.service.ts:117-121`). Le corps ouvre sur une présentation, « Je suis Nicolas, le créateur de… » (`composer`, `admin-mail.service.ts:357-374`). L'aperçu de la boîte de réception ne montre donc jamais la question.
3. **La question parle du produit, pas de la personne.** « Namorama vous a-t-il été utile ? » demande un jugement sur un outil quitté la veille. La plupart de ces comptes n'ont eu qu'un jour d'activité : sur les 47 inscrits du mois, 44 ont lancé une recherche, 9 ont gardé un favori, et 3 sont revenus un autre jour. Une question sur leur propre projet — ont-ils trouvé leur nom ? — les concerne directement, et sa réponse mesure enfin le résultat réel.

## What Changes

- **La question devient « Avez-vous trouvé un nom qui vous plaît ? »**, avec deux réponses en un clic, **« Oui, j'en ai un »** et **« Pas encore »**. Les 100 crédits, la réponse unique par compte et l'enregistrement par la page restent inchangés.
- **La question vient en premier** : elle est l'objet du courriel et sa première ligne après la salutation. La présentation du signataire passe après les réponses.
- **Les deux réponses deviennent deux boutons**, larges, de même apparence, au vert de l'accent des courriels. Le reste du message reste nu : ni logo, ni bandeau, ni pied de page. La désinscription reste un lien texte en bas.
- **Le courriel manuel suit la même structure**, avec sa phrase personnalisée placée après les réponses. Il partage le gabarit, et ses boutons sont produits par la même mise en page.
- **Chaque envoi et chaque réponse portent la version du gabarit.** `feedback_request_sent` et `feedback_utility_answered` gagnent un champ `version`. Une commande `python3 - retours` du script d'analyse donne, par version, les envois, les réponses, la part de « oui » et les désinscriptions. On compare **avant / après**, pas en test A/B : à environ 35 inscrits par mois, deux groupes de 17 ne départageraient rien avant plusieurs mois.
- Le libellé du tableau admin des utilisateurs ne cite plus la question d'utilité.

Hors périmètre :

- un test A/B ou une rotation des gabarits ;
- un pixel ou un suivi d'ouverture : ce serait du pistage, et un signal de publipostage pour les filtres ;
- un texte d'aperçu caché (*preheader*) : du texte invisible dans un courriel personnel est un signal de spam, et la première ligne visible suffit ;
- relancer qui n'a pas répondu, ou changer le délai de 24 h ;
- le contenu de la page `/retour` : après « Pas encore », elle demande déjà ce qui a bloqué ou manqué, ce qui convient à la nouvelle question ;
- la récompense des 500 crédits et sa validation manuelle.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `retours-utilisateurs/demande-de-retour` : la question posée et ses deux réponses, l'ordre du message et son objet, des boutons pour répondre, et la version du gabarit dans la mesure. Cette capacité est créée par `demande-de-retour-automatique`, livré mais pas encore archivé : ce chantier-ci l'archive d'abord (tâche 1.1). Le relevé du 25/11/2026 en tient lieu de suivi de production.

## Impact

- **API** :
  - `api/src/admin/admin-mail.service.ts` : `GABARITS` et `OBJET` dans les sept langues, `composer`, `mettreEnPage` (boutons pour les liens de réponse), `verifierBrouillon`, `CONSIGNES_VERSION` ;
  - `api/src/admin/demande-de-retour.service.ts` : la version dans `feedback_request_sent` ;
  - `api/src/retours/retours.service.ts` : la version dans `feedback_utility_answered`, lue sur le dernier courriel délivré au compte.
  - Ni migration, ni nouvelle route, ni nouvelle variable d'environnement.
- **Web** : l'infobulle de la réponse dans `admin-users.component.ts`. Aucun nouveau texte i18n côté application.
- **Script** : `scripts/analyze-logs.py`, nouvelle commande `retours`.
- **Modèle** : la consigne du courriel manuel ne change pas, mais `CONSIGNES_VERSION` change avec le gabarit.
- **Documentation** : CLAUDE.md, « Demander un retour à un utilisateur » et « Nommage des événements ».
- **Interface** : docs/systeme-de-design.md §1 (règles 4 et 5), §2 (les e-mails : toujours clairs, styles figés, accent `#0d7a4e`), §3 (la voix : un bouton dit ce qu'il fait, pas d'emoji dans un objet) et §4 (cibles tactiles). Ce chantier ajoute un motif nouveau, **le bouton de réponse dans un e-mail**, à documenter au §5.
