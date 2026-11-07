# Design

## Context

Voir proposal.md (Why). État du code utile à l'approche :

- La carte vit dans `app-results-grid` (`results-grid.ts`), composant présentationnel : il
  reçoit des signaux (`domains`, `summaries`, `readOnly`…) et émet des sorties (`verify`,
  `openReport`, `rate`…). Toute la logique — crédits, rapport, partage — est dans le wizard.
- L'en-tête de carte est une rangée `flex` sans retour à la ligne (`.rg-card__head`) : nom à
  gauche, `.rg-rate` (deux `.rg-icon` de 44 px) à droite, masquée en lecture seule
  (`results-grid.ts:111`). L'en-tête réserve deux lignes de nom (`min-height`).
- Le menu de partage existe dans la page du rapport : `p-menu` alimenté par
  `partageItems(report)` (`wizard.ts:1440`), entrées avec note (`.partage-menu__*`,
  `wizard.css:1052`). Il dépend du `BrandReport` chargé : `shareToken` pour le lien,
  `brandReportName()` pour l'e-mail, et `window.print()` sur la page affichée pour le PDF.
- Le dialogue d'envoi par e-mail (`showShareMail`) est déclaré **à l'intérieur** du bloc de
  la page du rapport (`wizard.html:1175`, sous `*ngIf="showReportDialog()"`).
- `GET /brand-report/summaries` rend, par nom vérifié, marque, réseaux, score et coût, mais
  pas le jeton de partage (`brand-report.store.ts:42`).
- `POST /brand-report/send` cherche le rapport sous le seul compte appelant
  (`brand-report.controller.ts:135`), alors que les lectures passent par
  `subDesRapports(projectId, sub)`.
- L'e-mail joint le rapport en HTML imprimable (`report-mail.service.ts:55`), pas en PDF.

## Goals / Non-Goals

**Goals:**
- Partager un nom vérifié sans quitter les résultats pour le lien et l'e-mail.
- Un seul menu de partage dans le produit, qu'on l'ouvre depuis la carte ou depuis le rapport.
- Mesurer d'où part le partage (carte ou rapport) pour juger la décision.

**Non-Goals:**
- Générer un vrai PDF côté serveur : le « PDF » reste l'impression du navigateur.
- Migrer `.rg-btn--buy` vers `.nm-btn-primary` (écart connu du §10, chantier à part).
- Renommer « rapport approfondi » sur l'accueil, la FAQ et les pages SEO.

## Decisions

### D1 — Un seul `p-menu` de partage, porté par le wizard

La grille émet `partager: { nom, event }` ; le wizard ouvre **son** `p-menu` (celui de la
page du rapport) avec les entrées calculées pour ce nom. `partageItems` prend désormais
`{ nom, shareToken, verifie, origine }` au lieu d'un `BrandReport`, et sert aux deux origines.

*Écartée : un menu dans la grille.* Deux menus, deux jeux de libellés et de styles à tenir
alignés — c'est exactement la dérive que `app-reserver` a dû résorber (trois exemplaires du
bouton « Réserver »). La grille, présentationnelle, ne connaît ni crédits ni e-mail.

### D2 — `shareToken` dans les synthèses

`listSummaries` ajoute `shareToken` à chaque synthèse ; le type `BrandReportSummary` (API et
web) gagne le champ. « Copier le lien » copie donc **pendant** le clic.

*Écartée : charger le rapport (`GET /existing`) à l'ouverture du menu.* L'écriture dans le
presse-papiers après une attente réseau perd l'activation utilisateur sur Safari et échoue
sans bruit ; et l'on chargerait tout le rapport pour une adresse.

Contrat d'API modifié : `GET /brand-report/summaries` rend un champ de plus. La route est
authentifiée et bornée par `subDesRapports` : elle ne rend que des jetons de rapports que
l'appelant peut déjà lire et partager depuis la page du rapport. Aucun jeton nouveau n'est
exposé.

### D3 — L'e-mail s'envoie depuis les résultats

Le `p-dialog` d'envoi sort du bloc de la page du rapport et se place au niveau du wizard.
Depuis la carte, le wizard pose `brandReportName(nom)` puis appelle `openShareMail('carte')`.

*Écartée : ouvrir le rapport puis le dialogue.* On quitterait les résultats pour un geste qui
n'a pas besoin du rapport à l'écran.

### D4 — `POST /brand-report/send` accepte `projectId`

Le contrôleur résout le compte du rapport par `subDesRapports(projectId, sub)`, comme
`existing`, `summaries` et `offer`. Le front transmet `projectId()`. `brand_report_reshared`
gagne `viaProjet: boolean`.

*Écartée : masquer l'e-mail aux invités.* Le serveur leur permet déjà de lire le rapport ;
l'envoi ne dépense rien et n'écrit rien sur le projet. Masquer serait cacher un défaut.

Contrat d'API modifié : champ facultatif `projectId` dans le corps de `POST /send`, sans
effet quand il est absent (comportement actuel).

### D5 — « Télécharger le PDF » ouvre le rapport, puis imprime

Le wizard mémorise `imprimerALOuverture = nom`, ouvre le rapport (`openFullReport`), et
appelle `printReport('carte')` après le rendu du rapport de ce nom (`afterNextRender`), puis
efface le drapeau.

*Écartée : imprimer depuis les résultats.* La feuille d'impression du rapport
(`9ee22cd`) n'existe que sur la page du rapport ; imprimer la grille produirait un document
sans rapport. *Écartée aussi : PDF serveur* — nouvelle dépendance de rendu, hors de proportion.

### D6 — Menu d'un nom non vérifié

Entrées : une note « Le partage envoie le rapport de vérification : marques, réseaux et
domaines. », « Vérifier puis partager — {{n}} crédits » (appelle `askBrandReport(nom)`, donc
l'offre, la confirmation, le cas « solde insuffisant » existants), et « Copier le nom ». En
lecture seule : la note et « Copier le nom » seulement (§6 : on masque ce que le serveur
refusera). Après achat, le parcours existant affiche le rapport avec son bouton « Partager ».

*Écartée : n'afficher l'icône que sur les noms vérifiés.* Les en-têtes ne seraient plus
identiques d'une carte à l'autre, et le geste « j'aime ce nom, je veux le montrer » n'aurait
pas de réponse là où il naît.

### D7 — En-tête : trois icônes en colonne fixe

`.rg-rate` devient `.rg-tools` et accueille la troisième `.rg-icon` (`pi pi-share-alt`, déjà
employée par le bouton « Partager » du rapport). En lecture seule, les pouces sont masqués,
l'icône de partage reste. Le nom garde sa colonne : un nom très long
(« platsvegetauxadomicile ») peut passer sur trois lignes et dépasser la hauteur réservée.

*Écartée : icônes flottantes, le nom passant dessous* (planche « Piste A retenue »). Elle
logeait davantage de caractères sur deux lignes, mais le créateur a retenu le 07/11/2026 la
colonne fixe : le nom et ses trois gestes restent sur une même ligne de lecture.

### D8 — Pied de carte : un bouton, une ligne de prix

Un seul `.rg-btn` pleine largeur : `.rg-btn--buy` avec `pi-shield` avant vérification,
`.rg-btn--ghost` avec `pi-file` ensuite. Le libellé « Vérifier marques déposées et réseaux
sociaux » passe sur deux lignes dans la hauteur existante (`--nm-touch-card-btn`, 46 px).
Dessous, une ligne `.rg-price` (`--nm-text-ui-sm`, `--nm-app-text-2`) présente dans les deux
états : « {{n}} crédits · rapport PDF à partager » puis « Liens Réserver dans le rapport ».
La sortie `openReport` reste, `verify` aussi ; la règle `.rg-actions__row` à deux boutons
disparaît.

*Écartée : garder deux boutons, renommés.* Deux portes vers le même achat, même bien
nommées, posent une question (« quelle différence ? ») qui n'a pas de réponse.

### D9 — Vocabulaire : « rapport de vérification »

Dans l'application (carte, menu, titre de la confirmation), le livrable s'appelle « rapport
de vérification » / « verification report ». `docs/systeme-de-design.md` §3 remplace
« rapport approfondi » par ce terme dans le vocabulaire figé ; les pages éditoriales qui
gardent « rapport approfondi » (accueil, FAQ, `DEMO_REPORT_TAG`) entrent au §10 comme écart.

*Écartée : garder « rapport approfondi ».* « Approfondi » ne dit pas ce qui est vérifié ;
c'est le défaut même de « Rapport complet ».

### D10 — Événements

- `report_share_menu_opened` `{ origine: 'carte' | 'rapport', verifie }` — nouveau : seul
  moyen de compter les ouvertures du menu sans choix.
- `report_share_opened` et `report_printed` gagnent `origine`.
- `name_copied` `{ source: 'carte_partage' }` — nouveau.
- `brand_report_cta_clicked` gagne `origine: 'carte' | 'partage' | 'choisir'`, pour séparer
  « Vérifier » de « Vérifier puis partager ».

Contrat de journalisation modifié : champs ajoutés, aucun retiré ; `analyze-logs.py` n'en
dépend pas.

### Réutilisés sans changement

Jetons `--nm-app-*`, `--nm-text-ui-sm`, `--nm-touch-min`, `--nm-touch-card-btn` ; classes
`.rg-icon`, `.rg-btn--buy`, `.rg-btn--ghost`, `.partage-menu__*` ; `p-menu`, `p-dialog`,
`p-toast` de l'application ; parcours `askBrandReport` (offre, confirmation, solde
insuffisant). Aucun jeton ni composant nouveau.

## Risks / Trade-offs

- [Nom très long sur trois lignes, cartes désalignées] → accepté (D7) ; vérifié au
  navigateur sur « platsvegetauxadomicile » à 390 px et sur bureau.
- [Impression lancée avant le rendu complet du rapport] → déclenchement après rendu du
  rapport **de ce nom** ; vérification au navigateur sur un rapport à six réseaux.
- [Jeton absent d'une synthèse (rapport ancien)] → `Copier le lien` désactivé avec sa note,
  comme dans le rapport ; l'e-mail et le PDF restent proposés.
- [Le menu gagne un clic de plus pour « Voir le rapport » quand on venait partager] → le
  bouton de pied y mène toujours en un clic.

## Migration Plan

Aucune migration SQL. L'API et le web partent dans la même image ; l'ancien front ignore le
champ `shareToken` ajouté. Retour arrière : redéployer l'image précédente.

## Open Questions

Aucune.
