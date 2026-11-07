# Proposal

## Why

Les sessions enregistrées du 31/10 au 07/11/2026 montrent qu'à l'écran de cadrage, des
visiteurs **basculent un réglage pour lire ce qu'il veut dire**. Les preuves sont
minces (3 ou 4 sessions sur 16), d'où une retouche ciblée plutôt qu'une refonte
(décision du 07/11/2026).

- **Style.**
  - Constat : trois sessions basculent « Inventés », « Inventés + descriptifs » et
    « Inventés + culturels » en quelques secondes avant de revenir au premier choix.
    L'une clique deux fois sur la phrase d'aide, comme si elle était un bouton.
  - Cause : seule la description de l'option **sélectionnée** est affichée
    (`wizard.html:240`, clé `NAME_TYPE_HINT_<TYPE>`). Pour comparer, il faut donc
    cliquer.
- **Critère de disponibilité.**
  - Constat : trois sessions passent de « Toutes les extensions disponibles » à « Au
    moins une extension disponible », puis reviennent.
  - Cause : seul le choix « toutes » a une explication (`wizard.html:310`,
    `MATCH_ALL_HINT`). « Au moins une » ne dit pas ce qu'elle change.
- **Longueur : pas de défaut reproduit.** Vérifié au navigateur le 07/11/2026, le
  sélecteur s'ouvre au premier clic, sur sa valeur comme sur son icône. Les clics
  observés sur le texte voisin (« Au plus », phrase d'aide) relèvent de la lecture. On
  n'y touche pas.

## What Changes

- **Les trois styles décrits ensemble**, sous le contrôle de choix : une ligne par
  style, avec son exemple, celle du style choisi mise en avant. On lit avant de
  choisir, au lieu de choisir pour lire. Les textes existants (`NAME_TYPE_HINT_*`)
  sont repris tels quels.
- **Les deux critères expliqués.** Une phrase pour « Au moins une extension
  disponible » (nouvelle clé `MATCH_ANY_HINT`), comme il en existe une pour « Toutes ».
  Elle s'affiche pour le choix courant.

**Hors périmètre :**
- le sélecteur de longueur, sans défaut reproduit ;
- l'ordre et le regroupement des blocs, fixés par `refondre-l-ecran-de-cadrage` ;
- le choix de la demande de compte avant la recherche, à rediscuter une fois les canaux
  mesurés ;
- les libellés des options eux-mêmes : la spécification de `refondre-l-ecran-de-cadrage`
  les fixe.

## Capabilities

### New Capabilities
_(aucune)_

### Modified Capabilities
- `recherche/ecran-de-cadrage` : ajout de deux exigences (styles décrits ensemble,
  explication de chaque critère). Cette capacité naît de l'archivage de
  `refondre-l-ecran-de-cadrage`, qui doit donc être archivé **avant** celui-ci.

## Impact

- **Web** :
  - l'étape 2 de `wizard.html` ;
  - une classe dans `wizard.css` ;
  - une clé i18n par langue (`MATCH_ANY_HINT`, en fr et en en).
- **API** : aucun changement.
- **Contrat** : aucun ; aucun événement ajouté ni modifié.
- **Interface** : `docs/systeme-de-design.md` §1, règles 2, 3, 4, 6 et 7 ; §3, la voix ;
  §4, les rôles de couleur `--nm-app-text-2` et `--nm-app-text`. Le contrôle de choix
  reste le `p-selectButton` existant. Les descriptions sont du texte d'aide, avec les
  jetons existants : ni composant ni jeton nouveau.
- **Docs** : aucune section de CLAUDE.md ne décrit ces textes d'aide.
