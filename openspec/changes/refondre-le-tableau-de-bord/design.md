# Design

## Context

Voir `proposal.md` (Why) pour les constats et `specs/` pour les exigences. État actuel
qui contraint l'approche :

- Le tableau de bord est servi par trois routes admin : `GET /admin/stats` (période et
  période précédente, `admin.service.ts:801`), `GET /admin/series?weeks=` (26 semaines,
  `:902`), `GET /admin/retention` (`retention.service.ts:87`), et le relevé des coûts
  `GET /admin/model-costs` (`model-costs.service.ts:265`). Toutes calculent à la lecture,
  en SQL, sur des tables de quelques milliers de lignes.
- `user_activity_day` (une ligne par compte et par jour depuis le 23/08/2026, écrite dans
  `findOrCreate`) est la seule source d'activité datée. Le jour de création y figure
  toujours : un compte est actif le mois où il s'inscrit.
- Un favori est une suggestion `rating = 'liked'` ; la note n'est pas horodatée.
- `stripe_event` sert à l'idempotence : écrite avant l'ajout des crédits, pour toute
  session, sans montant ni compte. `handleWebhook` ne vérifie pas `payment_status`
  (`payments.service.ts:135-150`) ; `fulfillSession` accepte une session `complete` non
  payée (`:98`).
- Les deux prédicats d'exclusion vivent dans `admin/predicats.ts` (`comptesMesures()`) ;
  la base date à l'heure de Paris.

## Goals / Non-Goals

**Goals:**
- Chaque indicateur des specs calculé en une requête lisible, avec le prédicat partagé.
- Un registre des paiements écrit par les deux chemins de confirmation, sans jamais
  conditionner l'ajout des crédits.
- La page de pilotage tient en cinq blocs ; l'outil de réglage des coûts vit à part.

**Non-Goals:**
- Aucune table d'agrégats ni tâche planifiée.
- Pas de changement du tableau des utilisateurs, de son relevé de coûts par compte, ni
  de l'onglet Tarifs IA.
- Pas de correction du flux de crédits Stripe au-delà de ce qu'exige le registre (voir
  Risks).

## Decisions

### D1. Tout se calcule à la lecture, en SQL
Les volumes (139 comptes, ~2 000 jours d'activité, ~2 000 noms par mois) se lisent en
quelques millisecondes. **Écarté** : une table d'agrégats quotidiens alimentée par une
tâche planifiée — une seconde vérité à maintenir, et une tâche qui peut s'arrêter sans
bruit, pour un gain de latence nul à ce volume.

### D2. Le registre est une table dédiée, `paiement`
Colonnes : `id`, `sessionId` (unique), `keycloakId` (indexé), `pack`, `credits`,
`montantCentimes`, `devise`, `payeLe` (date Stripe `created` de la session, sinon
`NOW()`). Une méthode unique, appelée par `fulfillSession` et `handleWebhook` **après**
l'ajout des crédits, n'écrit que si `session.payment_status === 'paid'`, en
`INSERT IGNORE` sur `sessionId`, dans un `try/catch` qui journalise
`payment_record_failed` sans relancer.
**Écarté** : ajouter montant et compte à `stripe_event`. Cette table est écrite avant la
vérification du paiement, pour tous les types de session, et sert de verrou
d'idempotence ; lui faire porter le revenu mélangerait « déjà traité » et « encaissé ».
**Écarté** : interroger l'API Stripe à chaque affichage — latence, dépendance réseau dans
une page d'admin, et aucune trace si le compte Stripe change.

### D3. Rattrapage par un script lancé dans le conteneur de l'API
`api/src/scripts/rattraper-paiements.ts`, compilé avec l'API, lancé par
`docker compose exec api node dist/scripts/rattraper-paiements.js`. Il parcourt
`stripe_event`, relit chaque session chez Stripe et écrit par la même méthode que D2 ;
il n'appelle jamais `addExtraCredits`. **Écarté** : un `INSERT` SQL à la main — les
montants et les comptes des deux sessions ne sont connus que de Stripe.

### D4. Aucune conversion de devise
Le chiffre d'affaires s'affiche par devise (en pratique, l'euro) ; le coût IA reste en
dollars ; les deux montants sont côte à côte, sans marge calculée. **Écarté** : un taux
`EUR/USD` en variable d'environnement — un taux figé finit par être faux sans que rien
ne le signale, ce que le relevé des coûts s'interdit déjà (tarif daté, jamais de défaut).

### D5. Le libellé « MAU » dépend de la durée de la période
Les actifs restent « comptes distincts actifs dans la période choisie » ; à 28 jours ou
plus le libellé devient « MAU » et DAU moyen et DAU/MAU apparaissent. **Écarté** : un MAU
toujours calculé sur les 30 derniers jours, quelle que soit la période — la carte ne
répondrait plus au sélecteur au-dessus d'elle, ni à la comparaison avec la période
précédente.

### D6. Le taux de succès compte des projets, par date de création du projet
Unité : la recherche (le projet). Un projet de la période compte s'il porte au moins un
favori, quelle que soit la date de la note, faute d'horodatage. **Écarté** : un taux
par compte — un compte qui a réussi une fois masquerait ses recherches suivantes sans
favori. **Écarté** : dater par la création du nom — un « 10 de plus » sur un vieux projet
le ferait compter dans deux périodes.

### D7. Séries mensuelles à la place des séries hebdomadaires
`GET /admin/series?months=12` renvoie par mois civil : actifs décomposés (nouveaux,
retenus, réactivés, perdus), inscrits, chiffre d'affaires par devise, coût IA total
(calculé par `cout-sql.ts`, `null` avant le début du relevé). `admin-weekly-chart`
devient un composant de série générique (`admin-serie-chart`) avec une unité de temps.
**Écarté** : garder les semaines et ajouter les mois — deux granularités pour les mêmes
chiffres, à ~10 inscriptions par semaine où chaque barre hebdomadaire est du bruit.
Le relevé hebdomadaire par opération (`model-costs`) reste inchangé, dans l'onglet Coûts IA.

### D8. Rétention : décomposition et triangle depuis `user_activity_day` groupé par mois
Une requête `(userId, mois)` distincts, jointe à `user.createdAt`, fournit à la fois la
décomposition mensuelle et le triangle de cohortes ; le classement nouveau / retenu /
réactivé / perdu se fait en TypeScript, testable sans base. Durée de vie, jours actifs
par compte depuis l'inscription et leurs répartitions sont supprimés du service.
**Écarté** : des cohortes hebdomadaires — CLAUDE.md l'a déjà tranché, chaque case vaudrait
0, 20 ou 50 %.

### D9. Période partagée par paramètres d'URL
Le sélecteur de période devient un composant (`admin-periode`) utilisé par le tableau de
bord et l'onglet Coûts IA ; la période vit dans l'URL (`?periode=30j`,
`?periode=2026-09`, `?du=…&au=…`), si bien que le lien « Détail des coûts » garde la
période. Un mois civil se compare au mois civil précédent, pas aux N jours qui précèdent.
**Écarté** : un service Angular gardant la période en mémoire — perdue au rechargement,
et impossible à partager.

### D10. Contrats modifiés (admin uniquement)
- `GET /admin/stats` : ajoute `engagement` (DAU moyen, jours d'activité, tranches,
  comptes multi-projets, nouveaux / récurrents), `succes` (projets, projets avec favori,
  comptes ayant noté, retours écrits), `revenu` (par devise, paiements, payants période et
  cumul) ; retire `avgSuggestionsPerProject`, `avgFavoritesPerProject`,
  `totalFreeCredits`, `totalPackCredits`, `visitsReturning`/`visitsIdentified` de l'usage
  front.
- `GET /admin/series` : `weeks` → `months`, forme de réponse mensuelle.
- `GET /admin/retention` : ajoute `mensuel` et `cohortes[].mois[]` ; retire `dureeDeVie` et
  `joursActifs`.
- Journal : nouvel événement d'erreur `payment_record_failed` (`sessionId`, sans montant ni
  adresse). Aucune autre modification des événements, des routes publiques, du flux SSE
  ni des requêtes au modèle.
Le front et l'API partent dans la même image : aucune compatibilité ascendante à tenir.

## Risks / Trade-offs

- [« Actif » = un appel authentifié, ouvrir l'application suffit] → standard du marché,
  et le détail « dont ayant lancé une recherche » montre l'usage réel à côté.
- [À ce volume, un compte déplace un taux de plusieurs points] → socle de 5 conservé,
  valeurs brutes toujours affichées à côté des taux.
- [Le webhook crédite une session non payée (moyens de paiement différés)] → hors
  périmètre pour les crédits ; le registre, lui, exige `payment_status = 'paid'` et
  n'enregistre donc que de l'encaissé. Signalé dans CLAUDE.md pour un changement dédié.
- [Retirer des indicateurs qu'on regardait] → tous restent calculables en SQL ; leur
  retour serait une carte, pas une collecte.
- [Les deux paiements de mars sont peut-être des tests] → le rattrapage les enregistre tels
  que Stripe les décrit (`livemode` en log) ; s'ils sont en mode test, ils sont écartés.

## Migration Plan

1. Appliquer `api/migrations/2026-10-31-registre-des-paiements.sql` en prod
   (`CREATE TABLE IF NOT EXISTS paiement …`, retour arrière `DROP TABLE paiement` en
   en-tête), après sauvegarde datée.
2. Déployer l'image (API + web).
3. Lancer le rattrapage dans le conteneur, puis le relancer : 2 lignes, soldes inchangés.
4. Retour arrière : redéployer l'image précédente ; la table, inutilisée, peut rester.
