# Design

## Context

Voir proposal.md, section Why. État du code au 31/10/2026, `origin/main` à `122cc84` :

- **Bornes** : `bornesDeLongueur` (`api/src/domain/domain.service.ts:339`) suit l'ordre réglage, puis brief, puis défaut. Le défaut vaut [7, 12] (`DEFAULT_MIN_NAME_LENGTH`, `DEFAULT_CONSTRAINTS.maxLength`), le plancher 5 (`MIN_NAME_LENGTH_FLOOR`). Un maximum du brief n'est jamais élargi, même sous le plancher : « 4-5 lettres » donne [5, 5].
- **Contrat** : `SearchDomainsDto` accepte `minLength` (5 à 12) et `maxLength` (5 à 30), tous deux facultatifs. Le front n'envoie que `minLength`, et seulement si l'utilisateur l'a touché (`wizard.ts:2882`).
- **Consigne de génération** : elle bascule en mode « noms courts » dès que `minLen < 7` (`domain.service.ts:895`). Ce mode cite des exemples de 4 à 5 caractères (« orva », « nyxo »). Le mode normal cite comme « trop courts » des noms de 6 caractères (« trelox », « voxify »).
- **Persistance** : `project.minLength` (INT, défaut 7) et l'état du wizard en `localStorage` (`minLengthTouched`).
- **Écran** : sept blocs `wizard-field` dans `wizard.html:168-443`. Mise en page en styles en ligne, la convention imposée par PrimeNG (CLAUDE.md, « CSS / Styles »).
- **Prix** : le texte du coût (`WIZARD.STEP3.SEARCH_COST_HINT`, « 1 crédit par suggestion trouvée, 10 au maximum ») et le solde (`userService.credits$`) existent déjà, mais seulement à l'étape 3 (`wizard.html:682-699`).

## Goals / Non-Goals

**Goals :**
- Un seul réglage de longueur côté écran : un maximum. Le minimum est une règle du produit, appliquée par le serveur.
- Des bornes calculées à un seul endroit, le serveur. Le front ne fait qu'afficher ce que le serveur appliquera.
- Une étape 2 lisible sans défilement jusqu'au bouton, sur ordinateur, quand « Affiner » est replié.

**Non-Goals :**
- Revoir l'extraction des contraintes par le modèle : `briefMinLength` et `briefMaxLength` restent ce qu'ils sont.
- Changer la tarification, ou le nombre de noms par recherche.

## Decisions

### D1. Longueur : un maximum, un plancher à 6, un défaut à 10

Le réglage propose « Au plus N caractères », N de 6 à 12, plus « sans limite ». La recherche porte sur [plancher, N].

- **Plancher 6.** À 5 caractères, 83 % des .com prononçables sont pris, contre 34 % à 6 (mesure du 01/08/2026 sur 340 noms, `TAKEN_RATE`). Les noms de 6 caractères restent la cible naturelle d'un « nom court ».
  - *Écarté : plancher 5.* C'est l'état actuel ; il produit les recherches sans issue décrites dans la proposition.
  - *Écarté : plancher 7*, l'ancien défaut. Il exclurait d'office les noms de 6 caractères, ceux que demandent les briefs « court ».
- **Défaut 10.** Assez large pour trouver vite, et assez court pour ne pas inciter à le baisser.
  - *Écarté : garder 12.* « Au plus 12 caractères » se lit comme « long », et pousse à resserrer.
  - *Écarté : 8.* Le défaut se trouverait dans la zone étroite, où l'alerte se déclencherait presque aussitôt.
- **Pas d'intervalle à l'écran.** L'utilisateur raisonne en « pas trop long » (décision produit du 31/10/2026).
  - *Écarté : un double sélecteur min–max*, essayé dans la première version de la maquette.

### D2. Bornes du brief : plancher relevé, maximum gardé, minimum gardé au-dessus du plancher

`bornesDeLongueur` devient :

1. Un **maximum de l'écran** (`maxLength`) prime. Le minimum vaut alors `max(plancher, briefMin)` s'il reste sous ce maximum, sinon le plancher.
2. À défaut, un **minimum hérité** (`minLength`, envoyé par un onglet antérieur) est relevé au plancher. Le maximum est celui du brief, sinon le défaut.
3. À défaut, les **bornes du brief**, chacune relevée au plancher : « 4-5 lettres » donne [6, 6], « au moins 8 » donne [8, 10].
4. À défaut, [6, 10].

L'origine (`utilisateur`, `brief`, `defaut`) garde ses trois valeurs.

- *Écarté : honorer un maximum sous le plancher.* C'est le comportement actuel, et une recherche quasi vide payée en temps et en appels au modèle.
- *Écarté : refuser la recherche* en demandant de corriger. L'utilisateur n'a rien fait de faux ; on lui explique l'ajustement plutôt que de le bloquer.
- *Écarté : ignorer le minimum du brief*, au motif que l'écran ne règle plus de minimum. Ce serait contredire une consigne que le brief exprime et que la puce de contraintes montrait jusqu'ici.

### D3. Contrat de l'API : `maxLength` seul, `minLength` toléré

- Le front envoie `maxLength`, et seulement si l'utilisateur l'a touché. « Sans limite » envoie `maxLength: 30`, la borne haute du DTO.
  - *Écarté : ne rien envoyer pour « sans limite ».* L'absence de valeur veut déjà dire « brief ou défaut ».
- `SearchDomainsDto.maxLength` passe à `@Min(6)`.
- `minLength` reste accepté (5 à 12) pour les onglets ouverts avant le déploiement, et il est relevé au plancher.
- **Contrats externes touchés :**
  - **SSE et journaux** : `search_completed` garde `minLengthUsed`, `maxLengthUsed` et `origineDesBornes`. Seules leurs valeurs changent (défaut 6/10 au lieu de 7/12).
  - **Parité des requêtes OpenAI** : la consigne de génération change de texte pour toutes les recherches (bornes et règle du mode court, voir D4). `requetes-openai.spec.ts` est mis à jour en conséquence, et CLAUDE.md le dit.
  - **Nouvel événement** : `wizard_refine_opened` (D8).

### D4. Mode « noms courts » de la consigne : décidé par le maximum

`wantsShort` devient `maxLen <= 7`. C'est l'utilisateur, ou le brief, qui demande court, et non le plancher qui l'impose à tous. Les exemples courts sous le plancher (« orva », « nyxo », « veli », « zuvo », de 4 caractères) sont retirés sans remplaçant. Les contre-exemples « trop courts » ne sont cités que s'ils comptent réellement moins de `minLen` caractères, ce qui exclut « trelox », « voxify » et « namify » à 6.

- *Écarté : garder `minLen < 7`.* Avec le plancher à 6, toutes les recherches passeraient en mode court, avec sa consigne « premium, combinaisons rares ».
- *Écarté : de nouveaux exemples de 6 caractères.* Les exemples de la consigne ressortent tels quels (CLAUDE.md, limite connue du cahier des charges) ; en ajouter aggraverait le problème de diversité, traité par le chantier suivant.

### D5. Persistance : une colonne `project.maxLength`, nullable

`NULL` signifie « non réglé », et la recherche applique alors brief ou défaut. Un projet rouvert ne passe en réglage explicite que si `maxLength` n'est pas `NULL`. `project.minLength` n'est plus écrit ni lu, et sa suppression est reportée. Dans l'état `localStorage`, `minLengthTouched` cède la place à `maxLengthTouched`. Un état ancien, sans cette clé, est traité comme « non réglé ».

- *Écarté : réutiliser `minLength` pour y ranger un maximum.* La colonne mentirait sur son contenu, et les projets existants, à 7 par défaut, deviendraient « au plus 7 », le réglage le plus étroit.
- *Écarté : ne pas persister.* Un projet rouvert reperdrait un réglage choisi, et la recherche suivante changerait de bornes sans prévenir.

### D6. Affichage des bornes : le front reproduit la règle, le serveur la fait foi

La phrase d'aide (« entre 6 et 10 », « commence à 8 ») et le marquage d'origine se calculent dans le wizard, à partir des contraintes extraites et du réglage. Ce calcul copie la règle de D2 dans une fonction pure, `bornesAffichees`, testée sur les mêmes cas que `bornesDeLongueur`.

- *Écarté : un appel serveur pour connaître les bornes.* C'est un aller-retour à chaque changement de réglage, pour une règle de quatre lignes.
- Le risque de divergence est couvert par un test qui fait passer une même table de cas par les deux fonctions (voir Risks).

### D7. Mise en page : trois blocs, un repli, une barre collée

- **Blocs** : des `<section>` avec un titre `h2` et la mise en page en styles en ligne, selon la convention PrimeNG du projet. Les contrôles existants (`p-selectButton`, `p-chip`, `p-select`) sont gardés, déplacés et non réécrits.
- **Repli** : un bouton natif `aria-expanded` et un signal `affinerOuvert`. Le signal survit au va-et-vient entre les étapes 2 et 3 dans la session, mais il n'est pas persisté.
  - *Écarté : `p-accordion`*, dont les styles internes écrasent la mise en page (CLAUDE.md), pour un seul panneau.
- **Barre d'action** : `position: sticky; bottom: 0` dans le conteneur de l'étape.
  - *Écarté : `position: fixed`*, qui recouvre le contenu et les éléments de pied de page sur mobile, et oblige à réserver une marge.
- **Prix** : la barre reprend la clé `SEARCH_COST_HINT` et `credits$`, sans nouvelle source de vérité. Le motif d'indisponibilité (zéro mot-clé) remplace la ligne de prix.

### D8. Mesure : `wizard_refine_opened`

L'événement part par `AnalyticsService.track()` au premier clic d'ouverture, au plus une fois par projet et par session, sans propriété de contenu. Il répond à une question précise : cacher les mots-clés et les inspirations les fait-il disparaître des usages ? Il se lit avec `search_completed`.

- *Écarté : pas d'événement.* On ne saurait pas si le repli a fait perdre des réglages utiles.
- *Écarté : un événement par réglage modifié.* C'est du bruit (CLAUDE.md : « pas au cas où »).

### D9. « Relancer en assouplissant » : le maximum monte

`relaxLengthAndRetry` relevait le minimum de 2, c'est-à-dire qu'il allongeait les noms. Il relève désormais le **maximum** de 2, jusqu'à 12, puis passe à « sans limite ». `no_result_relax_clicked` garde son nom ; sa propriété `from` porte désormais le maximum.

- *Écarté : abaisser le minimum.* Il est déjà au plancher.

### D10. Ordre d'archivage

Le delta `recherche/cahier-des-charges` modifie des exigences qui n'existeront dans `openspec/specs/` qu'à l'archivage de `respecter-le-cahier-des-charges`. Ce chantier-là s'archive donc d'abord ; `openspec archive` refuserait sinon le delta (avertissement relevé par `openspec validate` le 31/10/2026).

## Risks / Trade-offs

- **[Risque] Le front et le serveur divergent sur les bornes affichées** → une table de cas partagée, `web/src/app/components/wizard/bornes-de-longueur.cas.json`, est importée par le test de `bornesAffichees` (Vitest) et lue par `recherche-boucle.spec.ts` via `fs` (Jest). Le builder Angular n'importe pas facilement hors de `web/` ; Jest lit n'importe quel chemin.
- **[Risque] Un brief « 5 lettres » reçoit des noms de 6 caractères** et l'utilisateur le vit comme une désobéissance → la phrase d'explication s'affiche avant la recherche, à côté du réglage. `search_completed` porte `origineDesBornes: 'brief'` et `minLengthUsed: 6`, ce qui permet de compter ces cas.
- **[Compromis] Les mots-clés repliés pourraient être moins revus**, et des mots-clés hors sujet passer inaperçus → le résumé replié les affiche, et `wizard_refine_opened` le mesure.
- **[Risque] La barre collée masque le dernier contrôle sur petit écran** → un espace de la hauteur de la barre est réservé en bas du dernier bloc. C'est vérifié au navigateur à 390 px.
- **[Risque] Un onglet ouvert avant le déploiement envoie `minLength: 5`** → le minimum est accepté puis relevé à 6 (D3), sans erreur 400.

## Migration Plan

1. Appliquer `api/migrations/2026-11-01-longueur-maximale-du-projet.sql` (`ADD COLUMN IF NOT EXISTS maxLength INT NULL`) **avant** de déployer l'image. Retour arrière : `ALTER TABLE project DROP COLUMN maxLength`.
2. Déployer l'API et le web ensemble, sur la même image. Un ancien front contre la nouvelle API fonctionne (D3) ; un nouveau front contre l'ancienne API verrait `maxLength: 6` accepté, mais avec l'ancien plancher.
3. Retour arrière de l'image : l'ancienne API ignore la colonne `maxLength`.

## Open Questions

- Le seuil de l'alerte « plage étroite » (aujourd'hui fixé à 7 au plus) est à recalibrer d'après `search_completed` : part des recherches à `maxLengthUsed <= 7` qui finissent en `stopReason: time`. Ce réglage change une constante, pas le comportement spécifié.
