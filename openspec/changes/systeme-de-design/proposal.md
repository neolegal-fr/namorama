# Proposal

## Why

La refonte a laissé des jetons solides — palette `--nm-*` par surface, rôles `--nm-app-*` clair/sombre/système, preset PrimeNG mesuré AA — mais aucune règle qui oblige à s'en servir. Relevé du 31/10/2026 sur `main` (`ff35a8d`), hors fichiers de jetons et preset :

| Dérive | Occurrences | Principaux fichiers |
|---|---|---|
| Attributs `style="…"` statiques ou `[style]`/`[ngStyle]` | 437 | `wizard.html` 207, `admin-users.component.ts` 56, `app.ts` 55 |
| Couleurs en dur (`#hex`, `rgb()`, `hsl()`) | 184 | `admin-*` ~105, `wizard.ts` 16, `verifier-disponibilite-nom-de-marque.ts` 12, `styles.css` 12 |
| `font-size` en px hors échelle | 32 | `landing.css` 11, `results-grid.css` 9 |
| `!important` | 24 | `styles.css` 12, `wizard.css` 10 |

Les composants se dédoublent : sept implémentations du bouton principal (`.nm-btn-primary`, `.nm-btn--accent`, `.rg-btn--buy`, `.rl-btn`, `.report-cta`, `.report-btn`, `.vd-go`) et cinq jeux de classes de verdict. « Non vérifiable » est ambre dans la grille (`results-grid.css`, `.rg-v--unknown`) et gris dans le rapport (`brand-report-view.css`, `.rv-badge--unknown`), au mépris de la règle des trois états.

Trois causes, lisibles dans le dépôt :

- **CLAUDE.md prescrivait les styles en ligne** pour la mise en page (section « CSS / Styles »), au motif que « PrimeNG écrase les classes Tailwind ». Or Tailwind n'est pas installé : les utilitaires sont ceux de PrimeFlex 4, en `!important` (`web/src/styles/tokens.css:3-10`). C'est l'origine des 207 `style=` du wizard.
- **Le handoff de la refonte fait office de référence**, alors qu'il est périmé sur des points de fond : Tailwind, un rapport offert chaque mois (retiré le 20/08/2026, CLAUDE.md), `#0d9a63` donné AA sur blanc (3,61:1 mesuré).
- **Rien ne contrôle.** Aucun test web, et la CI ne regarde que l'API.

## What Changes

- **Un document de référence, `docs/systeme-de-design.md`** : les règles (§1), les deux univers éditorial et applicatif (§2), la voix (§3), les fondations (§4), les composants canoniques (§5), le modèle de crédits à l'écran (§6), le mobile (§7), l'accessibilité (§8), la confidentialité (§9) et les écarts connus, chiffrés (§10). L'ordre de foi y est posé : jetons > ce document > handoff.
- **Un contrôle à cliquet, `web/scripts/verifier-design.mjs`**, sans dépendance, avec sa référence `web/design-reference.json`. Il fige les 677 valeurs en dur héritées, fichier par fichier, refuse toute hausse et exige qu'on resserre la référence après un nettoyage. Recettes `just design-check` et `just design-resserrer`, et job CI « Système de design » sur chaque PR, dont dépend l'image web.
- **Les règles d'OpenSpec l'imposent à chaque chantier** (`openspec/config.yaml`) : une ligne « Interface » dans *Impact*, une décision pour tout composant nouveau ou écart, une vérification au navigateur en clair et en sombre, à 390 px et sur bureau, et `just design-check` en fin de groupe.
- **CLAUDE.md et le README corrigés** : stack réelle (PrimeFlex, pas Tailwind), règle des styles en ligne remplacée par un renvoi au système de design, contrôle exigé y compris pour les retouches faites hors OpenSpec.
- **Un modèle de PR** avec la liste de contrôle de l'interface.

Hors périmètre :

- Résorber les écarts du §10, c'est-à-dire fusionner les boutons et les verdicts, vider le wizard de ses styles en ligne ou réaligner « non vérifiable » dans le rapport. Chacun sera un chantier à part, que le cliquet rend mesurable.
- Retirer PrimeFlex ou installer Tailwind.
- Le thème Keycloak et les gabarits d'e-mail, qui ne sont pas couverts par le contrôle.
- Un catalogue visuel des composants (Storybook ou équivalent).

## Impact

- **Interface** : aucun pixel ne change. Le chantier crée les §1 à §10 de `docs/systeme-de-design.md`.
- **CI** : nouveau job `design-web`. `build-web` dépend désormais de `[test-api, design-web]`.
- **Fichiers** : `docs/systeme-de-design.md`, `web/scripts/verifier-design.mjs`, `web/design-reference.json`, `justfile`, `.github/workflows/docker-publish.yml`, `.github/pull_request_template.md`, `openspec/config.yaml`, `CLAUDE.md`, `README.md`.
