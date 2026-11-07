# Proposal

## Why

La carte de résultat porte deux boutons qui ne disent pas ce qu'ils font. « Marque et
réseaux » lance la vérification payante, et « Rapport complet » ouvre, pour un nom non
vérifié, la page verrouillée du rapport : une seconde porte vers le même achat, sans prix
affiché (`web/src/app/components/results/results-grid.ts:306-316`, libellés
`GRID_VERIFY_SHORT` et `GRID_FULL_REPORT`). Une fois le nom vérifié, seul « Rapport complet »
subsiste, alors que ce qu'il cache — partager, télécharger le PDF, réserver — n'est annoncé
nulle part.

Faits datés :

- 07/11/2026 : le créateur du produit, en relisant l'écran, ne se rappelait plus ce que
  « Rapport complet » ouvrait. L'intérêt réel du rapport acheté, selon lui, est de **partager
  un nom qu'on aime**.
- 28/09/2026 (commit `edeef2b`) : 59 comptes sur 85 n'avaient laissé aucune note de nom, et
  « Réserver » n'avait reçu aucun clic en 30 jours — rien sur l'écran ne distinguait un
  utilisateur reparti avec un nom d'un utilisateur reparti bredouille.
- Le partage existe déjà (lien public `/rapport/:token`, envoi par e-mail avec le rapport joint en HTML imprimable,
  impression en PDF), mais **seulement dans l'en-tête de la page du rapport**
  (`wizard.html:1306`, `wizard.ts:1440`) : il faut savoir l'ouvrir pour le trouver.
- `POST /brand-report/send` ne cherche le rapport que sous le compte appelant
  (`api/src/brand-report/brand-report.controller.ts:135`) : un invité dont le propriétaire
  a payé le rapport reçoit un 404 en l'envoyant par e-mail.

La fréquence d'usage du partage (`report_share_opened`, `report_printed`,
`brand_report_reshared`) n'a pas pu être relevée en préparant ce chantier : elle est à
mesurer avant le déploiement pour servir de point de comparaison (voir tâches).

## What Changes

- **Un seul bouton en pied de carte.** Il dit « Vérifier marques déposées et réseaux
  sociaux » tant que le nom n'est pas vérifié, avec le prix écrit dessous (« 50 crédits ·
  rapport PDF à partager »), puis « Voir le rapport de vérification » une fois le nom vérifié.
  « Rapport complet » disparaît. La confirmation avant débit reste inchangée.
- **Une icône « Partager » dans l'en-tête de la carte**, à droite de 👍 et 👎, dans la même
  colonne fixe : lire le nom, l'aimer, le partager. Le nom reste sur la même ligne que les
  trois icônes.
- **Sur un nom vérifié**, l'icône ouvre le menu de partage du rapport : copier le lien
  public, envoyer par e-mail (rapport joint), télécharger le PDF, avec l'avertissement « toute
  personne qui reçoit ce lien pourra consulter le rapport, sans compte ».
- **Sur un nom non vérifié**, le même menu explique que le partage envoie le rapport de
  vérification et propose « Vérifier puis partager » (50 crédits, confirmation) et « Copier
  le nom », qui n'exige rien.
- Les synthèses de rapports (`GET /brand-report/summaries`) portent le jeton de partage, pour
  que « Copier le lien » fonctionne depuis la carte sans ouvrir le rapport.
- L'envoi par e-mail fonctionne pour l'invité d'un projet partagé (rapport payé par le
  propriétaire), depuis la carte comme depuis le rapport.
- Le livrable s'appelle **« rapport de vérification »** sur la carte, dans le menu et dans la
  confirmation d'achat ; le vocabulaire figé du système de design suit.

Hors périmètre :

- Partage gratuit d'une fiche de nom non vérifié (piste B de la maquette, écartée le
  07/11/2026).
- Liens « Réserver » sur la carte : ils restent dans le rapport.
- Renommage du rapport dans les courriels et sur la page publique partagée.
- Bloc « Aide-moi à choisir » et son bouton « Rapport complet · 50 crédits » : inchangés.

## Capabilities

### New Capabilities
- `resultats/carte-de-resultat`: les actions de la carte d'un nom — bouton de vérification
  et son libellé selon l'état, icônes de l'en-tête, copie du nom.
- `rapport-de-marque/partage`: partager le rapport de vérification d'un nom — moyens offerts,
  conditions (rapport acheté ou non), avertissement sur le lien public.

### Modified Capabilities
<!-- Aucune : `openspec/specs/` ne couvre encore ni la carte ni le rapport. -->

## Impact

- **Web** : `components/results/results-grid.ts` et `.css` (en-tête, pied, menu),
  `components/wizard/wizard.ts`/`.html` (sorties de la grille, menu de partage partagé avec
  la page du rapport, ouverture puis impression), `services/brand-report.ts` (type
  `BrandReportSummary`), `public/assets/i18n/fr.json` et `en.json`.
- **API** : `brand-report.store.ts` (`listSummaries`), `dto/brand-report.types.ts` — ajout du
  champ `shareToken` à la réponse de `GET /brand-report/summaries` ; `brand-report.controller.ts`
  — `POST /brand-report/send` accepte `projectId`, comme les autres lectures. Aucun
  changement de schéma ni de migration.
- **Événements** : nouveaux `report_share_menu_opened` (`origine`, `verifie`) et
  `name_copied` ; `report_share_opened`, `report_printed` et `brand_report_cta_clicked`
  gagnent une `origine` ; `brand_report_reshared` gagne `viaProjet`.
- **Documentation** : `docs/systeme-de-design.md` §3 (vocabulaire) et §5 (carte de
  résultat) ; CLAUDE.md (événements).
- **Interface** : s'appuie sur `docs/systeme-de-design.md` §1 (règles), §3 (voix et
  vocabulaire), §5 Bouton, Icônes et PrimeNG (`p-menu`), §6 (prix avant le clic,
  confirmation de toute dépense, lecture seule), §8 (icône seule ⇒ `aria-label`, focus).
  Aucun nouveau composant : le menu de partage de la page du rapport est réutilisé.
- Maquette de référence : canevas « Cartes de résultats — partage », planche « Piste A
  retenue » (https://claude.ai/artifact/Wsek1zTpnHVh8HCeQsso9G), avec les trois icônes en
  colonne fixe.
