# Proposal

## Why

Les articles du blog sont illisibles pour tout visiteur dont le système est en mode
sombre. `ThemeService` pose `data-theme="dark"` dès que `prefers-color-scheme` est
sombre (`web/src/app/services/theme.ts:57`), le fond de page bascule, mais le texte des
articles ne suit pas : `.article` et ses titres sont colorés par la palette PrimeNG
(`var(--p-surface-900)`, `--p-surface-700`, …, `web/src/styles.css:389-487`).
Le preset donne à ces couleurs des valeurs sombres quel que soit le thème.

Contrastes mesurés le 23/11/2026 sur `/namorama-vs-namelix` (Chrome, schéma de couleur
du système), seuil WCAG AA à 4,5:1 :

| Élément | Sombre | Clair |
|---|---|---|
| Titre H1, titres H2 et H3 | **1,07:1** | 17,8:1 |
| Titres du bloc « trois risques » | **1,04:1** | 18,8:1 |
| Chapeau | **1,94:1** | 7,3:1 |
| Cellules de tableau | **1,34:1** | 11,6:1 |
| Cellule « oui » (`.yes`) | 5,4:1 | **3,32:1** |
| Cellule « non » (`.no`) | 6,1:1 | **1,98:1** |

- Le défaut touche les 22 articles depuis leur création ; la migration en Markdown
  (`articles-en-markdown`) l'a laissé tel quel, puisqu'elle devait garder le rendu.
- L'appel à l'action (`article-cta.ts:15-24`) reste un encart vert clair en mode sombre :
  ses couleurs sont en styles en ligne, sur la palette PrimeNG.
- Le système de design range déjà les pages SEO dans l'univers **applicatif, qui suit le
  thème**, avec les rôles `--nm-app-*` uniquement (docs/systeme-de-design.md §2), et
  interdit `var(--p-…)` dans un composant maison (§4, Couleur). Ce chantier met ces pages
  en conformité.
- En clair, les cellules « oui » et « non » des comparatifs sont sous le seuil AA.

## What Changes

- Les styles `.article` de `styles.css` passent sur les rôles `--nm-app-*` : texte,
  titres, chapeau, signature, fil d'Ariane, tableau, cellules oui/non.
- `app-article-cta` perd ses styles en ligne au profit d'une feuille de composant sur les
  rôles `--nm-app-accent-surface`, `--nm-app-accent-border` et les rôles de texte.
- Le bloc « trois risques » n'est pas modifié : ses propres styles emploient déjà les
  rôles, et ses titres héritent des règles `.article h2` et `h3`.

Hors périmètre :

- L'accueil éditorial, qui ne bascule pas par conception (§2).
- Le vérificateur interactif de `/verifier-disponibilite-nom-de-marque` : ses composants
  propres (`.checker*`) ne sont pas revus ici, seul le texte d'article de la page l'est.
- Aucun sélecteur de thème sur les pages publiques : la préférence du système reste
  appliquée comme aujourd'hui.

## Impact

- `web/src/styles.css` (section « Pages de contenu / articles SEO »),
  `web/src/app/components/content/article-cta.ts`.
- `web/design-reference.json` : resserré (styles en ligne et couleurs PrimeNG en moins).
- Interface : s'appuie sur docs/systeme-de-design.md §2 (deux univers ; pages SEO
  applicatives), §4 Couleur (rôles applicatifs ; deux verts non interchangeables) et §8
  (accessibilité). Aucun jeton ni motif nouveau.
