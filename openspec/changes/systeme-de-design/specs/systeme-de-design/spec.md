# Spec Delta

## Purpose

Garantir que toute évolution ou correction de ce que voit l'utilisateur suit le système de design de `docs/systeme-de-design.md`, et que les valeurs écrites en dur dans `web/` ne puissent que diminuer.

## ADDED Requirements

### Requirement: Référence unique du système de design
Le dépôt MUST tenir dans `docs/systeme-de-design.md` les règles, les fondations, les composants canoniques, la voix et les écarts connus de l'interface. En cas de conflit, les fichiers de jetons (`web/src/styles/tokens.css`, `theme.css`, preset de `app.config.ts`) SHALL primer sur ce document, et ce document sur le handoff de la refonte.

#### Scenario: Handoff contredit
- **WHEN** le handoff annonce un rapport offert chaque mois, alors que CLAUDE.md dit que cette offre a été retirée le 20/08/2026
- **THEN** l'écran suit `docs/systeme-de-design.md` §6 : toute dépense de rapport se confirme

### Requirement: Chantier d'interface rattaché au système de design
Une proposition OpenSpec qui touche ce que voit l'utilisateur MUST nommer, dans *Impact*, les sections de `docs/systeme-de-design.md` sur lesquelles elle s'appuie. Un composant, un jeton ou un motif nouveau, ou un écart assumé, SHALL faire l'objet d'une décision dans `design.md` et d'une mise à jour de `docs/systeme-de-design.md` dans le même chantier.

#### Scenario: Nouveau bouton
- **WHEN** un chantier a besoin d'un bouton d'achat
- **THEN** il emploie `.nm-btn-primary`, ou consigne dans `design.md` pourquoi ce bouton ne convient pas et ajoute la variante au §5

### Requirement: Aucune valeur en dur ajoutée dans web/
Le contrôle `web/scripts/verifier-design.mjs` MUST échouer quand un fichier de `web/src`, hors fichiers de jetons et preset, compte plus que sa référence de l'une de ces valeurs : couleurs en `#hex`, `rgb()` ou `hsl()` ; styles en ligne `style="…"`, `[style]` ou `[ngStyle]` ; `font-size` en px ; `!important`. Un fichier absent de la référence SHALL partir de zéro.

#### Scenario: Couleur ajoutée
- **WHEN** une PR ajoute `color: #ff0000` à `results-grid.css`
- **THEN** le job CI « Système de design » échoue en nommant le fichier et la mesure, de 0 à 1

#### Scenario: Liaison calculée
- **WHEN** un gabarit lie `[style.width.%]="progression"`
- **THEN** le contrôle ne la compte pas

### Requirement: Le cliquet ne se desserre pas
Quand un fichier compte moins que sa référence, le contrôle MUST échouer jusqu'à ce que la référence soit resserrée par `just design-resserrer`. Ce resserrement SHALL ne jamais relever une valeur de la référence.

#### Scenario: Nettoyage
- **WHEN** un chantier retire un `!important` de `styles.css`, qui passe de 12 à 11
- **THEN** le contrôle échoue et demande `just design-resserrer`
- **AND** une fois la référence resserrée et committée, le contrôle passe

### Requirement: Vérification au navigateur dans les deux thèmes et deux largeurs
Une tâche qui modifie un écran applicatif MUST se vérifier au navigateur, avec des données réelles, en thème clair et en thème sombre, à 390 px de large et sur bureau.

#### Scenario: Retouche de la grille de résultats
- **WHEN** un chantier modifie la carte de résultat
- **THEN** sa tâche note les quatre vérifications : clair et sombre, 390 px et bureau

### Requirement: Les retouches hors chantier y sont soumises aussi
Une modification de `web/` faite hors OpenSpec, correctif urgent compris, MUST suivre `docs/systeme-de-design.md` et passer le même contrôle sur sa PR.

#### Scenario: Correctif urgent
- **WHEN** un correctif de `wizard.html` est livré sans chantier
- **THEN** le job « Système de design » de sa PR passe, ou le correctif emploie un jeton à la place de la valeur en dur
