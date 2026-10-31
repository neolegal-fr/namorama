# Proposal

## Why

Une fois les noms affichés, l'utilisateur ne peut plus dire ce qu'il en pense autrement que par 👍/👎. Or c'est en voyant les noms qu'on découvre ce qu'on n'aime pas : « ça ne sonne pas assez français », « pas de mots collés ». Les utilisateurs veulent formuler ces règles : relevé du 31/10/2026 sur les 133 projets des 90 derniers jours, 18 fixent une longueur et 18 des mots ou terminaisons à éviter. Ils l'écrivent dans la description, faute d'autre endroit, et 59 projets sur 133 s'arrêtent à 10 noms ou moins.

Les signaux existants ne suffisent pas, et le code l'explique.

- **👍/👎 ne disent pas pourquoi.** Les noms aimés ou rejetés partent dans la consigne comme exemples (`domain.service.ts:912-921`). Le modèle doit deviner ce qui a déplu, et un 👎 sur `taskbloom` ne dit pas « pas de mots composés ». Sur les 30 jours au 24/09/2026, les 117 👎 venaient d'un seul compte : le geste est rare, et sa signification reste implicite.
- **Une préférence ajoutée au texte de la consigne ne pèserait rien face aux quotas de génération.** Le style standard impose quatre sous-groupes à parts égales, dont un quart de noms composés de deux racines (`domain.service.ts:955-985`). Une phrase « pas de noms composés » ajoutée à la consigne contredirait l'instruction voisine, qui en exige huit.
- **Le cahier des charges ne se lit que dans la description**, réextraite à chaque recherche (`domain.service.ts:1563`). Modifier la description pour ajouter « plus francophone » réécrirait le projet et repartirait de zéro.

## What Changes

- **Une zone « Affiner » sous la liste des résultats.**
  - Un champ libre (« Qu'est-ce qui vous plaît ou non dans ces noms ? ») et quelques suggestions en un clic : plus courts, plus francophones, pas de noms composés, plus sérieux, plus ludiques.
  - L'envoyer lance « 10 de plus » avec ce retour. Le coût en crédits est celui de « 10 de plus », et les noms déjà vérifiés restent exclus.
  - La zone n'apparaît qu'une fois des résultats affichés, et pas pour un invité en lecture seule.
- **Les retours s'additionnent.** Chaque retour envoyé devient une puce retirable au-dessus de la zone. Toutes les puces actives s'appliquent aux recherches suivantes du projet. En cas de contradiction, le plus récent l'emporte.
- **Un retour n'agit que sur les recherches suivantes.** Les cartes déjà affichées ne sont ni masquées, ni retriées, ni renotées.
- **Un retour ne modifie pas la description du projet.** Il est enregistré à part, sur le projet, et survit à sa réouverture.
- **Un retour est compris avant d'être appliqué.** Le serveur le traduit en trois parts :
  - les contraintes vérifiables (longueur, terminaisons, mots à éviter ou à inclure), appliquées par le filtre du cahier des charges, comme celles du brief ;
  - les réglages du mélange de styles (retirer les noms composés, privilégier une langue) ;
  - le reste, transmis au modèle comme préférence de goût.
- **La mesure suit.** `search_completed` porte le nombre de retours actifs et ce qui en a été compris, jamais le texte. Un événement `name_feedback_added` marque chaque retour envoyé, avec son origine (suggestion ou saisie libre).

Hors périmètre :

- appliquer un retour aux cartes déjà affichées (masquage, nouveau tri) ;
- afficher à l'utilisateur ce que le serveur a compris de chaque retour (les puces montrent son texte) ;
- reformuler la description à partir des retours ;
- partager des retours entre projets, ou en faire un profil de goût du compte ;
- la diversité des sonorités (-ora, -ix), chantier distinct annoncé par `respecter-le-cahier-des-charges`.

## Capabilities

### New Capabilities

- `recherche/retours-sur-les-noms` : comment l'utilisateur exprime, après une recherche, ce qu'il attend des noms suivants. Couvre la saisie, l'accumulation, le retrait, la persistance sur le projet, la priorité face au brief et aux réglages, et la façon dont un retour pèse sur la génération.

### Modified Capabilities

Aucune. `recherche/cahier-des-charges` n'est pas encore archivée dans `openspec/specs/`. Ses exigences restent vraies : un retour y ajoute une source de contraintes sans en changer le filtre.

## Impact

- **API**
  - `api/src/domain/dto/search-domains.dto.ts` : champ `retours` (liste bornée de textes).
  - `api/src/domain/domain.service.ts` : interprétation des retours (un appel au modèle simple par recherche qui en porte), fusion dans `NamingConstraints`, sous-groupes de génération désormais réglables, section de préférence dans la consigne de `generateDomainIdeas`.
  - `api/src/common/modele-ia/schemas.ts` : schéma de l'interprétation. `schemas.spec.ts` doit suivre.
  - `api/src/domain/domain.controller.ts` : champs de `search_completed`.
  - `api/src/projects/` : colonne `retours` sur le projet, lue et écrite par les routes existantes.
- **Front** : `wizard.ts`, `wizard.html`, `web/public/assets/i18n/{fr,en}.json`.
- **Données** : une migration SQL (`ADD COLUMN IF NOT EXISTS retours`), à appliquer avant de déployer l'image.
- **Contrat API** : `search/stream` accepte `retours`, et les projets exposent `retours`. Les deux ajouts sont rétrocompatibles.
- **Coût** : un appel `simple` de plus (environ 0,001 $) par recherche portant des retours. La génération garde son budget.
