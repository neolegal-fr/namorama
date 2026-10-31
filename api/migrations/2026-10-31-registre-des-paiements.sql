-- Registre des paiements : le chiffre d'affaires lisible en base.
--
-- `stripe_event` ne garde que `sessionId`, `type` et `processedAt` : c'est un
-- verrou d'idempotence, écrit AVANT de savoir si la session est payée, pour
-- tout type de session. Ni montant, ni pack, ni compte : relevé le 31/10/2026,
-- aucun indicateur de revenu n'était calculable, et le stock `extraCredits`
-- mélange achats et crédits offerts à la main (7 comptes en ont pour 2
-- paiements).
--
-- Une ligne par session Stripe PAYÉE (`payment_status = 'paid'`), écrite par
-- le retour du navigateur comme par le webhook — `sessionId` unique, donc une
-- seule ligne quel que soit le chemin. Les montants sont en CENTIMES, dans la
-- devise de la session : aucune conversion n'est faite ni stockée.
--
-- Les sessions antérieures se rattrapent depuis l'API Stripe :
--   docker compose exec api node dist/scripts/rattraper-paiements.js
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-10-31-registre-des-paiements.sql
--
-- Retour arrière :
--   DROP TABLE paiement;

CREATE TABLE IF NOT EXISTS paiement (
  id              INT          NOT NULL AUTO_INCREMENT,
  sessionId       VARCHAR(255) NOT NULL,
  keycloakId      VARCHAR(64)  NOT NULL,
  pack            VARCHAR(32)  NOT NULL,
  credits         INT          NOT NULL,
  montantCentimes INT          NOT NULL,
  devise          VARCHAR(3)   NOT NULL,
  payeLe          DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX UQ_paiement_sessionId (sessionId),
  INDEX IDX_paiement_keycloakId (keycloakId),
  INDEX IDX_paiement_payeLe (payeLe)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ⚠ Même piège que `visitor_session` : les agrégats joignent `paiement` à
-- `user` sur `keycloakId`, et MariaDB refuse de comparer deux collations
-- différentes (le tableau de bord entier passerait à 500). La collation suit
-- donc celle de `user.keycloakId`, quelle qu'elle soit sur cette base.
SET @collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'keycloakId'
);
SET @sql := CONCAT(
  'ALTER TABLE paiement MODIFY keycloakId VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ',
  @collation, ' NOT NULL'
);
PREPARE aligner FROM @sql;
EXECUTE aligner;
DEALLOCATE PREPARE aligner;
