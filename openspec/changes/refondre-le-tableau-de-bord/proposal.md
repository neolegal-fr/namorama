# Proposal

## Why

Le tableau de bord d'administration aligne une quarantaine d'éléments de même rang
(10 indicateurs de période, 5 étapes d'entonnoir, 8 totaux cumulés, 4 cartes et 2
répartitions de fidélité, un tableau de cohortes, 8 courbes hebdomadaires, 4 cartes de
coût et un simulateur), mais ne répond à aucune des questions standard d'un SaaS :
combien d'utilisateurs actifs par mois, combien reviennent, combien paient, à quelle
marge. Relevé en base de production le 31/10/2026 (comptes admin et internes exclus) :

- **52 comptes actifs sur 30 jours, dont 1 seul inscrit depuis plus de 30 jours.** Le
  MAU monte (10 en août, 40 en septembre, 52 en octobre) mais ne mesure presque que les
  inscriptions. DAU moyen 2,1, WAU 10 : un DAU/MAU de ~4 %, et 62 jours d'activité pour
  52 comptes en octobre (~1,2 jour par compte). Aucun de ces chiffres n'est affiché :
  « Comptes actifs » change de sens avec la période choisie
  (`web/src/app/components/admin/admin-dashboard.component.ts:492`) et n'est un MAU que
  sur la fenêtre de 30 jours.
- **Le chiffre d'affaires n'est calculable nulle part.** `stripe_event` ne garde que
  `sessionId`, `type` et `processedAt` (`api/src/payments/entities/stripe-event.entity.ts:8`) :
  ni montant, ni pack, ni compte. Deux paiements depuis l'origine (2 et 15/03/2026),
  322 visites sur 30 jours dont 6 ont ouvert les packs et 0 a lancé un paiement.
- **Le stock « Crédits pack » ne dit rien des ventes** : 7 comptes en ont pour 2
  paiements, parce que les ajustements manuels s'ajoutent au même `extraCredits`
  (`api/src/admin/admin.service.ts:466`).
- **La « Satisfaction » affichée vaut 3,8 % et ne mesure pas la satisfaction** :
  27 👍 pour 681 👎 sur 1 762 noms générés en 30 jours, venant de 8 comptes
  (`admin-dashboard.component.ts:557`). Le 👎 sert à écarter un nom, pas à se plaindre.
  Ce que le produit promet — trouver un nom — se lit ailleurs : **8 projets sur 52**
  ont au moins un nom en favori (15 %).
- **Redondances** : « Tarifs consultés » figure trois fois (carte `:532`, entonnoir
  `:686`, courbe `:292`) ; « Recherches », « Suggestions générées » et « Crédits
  consommés » mesurent tous le volume ; la fidélité est montrée sous quatre formes
  (`admin-retention.component.ts:37-71`). Le relevé des coûts par opération et son
  simulateur, outil de réglage des modèles, occupe le bas de la page de pilotage
  (`admin-dashboard.component.ts:309`).

À ~50 comptes actifs par mois, le problème du produit est la rétention ; le tableau de
bord doit le montrer en premier.

## What Changes

- **Bandeau de tête** : cinq chiffres sur la période, comparés à la précédente — MAU
  (décomposé nouveaux / récurrents), nouveaux inscrits, taux d'activation (création d'un
  projet, définition inchangée), chiffre d'affaires, taux de succès des recherches.
- **Engagement** : DAU moyen, WAU, MAU, DAU/MAU, jours actifs par compte actif (avec
  répartition 1 / 2-3 / 4+), recherches par compte actif, part des comptes à plus d'une
  recherche.
- **Satisfaction** : taux de succès (projets ayant au moins un favori), retours écrits
  reçus, comptes ayant noté des noms. Le ratio 👍 / 👎 en pourcentage est **retiré**.
- **Rétention** : décomposition mensuelle du MAU (nouveaux, retenus, réactivés, perdus),
  rétention par cohorte mensuelle en triangle (M0…M5), retours sous 7 et 30 jours
  conservés. Durée de vie médiane, « actifs un seul jour » et les deux répartitions sont
  retirés.
- **Monétisation** : nouveau **registre des paiements** alimenté par le webhook et par
  `fulfillSession`, rattrapé pour le passé depuis l'API Stripe. Le tableau de bord en
  tire le chiffre d'affaires, les clients payants (période et cumul), la conversion
  inscrits → payants, et la suite tarifs consultés → paiements lancés → paiements aboutis.
- **Coûts** : le tableau de bord ne garde que le coût IA total, par compte actif et par
  recherche. Le relevé par opération et le simulateur deviennent un onglet
  **Administration → Coûts IA** (`/admin/costs`).
- **Courbes mensuelles** au lieu de 26 semaines : MAU décomposé, inscrits, chiffre
  d'affaires, coût IA. **BREAKING (admin uniquement)** : `GET /admin/series?weeks=` est
  remplacé par `GET /admin/series?months=`.
- **Période** : les choix deviennent 7 jours, 30 jours, mois civil, personnalisé ; la
  fenêtre de 24 h est retirée.
- **Retirés** : « Visiteurs déjà inscrits », « Suggestions générées », « Comptes
  cumulés », moyennes suggestions et favoris par projet, stocks de crédits gratuits et
  pack, la carte « Tarifs consultés » (gardée dans l'entonnoir et la monétisation).

**Hors périmètre**

- Le courriel automatique de demande de retour à J+1 et la question « avez-vous trouvé
  un nom ? » : changement séparé.
- NPS et test de Sean Ellis.
- Marge brute en pourcentage : le coût IA est en dollars, le chiffre d'affaires en euros,
  et aucun taux de change n'est disponible ; les deux montants sont affichés côte à côte.
- « Crédits payés non consommés » : `extraCredits` mélange achats et cadeaux, le stock
  n'est pas séparable sans un journal des débits.
- Sources d'acquisition (référent, UTM).
- Modification du tableau des utilisateurs, de l'onglet Feedbacks et de Tarifs IA.

## Capabilities

### New Capabilities
- `tableau-de-bord`: indicateurs de pilotage de l'administration — ce qu'ils comptent,
  sur quelle population, à quelle granularité, et quand ils n'ont pas de valeur.
- `paiements`: enregistrement durable de chaque paiement Stripe abouti (compte, pack,
  montant, devise, date), source des indicateurs de revenu.

### Modified Capabilities
<!-- Aucune : openspec/specs/ ne contient encore aucune capacité. -->

## Impact

- **API** : `api/src/admin/admin.service.ts` (`getStats`, `getSeries`, `metriquesPeriode`),
  `retention.service.ts`, `admin.controller.ts` (`stats`, `series`) ;
  `api/src/payments/payments.service.ts` (`fulfillSession`, `handleWebhook`) ; nouvelle
  entité `paiement`.
- **Base** : migration `api/migrations/2026-11-…-registre-des-paiements.sql`, à appliquer
  avant le déploiement ; script de rattrapage des paiements passés (2 sessions).
- **Web** : `admin-dashboard.component.ts`, `admin-retention.component.ts`,
  `admin-weekly-chart.component.ts` (granularité mensuelle), nouvel onglet Coûts IA
  (route et menu `app.ts:497`), `admin-model-costs.component.ts` déplacé.
- **Documentation** : section « Tableau de bord d'administration » de `CLAUDE.md`.
- Aucun changement des requêtes au modèle, des événements journalisés existants, ni des
  routes publiques.
