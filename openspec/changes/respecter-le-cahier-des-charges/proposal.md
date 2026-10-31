# Proposal

## Why

L'analyse des 133 projets créés en 90 jours (relevé du 31/10/2026, comptes mesurés) montre que les utilisateurs écrivent un **cahier des charges du nom**, pas seulement la description d'une activité. 18 projets fixent une longueur, 18 des mots ou terminaisons à éviter, 13 des marques de référence, et d'autres imposent un mot, un prénom ou une sonorité. Les noms rendus contredisent ces demandes, et la plupart des comptes repartent après une seule recherche : 59 projets sur 133 s'arrêtent à 10 noms ou moins.

| Demande | Noms rendus |
|---|---|
| « Nom court : 4-5 lettres » | `duopawear`, `leashluxe`, `collaroom` |
| « 6 lettres exactement » | `referencementstrategie`, `conseilmarketingdigital` |
| « Avoid descriptive words » | `nominventionfrance`, `marqueinternationale` |
| « sans terminaisons type 'ora' ou 'ia' » | `velmira`, `premina` |

Le code explique chacun de ces écarts.

- **La longueur maximale du brief est élargie.** Le serveur la porte au moins à « minimum + 3 » dès que l'interface envoie une longueur minimale, ce qu'elle fait à chaque recherche. Le front ne reprend du brief que le minimum.
- **Les styles descriptif et culturel sont activés d'office.** C'est le cas pour tout navigateur réglé sur une région reconnue (fr, es, it, de…), soit la majorité des utilisateurs. Un tiers des noms passe alors en style « descriptif », exempté du plafond de longueur, ce qui produit `microcrecheprivee` ou `hundetrainingwuppertal`. Le brief ne peut pas les désactiver.
- **Les terminaisons interdites et les mots imposés ne sont pas compris.** Ni l'extraction des contraintes ni le filtre ne savent ce qu'est « sans -ora » ou « un nom composé avec BLOOM ».
- **Les mots-clés reprennent le vocabulaire du nommage.** Ils sont tirés de toute la description. Quand celle-ci parle du nom (« marque premium, mémorable, facile à prononcer »), les mots-clés deviennent « marque, nom, premium », et les noms suivent : `marqora`, `nomvera`, `markio`, `nameverse`, `marcaform`. C'est le cas dans au moins 4 projets.
- **Une phrase saisie dans le champ de test manuel devient une liste de noms.** Le champ découpe sur les espaces, et chaque mot est ajouté aux favoris d'office. Un projet affiche ainsi `mon`, `porte`, `choix`, `se`, `sur` en favoris, à côté du nom réellement visé.

## What Changes

- **Le brief fixe la longueur.**
  - Une longueur minimale ou maximale demandée dans la description est appliquée telle quelle aux noms inventés, et n'est plus élargie.
  - Elle n'est pas appliquée quand l'utilisateur a réglé la longueur lui-même, ou quand elle tombe sous le plancher technique, qui reste à 5 caractères.
  - Le maximum du brief est repris par l'interface, comme le minimum l'est déjà.
- **Les terminaisons interdites et les mots imposés sont compris.**
  - L'extraction des contraintes reconnaît les terminaisons à éviter, les mots ou racines à inclure, et le type de nom attendu (inventé, descriptif, indifférent).
  - Ces contraintes sont appliquées comme filtres après génération, pas seulement demandées au modèle.
- **Le type de nom devient un choix de l'utilisateur.**
  - Les styles descriptif et culturel ne sont plus activés d'office selon la région : par défaut, les noms sont inventés.
  - L'étape 2 propose un choix explicite (inventés, descriptifs, les deux), pré-sélectionné d'après le brief.
  - Quand une recherche rend moins que demandé, ou qu'on rejette des noms sans en aimer aucun, une suggestion propose en un clic d'inclure les noms descriptifs, plus faciles à trouver libres.
- **Les contraintes comprises s'affichent à l'étape 2.** Exemple : « 4 à 6 lettres · éviter -ora, -ia · inclure “bloom” · noms inventés ». L'utilisateur peut corriger une contrainte mal comprise avant de payer une recherche.
- **Les mots-clés ne décrivent que l'activité.** Ce qui porte sur le nom lui-même (longueur, style, ton, marques à imiter, consignes données à une IA) n'en fait plus partie.
- **Le champ de test manuel lit une liste de noms, pas une phrase.**
  - Les noms se séparent par des virgules, des points-virgules ou des retours à la ligne.
  - Une entrée de deux mots devient un nom collé (« neo legal » → `neolegal`).
  - Une entrée qui a la forme d'une phrase est refusée, avec un message qui explique comment saisir des noms.
- **La mesure suit.** `search_started` porte le résumé des contraintes appliquées, et `search_completed` le nombre de noms écartés par elles. C'est ce qui permettra de vérifier l'effet du chantier.

Hors périmètre, à traiter dans des chantiers suivants :

- réduire la répétition des sonorités (-ora, -ix, -iva) et des noms déjà proposés à d'autres projets ;
- guider les descriptions trop courtes, ou orienter vers « tester un nom » une saisie qui est une liste de noms ;
- choisir les extensions d'après la langue de la description.

## Capabilities

### New Capabilities

- `recherche/cahier-des-charges` : ce que le brief impose aux noms (longueur, terminaisons, mots à éviter ou à inclure, type de nom), la priorité entre brief et réglages, l'affichage des contraintes comprises, et la suggestion d'élargir aux noms descriptifs.
- `recherche/mots-cles` : ce que décrivent les mots-clés proposés à l'étape de cadrage, et ce qu'ils excluent.
- `recherche/test-manuel` : comment une saisie dans le champ de test manuel devient des noms à vérifier.

### Modified Capabilities

Aucune. Les spécifications des chantiers précédents ne sont pas encore archivées dans `openspec/specs/`.

## Impact

- **API**
  - `api/src/domain/domain.service.ts` : `extractNamingConstraints` (nouvelles contraintes), filtre de `generateDomainIdeas`, priorité de la longueur dans `findAvailableDomains`, consigne de `generateKeywords`.
  - `api/src/common/modele-ia/schemas.ts` : schéma des contraintes enrichi. Le test de parité des schémas doit suivre.
  - `api/src/domain/dto/search-domains.dto.ts` : champ `maxLength` et type de nom.
  - `api/src/domain/domain.controller.ts` : champs des événements `search_started` et `search_completed`.
- **Front**
  - `web/src/app/components/wizard/wizard.ts` et `wizard.html` : défauts régionaux, choix du type de nom, contraintes affichées, suggestion d'élargissement, `addManualDomain`.
  - `web/public/assets/i18n/{fr,en}.json` : nouveaux libellés.
- **Contrat API** : `POST /domain/constraints` rend de nouveaux champs, et `search/stream` accepte `maxLength`. Les deux ajouts sont rétrocompatibles.
- **Coût** : un filtre plus strict écarte plus de noms, donc plus de tentatives sur certaines recherches. Le budget de temps du chantier « 10 de plus » les borne. L'extraction des contraintes reste un seul appel au modèle simple.
- **Données** : aucune migration.
