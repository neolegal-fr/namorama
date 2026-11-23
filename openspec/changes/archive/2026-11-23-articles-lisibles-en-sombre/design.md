# Design

## Décisions

### 1. Les articles suivent le thème, avec les rôles existants

Chaque couleur de `.article` est remplacée par le rôle qui décrit son usage
(docs/systeme-de-design.md §4) :

| Élément | Avant | Après |
|---|---|---|
| Texte courant, H1, H2, H3, en-tête de tableau | `--p-surface-700` / `-900` | `--nm-app-text` |
| Chapeau, signature, fil d'Ariane, cellule « non » | `--p-surface-600` / `-500` / `-400` | `--nm-app-text-2` |
| Nom de l'auteur dans la signature | `--p-surface-700` | `--nm-app-text` |
| Bordures du tableau | `--p-surface-200` | `--nm-app-border` |
| Fond de l'en-tête du tableau | `--p-surface-50` | `--nm-app-surface-alt` |
| Cellule « oui » | `--p-primary-600` | `--nm-app-verdict-free-fg` |

- **Écarté : garder les articles toujours clairs**, comme l'accueil éditorial. Le §2 les
  range dans l'univers applicatif ; l'en-tête du site et l'index `/blog` basculent déjà.
  Une page claire sous un en-tête sombre serait une troisième composition, non décrite.
- **Écarté : `--nm-app-text-3`** pour la signature et la cellule « non ». Le §4 le
  réserve aux métadonnées décoratives ; une date de publication et un « Non » de
  comparatif sont informatifs.
- **Écarté : un jeton « texte courant » à `#2c3532`**, pour garder la teinte claire
  d'aujourd'hui. Le texte courant prend le rôle `--nm-app-text`, plus foncé en clair
  (`#0b0e10`) ; le contraste ne peut que monter, et l'écart ne justifie pas un rôle de
  plus.
- « Oui » prend le vert de verdict « libre » : c'est le vert de texte AA dans les deux
  thèmes (`#0d7a4e` en clair, `#6ee7a8` en sombre), l'usage même du §4 (« deux verts, non
  interchangeables »).

### 2. L'appel à l'action passe en feuille de composant

Ses styles en ligne vont dans `styles` du composant, et ses couleurs prennent
`--nm-app-accent-surface` (fond), `--nm-app-accent-border` (bordure), `--nm-app-text`
(titre), `--nm-app-text-2` (phrase et mention « 100 crédits offerts »). Le bouton reste un
`p-button`, coloré par le preset.

- **Écarté : ne corriger que les couleurs en ligne.** La règle « pas de style en ligne »
  (§1) s'applique à toute retouche ; le cliquet du design le compte.

## Contrats externes

Aucun : ni API, ni événement, ni donnée structurée. Seul le rendu change.

## Vérification

Contrastes recalculés au navigateur par le même script que la mesure du 23/11/2026 (tous
les éléments ≥ 4,5:1 dans les deux thèmes), captures en clair et en sombre à 390 px et
sur bureau : article avec tableau, bloc « trois risques », appel à l'action, index du
blog.
