# Design

## Context

Le pourquoi est dans proposal.md, les exigences dans
`specs/recherche/ecran-de-cadrage/spec.md`.

- **Style** (`wizard.html:229-241`) : un `p-selectButton` sur `TYPE_DE_NOM_OPTIONS`,
  suivi d'**une** ligne d'aide, `NAME_TYPE_HINT_<TYPE choisi>`. Les trois textes existent
  déjà en fr et en en, et chacun porte un exemple.
- **Critère** (`wizard.html:308-313`) : un `p-selectButton` sur `matchOptions()`, affiché à
  partir de deux extensions. Une ligne d'aide n'apparaît que pour `all`
  (`MATCH_ALL_HINT`).
- **Feuille du composant** : `wizard.css` dépasse déjà son budget d'avertissement de
  919 octets (16,92 ko pour 16 ko). C'est un avertissement, pas une erreur, mais chaque
  octet ajouté s'y compte.

## Goals / Non-Goals

**Goals:**
- Comparer les trois styles sans cliquer.
- N'ajouter ni composant, ni jeton, ni texte de style : seulement une clé, pour le
  critère « au moins une ».

**Non-Goals:**
- Remplacer le `p-selectButton` par des cartes de choix illustrées, ce qui serait une
  refonte.

## Decisions

### D1. Une liste de trois descriptions sous le contrôle, la courante en `--nm-app-text`

Sous le `p-selectButton`, une liste `<ul class="styles-decrits">` porte trois `<li>`.
Chacun commence par le libellé du style en gras (`NAME_TYPE_<TYPE>`), suivi de sa
description (`NAME_TYPE_HINT_<TYPE>`). Les styles non choisis sont en
`--nm-app-text-2`, le style courant en `--nm-app-text`, avec `aria-current="true"`. Le
contrôle de choix reste le seul élément interactif : les lignes ne sont pas cliquables,
et la spécification n'exige pas qu'elles le soient.

- *Rejeté : rendre chaque ligne cliquable.* Cela ferait deux contrôles pour un même
  choix, et le contrôle segmenté du §5 deviendrait redondant.
- *Rejeté : des cartes de choix, avec la description dans chaque option.* C'est un
  nouveau motif (§1, règle 4), et une refonte du bloc que le chantier
  `refondre-l-ecran-de-cadrage` vient de livrer.
- *Rejeté : une info-bulle par option.* Elle ne se voit pas sur mobile, où se trouvent
  4 des 5 visiteurs venus de ChatGPT dans les sessions enregistrées.

### D2. Une phrase par critère, avec la même mise en forme que l'existante

La ligne existante devient `('WIZARD.STEP2.MATCH_' + (matchMode() === 'all' ? 'ALL' :
'ANY') + '_HINT') | translate`. Ses styles en ligne passent dans une classe de
`wizard.css` (`.critere-aide`), comme le demande le §1, règle 3. La nouvelle clé est
`MATCH_ANY_HINT`.

- *Rejeté : expliquer les deux critères en permanence.* Ce serait deux phrases sous un
  contrôle à deux options. La phrase du choix courant suffit, et elle change avec lui.

## Risks / Trade-offs

- **L'écran s'allonge de deux lignes**, surtout à 390 px. → Les descriptions sont des
  textes d'aide en `--nm-text-ui-sm`. La vérification se fait à 390 px, et la barre
  d'action collée en bas reste accessible.
- **L'effet est incertain** : 3 ou 4 sessions sur 16. → Suivi après déploiement : on
  compte dans les sessions enregistrées les bascules de style suivies d'un retour au
  premier choix.
