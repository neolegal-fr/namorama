# Tasks

## 0. Point de comparaison

- [ ] 0.1 Relever sur 30 jours, avant déploiement, `report_share_opened`, `report_printed`, `brand_report_reshared` et `brand_report_cta_clicked` (volumes et comptes distincts) via `scripts/analyze-logs.py` sur `namorama-prod` ; noter les chiffres datés sous cette tâche. Vérification : chiffres notés.
  - 07/11/2026 : non fait — la lecture des logs de production a été refusée à l'agent par le mode automatique. À lancer par le développeur : `ssh namorama-prod "python3 - rapports" < scripts/analyze-logs.py`.

## 1. API : jeton dans les synthèses, envoi par le projet

- [x] 1.1 Ajouter `shareToken` à `BrandReportSummary` (`dto/brand-report.types.ts`) et à `listSummaries` (`brand-report.store.ts`). Vérification : test ajouté dans `brand-report.controller.spec.ts` — une synthèse rend le jeton du rapport enregistré ; `cd api && npx jest brand-report` passe.
  - 07/11/2026 : test placé dans `brand-report.store.spec.ts` (c'est le magasin qui construit la synthèse) ; jeton absent ⇒ `null`. 75/75 verts.
- [x] 1.2 `POST /brand-report/send` : accepter `projectId` et résoudre le compte par `subDesRapports` ; `brand_report_reshared` porte `viaProjet`. Vérification : tests — invité d'un projet dont le propriétaire a le rapport ⇒ envoi ; sans `projectId` ⇒ comportement inchangé ; nom sans rapport ⇒ 404 sans génération ni débit ; `npx jest brand-report` passe.
- [x] 1.3 Documenter dans CLAUDE.md (section *Partage d'un projet*) que l'envoi par e-mail d'un rapport passe par le projet comme les autres lectures. Vérification : relecture du paragraphe.

## 2. Carte : un bouton, trois icônes

- [x] 2.1 `services/brand-report.ts` : `shareToken?` sur `BrandReportSummary` ; `sendByMail(name, emails, projectId?)`. Vérification : `cd web && npx ng build` passe.
- [ ] 2.2 `results-grid.ts` : pied à un seul `.rg-btn` pleine largeur — « Vérifier marques déposées et réseaux sociaux » (`.rg-btn--buy`, `pi-shield`) puis « Voir le rapport de vérification » (`.rg-btn--ghost`, `pi-file`) — et ligne `.rg-price` dans les deux états ; suppression de « Rapport complet » et de la rangée à deux boutons. Vérification : navigateur, projet avec un nom vérifié et un non vérifié : libellés, prix « 50 crédits » visible avant clic, pieds de même hauteur.
  - 07/11/2026 : code écrit, build OK ; vérification au navigateur à faire. Ajout hors spécification : en lecture seule sur un nom non vérifié, la mention « Marques et réseaux non vérifiés » remplace le bouton (« Voir le rapport » mentirait, aucun rapport n'existe).
- [ ] 2.3 En-tête : `.rg-rate` → `.rg-tools` avec l'icône `pi-share-alt` après 👍 👎, `aria-label` « Partager <nom> », `aria-haspopup="menu"` ; pouces masqués en lecture seule, partage conservé ; nouvelle sortie `partager: { nom, event }`. Vérification : navigateur, ordre des icônes, lecture seule (projet partagé en lecture), libellé lu au clavier.
  - 07/11/2026 : code écrit, build OK ; vérification au navigateur à faire. La sortie porte aussi `verifie`.
- [ ] 2.4 i18n FR/EN : `GRID_VERIFY` (« Vérifier marques déposées et réseaux sociaux » / « Check trademarks and social media »), `GRID_VIEW_REPORT`, `GRID_PRICE_LINE`, `GRID_RESERVE_LINE`, `GRID_SHARE` ; retrait de `GRID_VERIFY_SHORT` et `GRID_FULL_REPORT` ; `REPORT_CONFIRM_TITLE` dit « rapport de vérification ». Vérification : `grep` des clés retirées sans résultat dans `web/src` ; les deux langues affichées au navigateur.
  - 07/11/2026 : `grep` sans résultat ; clés ajoutées aussi pour le menu (`SHARE_MENU_*`, `NAME_COPIED`, `GRID_NOT_VERIFIED`). Affichage des deux langues au navigateur à faire.
- [x] 2.5 `masquage.spec.ts` : le nom repris dans `aria-label` du partage porte `nm-bloque` si la règle l'exige. Vérification : `cd web && npx ng test --watch=false --include='**/masquage.spec.ts'` passe.
  - 07/11/2026 : la règle ne l'exige pas — `masquage.spec.ts` impose des cartes LISIBLES au rejeu. Pas de `nm-bloque`. `ng test` : 75/75.
- [ ] 2.6 Vérification d'ensemble au navigateur, données non vides, thèmes clair et sombre, à 390 px et sur bureau, avec « platsvegetauxadomicile » (nom sur trois lignes accepté, icônes à droite de la première). Noter le résultat sous la tâche.
- [x] 2.7 `docs/systeme-de-design.md` §5 (`app-results-grid` : trois icônes d'en-tête, un bouton de pied, ligne de prix) et §3 (« rapport de vérification » remplace « rapport approfondi » ; écart éditorial ajouté au §10). Vérification : relecture.
  - 07/11/2026 : le §5 disait « jamais INPI ni réseaux sur la carte », contraire au code depuis la refonte ; corrigé au passage.
- [x] 2.8 `just design-check` passe ; si des valeurs en dur ont été retirées, `just design-resserrer` et commit de `web/design-reference.json`.
  - 07/11/2026 : « aucune valeur en dur ajoutée (677 occurrences héritées) » ; rien de retiré.

## 3. Menu de partage commun

- [ ] 3.1 `wizard.ts` : `partageItems({ nom, shareToken, verifie, origine })` remplace la version à `BrandReport` ; la page du rapport l'appelle avec `origine: 'rapport'`. Vérification : navigateur, le menu du rapport est inchangé (trois entrées, note sur le lien public).
  - 07/11/2026 : code écrit. Un seul `p-menu` au niveau du wizard, ouvert par `ouvrirPartageDuNom` (`ouvrirPartage` existait déjà pour le partage de PROJET). L'entrée e-mail gagne la note « avec le rapport en pièce jointe ». Vérification au navigateur à faire.
- [ ] 3.2 Brancher `(partager)` de la grille sur le même `p-menu` ; nom vérifié : « Copier le lien », « Envoyer par e-mail » (« avec le rapport en pièce jointe »), « Télécharger le PDF », note du lien public visible avant choix ; jeton absent ⇒ « Copier le lien » désactivé avec sa note. Vérification : navigateur, lien copié = `/rapport/<jeton>` de ce nom, résultats toujours affichés, toast rappelant l'accès sans compte.
- [ ] 3.3 Sortir le `p-dialog` d'envoi par e-mail du bloc de la page du rapport ; depuis la carte, poser le nom puis ouvrir le dialogue ; passer `projectId()`. Vérification : navigateur, envoi depuis la carte reçu (boîte de test) ; envoi par un invité d'un projet partagé reçu ; aucun débit (solde inchangé).
- [ ] 3.4 « Télécharger le PDF » depuis la carte : ouvrir le rapport, imprimer après rendu du rapport de ce nom, effacer le drapeau. Vérification : navigateur, la boîte d'impression s'ouvre sur le rapport complet (six réseaux affichés), une seule fois ; retour aux résultats sans nouvelle impression.
  - 07/11/2026 : déclenchement dans `loadReportInto`, une fois le rapport de CE nom chargé (`detectChanges` puis 50 ms). Délai à confirmer au navigateur.
- [ ] 3.5 Nom non vérifié : note, « Vérifier puis partager — 50 crédits » (→ `askBrandReport`), « Copier le nom » avec confirmation brève ; en lecture seule, note et « Copier le nom » seulement. Vérification : navigateur — annuler la confirmation ne débite rien ; confirmer produit le rapport affiché avec son bouton « Partager » ; nom copié dans le presse-papiers.
- [ ] 3.6 Événements (D10) : `report_share_menu_opened`, `name_copied`, `origine` sur `report_share_opened`, `report_printed`, `brand_report_cta_clicked`. Vérification : en local, chaque geste écrit sa ligne `event` dans le journal NDJSON de l'API avec les bons champs.
- [x] 3.7 CLAUDE.md, section *Nommage des événements* : décrire `report_share_menu_opened` et `name_copied`, et la question à laquelle ils répondent (le partage part-il de la carte ?). Vérification : relecture.
- [x] 3.8 `just design-check` passe ; `just build` passe.
  - 07/11/2026 : `nest build` OK ; `ng build` de production OK (24 routes prérendues) ; design-check OK ; `jest` 498/498, `ng test` 75/75.

## Workflow follow-up

- Déployer (PR → CI → merge → `docker compose pull api web && up -d`), aucune migration SQL.
- Après 30 jours : relire `report_share_menu_opened` par `origine` et `verifie`, et comparer `report_share_opened`, `report_printed`, `brand_report_reshared` au relevé 0.1 ; noter les chiffres ici.
- Archiver le chantier (`/opsx:archive`), puis vérifier `openspec/specs/resultats/` et `openspec/specs/rapport-de-marque/`, et `openspec validate --all`.
