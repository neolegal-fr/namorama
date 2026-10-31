# paiements Specification

## Purpose
Garder une trace durable et exacte de chaque paiement Stripe abouti — qui, quoi, combien,
quand — pour que le revenu se lise en base plutôt que dans le tableau de bord Stripe.

## Requirements

### Requirement: Enregistrement d'un paiement abouti
À chaque session Stripe de pack payée, le système SHALL enregistrer un paiement portant
le compte payeur, le pack, les crédits ajoutés, le montant encaissé en centimes, la devise
et la date de paiement.

#### Scenario: Pack découverte payé
- **WHEN** un compte paie un pack « découverte » de 500 crédits
- **THEN** un paiement est enregistré avec ce compte, le pack « decouverte », 500 crédits, le montant total de la session Stripe et sa devise

### Requirement: Un paiement par session
Une même session Stripe SHALL produire au plus un paiement enregistré, qu'elle soit
confirmée par le retour du navigateur, par le webhook, ou par les deux.

#### Scenario: Webhook après le retour du navigateur
- **WHEN** le retour du navigateur a déjà traité une session et que le webhook de cette même session arrive ensuite
- **THEN** le registre ne contient toujours qu'un paiement pour cette session

### Requirement: Session non payée
Une session dont le statut de paiement n'est pas « payé » SHALL NOT produire de paiement
enregistré.

#### Scenario: Paiement abandonné
- **WHEN** une session de pack est créée puis expire sans paiement
- **THEN** aucun paiement n'est enregistré et aucun crédit n'est ajouté

### Requirement: Rattrapage des paiements passés
Les sessions déjà traitées avant la mise en place du registre SHALL pouvoir être
enregistrées depuis l'API Stripe, sans ajouter de crédits et sans créer de doublon si le
rattrapage est relancé.

#### Scenario: Les deux paiements de mars 2026
- **WHEN** le rattrapage est lancé sur les 2 sessions traitées les 2 et 15/03/2026, puis relancé
- **THEN** le registre contient exactement 2 paiements datés de ces jours, et aucun solde de crédits n'a changé

### Requirement: Échec d'enregistrement sans perte de crédits
Un échec d'écriture du paiement SHALL NOT empêcher l'ajout des crédits achetés, et SHALL
être journalisé en erreur avec l'identifiant de session.

#### Scenario: Base indisponible au moment de l'écriture
- **WHEN** l'écriture du paiement échoue après la confirmation Stripe
- **THEN** le compte reçoit ses crédits, et une erreur `payment_record_failed` porte l'identifiant de session pour un rattrapage
