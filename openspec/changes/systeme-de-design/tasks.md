# Tasks

## 1. Référence et contrôle

- [x] 1.1 Rédiger `docs/systeme-de-design.md` §1 à §10, à partir de `tokens.css`, `theme.css`, `components.css`, du preset, du handoff et de `docs/AUDIT-coherence-pp.md`, chiffres du §10 relevés le 31/10/2026. Vérification : chaque jeton et chaque classe cités existent (`grep` sur `web/src/styles/`).
- [x] 1.2 Écrire `web/scripts/verifier-design.mjs` (D2, D3) et initialiser `web/design-reference.json`. Vérification : `just design-check` passe sur `main`, avec 677 occurrences héritées. Ajouter `color:#ff0000` à `results-grid.css` le fait échouer (« 0 → 1 », exit 1). Retirer un `!important` de `styles.css` le fait échouer en demandant le resserrement (« 12 → 11 »). Les deux fichiers restaurés, il repasse.
- [x] 1.3 Ajouter les recettes `design-check` et `design-resserrer` au `justfile`, et le job `design-web` à `docker-publish.yml`, dont `build-web` dépend. Vérification : `just design-check` passe en local et le YAML se charge (`yaml.safe_load`). Le job doit être vert sur la PR de ce chantier, case cochée après lecture du résultat de la CI.

## 2. Règles d'application

- [x] 2.1 Ajouter à `openspec/config.yaml` le contexte du système de design et les règles `proposal`, `design`, `tasks` et `apply`. Vérification : le YAML se charge, et `openspec instructions proposal --change systeme-de-design` restitue les nouvelles règles.
- [x] 2.2 Corriger CLAUDE.md : stack (PrimeFlex), arborescence, section « Système de design » à la place de « CSS / Styles » (D6), exigence du contrôle pour les retouches hors OpenSpec. Corriger aussi la stack dans le README. Vérification : `grep -n Tailwind CLAUDE.md README.md` ne trouve plus que la mention « pas Tailwind ».
- [x] 2.3 Ajouter `.github/pull_request_template.md` avec la liste de contrôle de l'interface. Vérification : la PR de ce chantier s'ouvre avec ce modèle.

## Workflow follow-up

- [ ] 3.1 Après fusion, ouvrir les chantiers de résorption du §10, dans cet ordre : verdicts unifiés (dont « non vérifiable » ambre dans le rapport), bouton principal unique, styles en ligne du wizard. Chacun resserre la référence.
- [ ] 3.2 Archiver ce chantier (`openspec archive systeme-de-design`), puis vérifier que `openspec/specs/systeme-de-design/` existe et que `openspec validate --all` passe.
