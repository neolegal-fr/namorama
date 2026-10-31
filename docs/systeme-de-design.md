# Le système de design de Namorama

> Relevé sur `main` au commit `ff35a8d`, le 31/10/2026. Il décrit `web/` telle qu'elle est —
> Angular 21, PrimeNG 21 sur un preset Aura retouché, utilitaires **PrimeFlex 4** (pas
> Tailwind : il n'est pas installé), polices Space Grotesk et IBM Plex Sans — et ce que
> tout écran neuf ou retouché doit suivre.

**Ordre de foi.** Les valeurs vivent dans `web/src/styles/tokens.css` (palette),
`web/src/styles/theme.css` (rôles clair/sombre) et le preset de `web/src/app/app.config.ts` :
**ils font foi**. Ce document dit à quoi chaque jeton sert et ce qu'on en fait. Le handoff
`docs/design/design_handoff_namorama_refonte/` est la source **historique** de la refonte :
il reste la référence visuelle des écrans, mais là où il contredit ce document ou CLAUDE.md
(Tailwind, rapport offert chaque mois, `#0d9a63` « AA »), il est périmé.

## 1. Les règles — quand un écran change

Elles s'appliquent à tout ce que l'utilisateur voit : écran, composant, texte, toast,
dialogue, e-mail, page SEO. L'administration (`/admin`) y est soumise aussi, avec une seule
tolérance : la densité (§7).

1. **On lit ce document avant d'écrire le chantier.** La proposition OpenSpec nomme, dans
   *Impact*, les sections sur lesquelles elle s'appuie (`openspec/config.yaml`).
2. **Des jetons, jamais des valeurs.** Une couleur, une taille de texte, un rayon, une
   ombre, une durée s'écrivent `var(--nm-app-…)` ou `var(--nm-…)`. Une valeur qui manque
   **devient un jeton** dans `tokens.css` ou `theme.css`, dans le même chantier, avec son
   contraste mesuré en commentaire.
3. **Pas de style en ligne.** La mise en page va dans la feuille du composant (une classe)
   ou dans un utilitaire PrimeFlex. Seule exception : une liaison d'une propriété à une
   valeur **calculée** (`[style.width.%]="progression"`).
4. **Le composant existant d'abord.** Avant d'écrire un bouton, un verdict, un filtre, on
   reprend celui du §5. Un composant nouveau, ou une variante, s'ajoute au §5 **dans le même
   chantier**, avec la décision et l'option écartée dans `design.md`.
5. **Un seul bouton principal par zone.** Les autres actions sont secondaires ou tertiaires.
6. **Les deux thèmes, deux largeurs.** Un écran applicatif se vérifie au navigateur, avec des
   données réelles, en clair **et** en sombre, à 390 px **et** sur bureau. La compilation ne
   dit rien de ce qu'on voit.
7. **Le texte passe par l'i18n**, en français et en anglais (`web/public/assets/i18n/`), et
   suit la voix du §3.
8. **`just design-check` passe.** Le contrôle `web/scripts/verifier-design.mjs` tourne aussi
   en CI sur chaque PR (job « Système de design ») et bloque l'image web. C'est un
   **cliquet** : il fige, fichier par fichier, les valeurs en dur héritées (677 au
   31/10/2026, voir §10) et refuse toute hausse — couleur `#hex`/`rgb()`/`hsl()`, `style="…"`
   ou `[ngStyle]`, `font-size` en px, `!important`. Un fichier nouveau part de zéro.
   - Un chantier qui **retire** des valeurs en dur lance `just design-resserrer` et committe
     `web/design-reference.json` : le contrôle échoue tant que la marge regagnée n'est pas
     rendue.
   - **Relever** la référence ne se fait qu'à la main, justifié par une décision de
     `design.md`. Le script ne le fait jamais.
9. **Un écart corrigé sort du §10 ; un écart assumé y entre.**

## 2. Deux univers dans la même session

Namorama n'a pas « un thème clair et un thème sombre ». L'accueil est **éditorial** : son
alternance sombre → clair → sombre est une composition, fixe. L'application est
**applicative** : elle suit la préférence de l'utilisateur (Clair, Sombre, Système).

| Zone | Univers | Jetons à employer |
|---|---|---|
| Héros, encart de démonstration, CTA final de l'accueil | éditorial, **toujours sombre** | palette `--nm-*-dark`, `--nm-accent` |
| Sections claires de l'accueil (4 contrôles, comparatif, FAQ) | éditorial, **toujours clair** | palette `--nm-*-light` |
| Wizard, grille de résultats, rapport (deux états), dialogues, tiroir des projets, compte, pages SEO, admin | applicatif, **suit le thème** | rôles `--nm-app-*` uniquement |
| Rapport imprimé / PDF | toujours clair | forcé par `@media print` (`theme.css`) |
| E-mails, thème Keycloak | toujours clair, styles figés | valeurs recopiées, accent `#0d7a4e` |

- **Un composant applicatif n'emploie jamais un jeton de palette** (`--nm-text-dark-2`) : il
  ne basculerait pas. Un composant éditorial n'emploie jamais un rôle : il basculerait.
- Les deux états du rapport (verrouillé, acheté) basculent **ensemble**.
- Le mode se résout avant le premier rendu (`index.html`, `localStorage['nm-theme']`) et
  pose `data-theme` ; PrimeNG suit le même attribut. Un composant ne lit jamais
  `prefers-color-scheme` lui-même : il emploie les rôles.
- Le sélecteur de thème (`.theme-switch`) a trois états : Clair, Sombre, **Système**.

## 3. La voix

- **On parle de noms et de marques, pas d'IA.** L'écran dit ce que le produit fait —
  « 10 noms libres en .com », « Vérifié à l'INPI » — sans « notre IA a généré ».
- **Court.** Une phrase d'aide tient sur une ligne ; une explication de risque, sur trois au
  plus. Pas de superlatifs, pas de « n'hésitez pas ». (Retour de production du 20/10/2026 :
  textes jugés trop longs et « sentant l'IA ».)
- **Un bouton dit ce qu'il fait** : « Débloquer le rapport », « Actualiser — gratuit »,
  « 10 de plus », « Réserver ». Jamais « OK » ni « Valider » seul.
- **Vocabulaire figé** : « crédits », « rapport approfondi », « noms vérifiés », « noms
  libres », « Mes projets ». Casse française : majuscule au premier mot seulement.
- **On dit le doute.** Un domaine non vérifiable s'écrit « non vérifiable », jamais
  « libre » par défaut ni « ? » seul. Une recherche vide dit pourquoi (« tout a été écarté
  par votre cahier des charges », pas « tout est pris »).
- **Une erreur nomme la cause et la suite** : ce qui n'a pas eu lieu, pourquoi, quoi faire.
- **Les registres sont nommés** : INPI, EUIPO. Aucune traduction ne doit suggérer une
  couverture que le produit ne fait pas (marques nationales d'autres pays, classes de Nice
  non surveillées).
- **Une langue se désigne par son nom**, jamais par un drapeau. Pas d'emoji dans un objet
  d'e-mail ni à la place d'une icône.

## 4. Les fondations

### Couleur — les rôles applicatifs (`theme.css`)

| Rôle | Sert à | Ne sert pas à |
|---|---|---|
| `--nm-app-bg`, `-surface`, `-surface-alt` | fond de page, cartes, encarts | — |
| `--nm-app-border`, `-border-strong`, `-divider` | contours, séparateurs | texte |
| `--nm-app-text` | texte principal, CTA « encre » | — |
| `--nm-app-text-2` | texte secondaire, aide | — |
| `--nm-app-text-3` | métadonnées décoratives | **tout texte informatif** (handoff) |
| `--nm-app-accent` | liens, filtre actif, texte accentué | aplat sous un libellé |
| `--nm-app-accent-fill` / `-hover` + `--nm-app-on-accent` | **aplat** du bouton principal | texte sur fond |
| `--nm-app-accent-surface`, `-accent-border` | carte ou encart mis en avant | — |
| `--nm-app-verdict-{free,taken,unknown}-{fg,bg}` | verdicts (§5) | décoration |
| `--nm-app-star` | notes en étoiles | — |
| `--nm-app-disabled-*` | contrôles désactivés | — |

- **Deux verts, non interchangeables, sur fond clair.** `#0d9a63` (`--nm-accent-on-light`)
  ne mesure que 3,61:1 sur blanc : il est réservé aux bordures et aplats décoratifs. Le
  texte et l'aplat d'un bouton prennent `#0d7a4e` (4,85:1). Le vert vif `--nm-accent`
  (`#3ddc91`) ne se pose que sur fond sombre.
- **Les couleurs PrimeNG passent par le preset**, jamais par `var(--p-…)` dans un composant
  maison : le preset est déjà calé sur la palette verdâtre et mesuré AA.

### Typographie

- **Space Grotesk** (`--nm-font-display`) : titres, chiffres, **noms de marque**. **IBM Plex
  Sans** (`--nm-font-body`) : texte courant et interface. Ni l'une ni l'autre ne couvre `ja`
  et `zh` : les piles de repli système doivent rester.
- Les tailles viennent de l'échelle `--nm-text-*` (`tokens.css`) : `h1-hero`, `h1-screen`,
  `h2`, `h3`, `name-card`, `lead`, `body`, `body-sm`, `ui`, `ui-sm`, `overline`,
  `overline-sm`, avec leurs interlignages (`--nm-leading-*`) et interlettrages
  (`--nm-tracking-*`). Une taille hors échelle est un jeton à créer, pas un `px`.
- Sous 640 px, les deux plus petites tailles montent d'elles-mêmes : elles portent les
  verdicts, qui doivent rester lisibles sur téléphone.

### Espace, rayons, ombres, cibles

- **Rayons** : `--nm-radius-xs` (6, badges, verdicts), `-sm` (8, boutons, champs), `-md`
  (10, CTA), `-lg` (12, cartes), `-xl` (14, cartes de résultats), `-2xl`/`-3xl` (grands
  blocs, carte de rapport), `-pill`.
- **Espaces de gabarit** : `--nm-card-padding` (20) / `-lg` (26), sections `52`/`88`
  vertical et `28` horizontal, gouttières `14` (résultats), `20` (cartes), `56` (héros).
  Largeurs : `--nm-content-max` 1200, `--nm-report-max` 920.
- **Ombres** : deux seulement, `--nm-shadow-product` et `--nm-shadow-phone`, côté
  éditorial. L'application tient par ses bordures, pas par ses ombres.
- **Cibles tactiles** : planchers `--nm-touch-min` (44), `-card-btn` (46), `-cta` (52). Un
  bouton peut être plus grand, jamais plus petit.

### Points de rupture et mouvement

Une variable CSS ne s'emploie pas dans une media query : ces valeurs sont des **règles**.

- **Deux points de rupture** : `max-width: 640px` (téléphone) et `min-width: 900px`
  (bureau large). Plus `(pointer: coarse)` pour ce qui dépend du doigt et non de la
  largeur. Les neuf autres valeurs relevées (400, 480, 520, 620, 720, 767, 768, 860) sont
  des écarts (§10) : on ne s'en sert pas comme modèle.
- **Mouvement** : `0.15s ease` pour survols et bascules, `0.25s` au plus pour une
  apparition. Toute animation qui se répète ou se déplace se fige sous
  `prefers-reduced-motion: reduce` (modèle : le mot tournant, `styles.css`).

## 5. Les composants

Chacun est **le** composant de son usage. Les implémentations parallèles relevées au §10 se
résorbent vers lui, chantier après chantier.

### Bouton

| Classe | Usage | Univers |
|---|---|---|
| `.nm-btn-primary` | **l'** action principale de la zone | applicatif (rôles) |
| `.nm-btn-secondary` | action d'accompagnement | applicatif |
| `.nm-btn-tertiary` | action discrète, « Annuler » | applicatif |
| `.nm-btn--accent` | CTA sur fond sombre éditorial | éditorial |
| `.nm-btn--ghost` | action secondaire éditoriale | éditorial |
| `p-button` | dans un dialogue, une table, un menu PrimeNG | thème du preset |

- `p-button` : `severity="secondary"` pour le secondaire, `[text]="true"` pour le tertiaire,
  `severity="danger"` **uniquement** pour une action destructrice (supprimer un projet, un
  compte). Pas de `success`, pas de `[rounded]` hors icône seule.
- Désactivé et focus sont dans les classes : on ne les redéfinit pas.

### Verdict de disponibilité

**Trois états, jamais deux** : libre, pris, **non vérifiable** — plus « verrouillé » (avant
achat) et « en cours ». Classes : `.nm-verdict--free|taken|unknown|watch|locked|pending`
(`components.css`).

- **La couleur ne porte jamais l'information seule** : un symbole (`pi-check`, `pi-times`,
  `pi-question`, `pi-lock`) et un libellé ou un `title` l'accompagnent.
- « Non vérifiable » est **ambre** partout (`--nm-app-verdict-unknown-*`), jamais gris :
  gris, il se lit comme « rien à signaler ».
- Avant achat, **le serveur ne renvoie aucun verdict** et l'écran n'en simule aucun : pas de
  flou, pas de barre grise sur un vrai résultat. Les lignes existent dans les deux états,
  et rien ne se déplace après l'achat.

### Autres primitives (`components.css`)

- `.nm-seg` : contrôle segmenté (choix exclusif de 2 à 4 options).
- `.nm-filter` : puce de filtre, active en `--nm-app-accent`. **Pas de filtre sur une
  donnée payante.**
- `.nm-link` : lien dans le texte applicatif.
- `.nm-chip`, `.nm-pill`, `.nm-overline` : étiquettes éditoriales.
- `.rv-actions`, `.rv-refresh` : barre d'actions du rapport.

### Composants Angular partagés

- `app-reserver` (`components/shared/reserver-bouton.ts`) : le seul bouton « Réserver »
  vers les registrars, variante `cta`.
- `app-results-grid` : la carte de résultat (nom en `--nm-text-name-card`, pouces à droite
  du nom, un seul bouton d'achat par carte, verdicts de domaines seulement — jamais INPI ni
  réseaux sur la carte).
- `app-brand-report-view` / `app-brand-report-locked` : le rapport, acheté ou verrouillé.
  Son pied porte toujours l'avertissement juridique et le périmètre INPI/EUIPO.
- `nmVisibleOnce` : ce qui coûte un appel au modèle se déclenche à la visibilité (CLAUDE.md).

### PrimeNG

Dialogue (`p-dialog`, `p-confirmdialog`), toast (`p-toast`, **un seul**, celui de `app.ts`,
en haut à droite), table, menu, tiroir, sélecteur, date, info-bulle : on prend le composant
PrimeNG, stylé par le preset. On le retouche par `styleClass` ou `pt` et une classe de la
feuille du composant, **pas** par `style=` ni `!important`.

### Icônes

**PrimeIcons uniquement** (`pi pi-*`). Glyphes de réseaux sociaux **monochromes**, jamais
leurs logos en couleur. Pas d'emoji à la place d'une icône (le 🔒 est `pi-lock`). Les
crédits s'illustrent par `pi-wallet`. Une icône seule porte un `aria-label`.

## 6. Le modèle de crédits à l'écran

Les règles de prix sont dans CLAUDE.md (*Tarification du rapport de marque*, *Système de
crédits*) ; l'écran les dit ainsi :

- **Un prix se lit avant le clic** : la suggestion coûte 1 crédit, le rapport
  `BRAND_REPORT_COST`. Ajouter une extension ne coûte rien, et c'est écrit près du sélecteur
  d'extensions.
- **Toute dépense de rapport se confirme**, sans exception (il n'y a plus de rapport offert
  depuis le 20/08/2026). Rouvrir un rapport acheté ou l'actualiser est gratuit, et le bouton
  le dit : « Actualiser — gratuit ».
- **Solde insuffisant** : le bouton devient « Recharger pour débloquer », il ne disparaît pas.
- **En lecture seule, on masque ce que le serveur refusera** (notation, achat,
  actualisation) : un bouton qui échoue est un mensonge.

## 7. Mobile et densité

- Vérifié à **390 px**. Wizard : une seule étape visible, barre de progression segmentée.
  Filtres défilables horizontalement plutôt que repliés sur plusieurs lignes.
- L'administration peut être dense (tables, petites tailles de l'échelle) mais emploie les
  mêmes rôles et composants : elle suit aussi le thème.

## 8. Accessibilité

- **AA mesuré, noté en commentaire** à côté de chaque jeton de couleur. Une couleur nouvelle
  arrive avec son ratio.
- **Focus visible** : `outline: 2px solid var(--nm-app-accent); outline-offset: 2px` sur
  `:focus-visible`. Jamais `outline: none` sans remplaçant.
- Icône seule ⇒ `aria-label` ; décoration ⇒ `aria-hidden="true"` ; état basculé ⇒
  `aria-pressed` ; résultat qui arrive en flux ⇒ `aria-live="polite"`.

## 9. Confidentialité à l'écran

L'enregistrement de session masque les champs de saisie, pas ce qu'on en réaffiche :
**`nm-prive`** sur tout texte qui reprend une saisie ou une adresse e-mail, **`nm-bloque`**
quand elle passe par un attribut (`aria-label`, `title`). `masquage.spec.ts` vérifie les
gabarits (CLAUDE.md).

## 10. Les écarts connus du code

Relevé du 31/10/2026. Le cliquet (§1, règle 8) empêche qu'ils grossissent ; chaque chantier
qui touche un de ces fichiers en résorbe ce qu'il peut.

| Écart | Où | Ampleur |
|---|---|---|
| Styles en ligne statiques, issus de l'ancienne règle « inline pour le layout » | `wizard.html` (207), `admin-users` (56), `app.ts` (55), autres `admin-*` | 437 |
| Couleurs en dur | `admin-*` (~105), `wizard.ts` (16, dont le HTML d'analyse généré), `verifier-disponibilite-nom-de-marque.ts` (12, palette grise et verdicts saturés « Libre/Pris/? »), `styles.css` (12, ambre de la pastille de crédits, badges de rejeu), `payment-result.ts` | 184 |
| `!important` | `styles.css` (12), `wizard.css` (10), `brand-report-view.css` (2) | 24 |
| `font-size` en px hors échelle | `landing.css` (11), `results-grid.css` (9) | 32 |
| Sept boutons principaux | `.rg-btn--buy`, `.rl-btn`, `.report-cta`, `.report-btn`, `.vd-go`, en plus de `.nm-btn-primary` et `.nm-btn--accent` | — |
| Cinq jeux de verdicts | `.rg-v--*`, `.rg-social--*`, `.rv-badge--*`, `.nm-verdict__state--*`, en plus de `.nm-verdict--*` | — |
| « Non vérifiable » gris dans le rapport | `brand-report-view.css`, `.rv-badge--unknown` | — |
| `var(--p-…)` avec repli de l'ancienne palette (`#3b82f6`, `#eff6ff`) | `styles.css` (39), `app.ts` (31) | 105 |
| Points de rupture hors règle | 400, 480, 520, 620, 720, 767, 768, 860 | 9 |
| Second `p-toast` | `wizard.html` | 1 |
| `pi-bolt` pour les crédits, au lieu de `pi-wallet` | feuille de compte (`app.ts`), `styles.css` | — |
| Code mort `reportStatusColor` | `wizard.ts` | 1 |
