# Design

## Context

Voir proposal.md, section Why. Les jetons (`tokens.css`, `theme.css`, preset de `app.config.ts`) sont bons et commentés, contrastes compris. Ce qui manque, c'est une règle d'emploi et un contrôle. Le web n'a aucun test (`ng test` échoue faute de spec) : un contrôle qui exigerait `npm ci` et Angular coûterait plusieurs minutes par PR.

## Goals / Non-Goals

**Goals :**
- Une référence unique, courte, que tout chantier d'interface cite.
- Qu'aucune PR ne puisse ajouter une valeur en dur sans que la CI le dise.
- Que la dette existante ne puisse que baisser.

**Non-Goals :**
- Corriger la dette existante (proposal, hors périmètre).

## Decisions

### D1. Le document vit dans `docs/`, l'obligation dans `openspec/specs/`

`docs/systeme-de-design.md` porte le contenu : jetons, composants, voix, écarts. La capacité OpenSpec `systeme-de-design` ne porte que les obligations vérifiables, comme jetons seuls, cliquet, double thème et mise à jour du document.
- **Écarté : tout mettre dans une spec OpenSpec.** Le format exigence/scénario convient mal à un tableau de rôles de couleur, et chaque nouveau composant demanderait un delta, puis un archivage, pour une ligne de documentation.

### D2. Un cliquet par fichier, plutôt qu'une interdiction ou un seuil global

Le script compte par fichier et par mesure : couleurs, styles en ligne, `font-size` en px, `!important`. Il échoue sur toute hausse, et aussi sur toute baisse non reportée dans la référence.
- **Écarté : interdire tout de suite.** Il faudrait corriger 677 occurrences avant de pouvoir livrer quoi que ce soit.
- **Écarté : un seuil global.** Un nettoyage dans `admin-*` ouvrirait de la marge pour une régression dans le wizard, sans que rien ne le signale.
- **Écarté : ignorer les baisses.** La marge regagnée resterait disponible pour la régression suivante. L'échec sur baisse coûte une commande, `just design-resserrer`.
- Le script n'abaisse jamais la référence de lui-même en CI, et ne la relève jamais. Un relèvement est une édition à la main, visible dans le diff et justifiée dans `design.md`.

### D3. Des expressions régulières, pas stylelint ni ESLint

La majorité des gabarits sont en ligne dans des `.ts` : 10 composants `content/`, tout `admin/` et `app.ts`. Stylelint ne lit pas ces chaînes, et `@angular-eslint/template` demanderait l'installation complète du web en CI. Le script lit `.css`, `.html` et `.ts`, sans dépendance, en moins d'une seconde.
- Faux positifs et faux négatifs acceptés : un `#abc` dans une chaîne non CSS serait compté. Les commentaires sont retirés avant le comptage (`/* */`, `<!-- -->`, `//` en début de ligne).
- `[style.prop]="…"` n'est pas compté. Une liaison d'une seule propriété porte une valeur calculée (largeur de progression, opacité) qu'aucun jeton ne remplace. Une couleur écrite dedans reste comptée comme couleur.
- **Exemptés**, parce que c'est là qu'une valeur doit naître : `styles/tokens.css`, `styles/theme.css`, `styles/fonts.css`, `app/app.config.ts`.

### D4. Le handoff descend au rang de source historique

Il reste la référence visuelle des écrans. Là où il contredit les jetons ou CLAUDE.md, il a tort : Tailwind, rapport offert, contraste de `#0d9a63`.
- **Écarté : corriger le handoff.** C'est un livrable daté, et le réécrire effacerait ce qui avait été décidé à l'époque.

### D5. Deux points de rupture, en règle plutôt qu'en jeton

Une variable CSS ne s'emploie pas dans une media query. Le document fixe donc 640 px et 900 px, plus `pointer: coarse`. Les neuf autres valeurs deviennent des écarts.
- **Écarté : `@custom-media`.** Il demanderait un plugin PostCSS que le build Angular n'a pas.

### D6. La règle des styles en ligne est inversée dans CLAUDE.md

Elle partait d'un Tailwind absent. PrimeFlex étant en `!important`, un utilitaire PrimeFlex ou une classe de la feuille du composant suffit, et un composant PrimeNG se retouche par `styleClass` ou `pt`.
- **Écarté : garder l'ancienne règle pour l'intérieur des composants PrimeNG.** Elle contredirait le cliquet.

## Contrats externes

Il n'y a aucun changement d'API, d'événements SSE ou de journalisation. Le changement porte sur la CI : un job requis de plus sur les PR vers `main`.

## Risks / Trade-offs

- **Le cliquet ne voit pas les doublons de composants.** Un huitième bouton principal écrit sur les jetons passerait. Pour ce cas, ce sont les règles OpenSpec (décision pour tout composant nouveau) et le modèle de PR qui tiennent.
- **Les mesures sont des motifs textuels.** Un contournement délibéré reste possible, par exemple une couleur construite par concaténation. Le contrôle vise la dérive par inadvertance, pas la fraude.
