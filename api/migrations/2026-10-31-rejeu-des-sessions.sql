-- Rejeu des sessions : les lots d'événements rrweb d'une visite consentante.
--
-- Les logs disent OÙ un visiteur s'arrête, jamais CE QU'IL A VU : 100 recherches
-- sur 313 refusées en silence du 22 au 29/10/2026 se lisaient dans le journal,
-- pas à l'écran. Le navigateur enregistre la visite (saisies masquées AVANT
-- envoi), l'envoie par lots, et l'administration la rejoue.
--
-- Une ligne par LOT, pas par visite : un lot part toutes les 10 s ou tous les
-- 200 événements. `segment` change à chaque redémarrage dans la même visite
-- (retour de Keycloak, rechargement), `seq` numérote les lots d'un segment.
-- L'unicité (sessionId, segment, seq) fait ignorer un lot renvoyé.
--
-- `data` est le JSON des événements, gzippé par l'API. `bytes` en est la taille
-- compressée : c'est elle que bornent les plafonds par visite et par jour.
--
-- Purge à `REPLAY_RETENTION_DAYS` (30 par défaut) sur `receivedAt`.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-10-31-rejeu-des-sessions.sql
--
-- Retour arrière :
--   DROP TABLE session_replay_chunk;

-- ⚠ LA COLLATION DE `sessionId` DOIT SUIVRE CELLE DE `visitor_session.sessionId`,
-- à laquelle la liste de l'administration le joint. MariaDB refuse de comparer
-- deux collations différentes, et ne le dit qu'en production (voir
-- 2026-08-24-journal-des-visites.sql) : d'où l'alignement dynamique plus bas.

CREATE TABLE IF NOT EXISTS session_replay_chunk (
  id          BIGINT       NOT NULL AUTO_INCREMENT,
  sessionId   VARCHAR(64)  NOT NULL,
  segment     SMALLINT     NOT NULL,
  seq         INT          NOT NULL,
  -- Horodatages rrweb (millisecondes depuis l'époque) du premier et du dernier événement.
  firstTs     BIGINT       NOT NULL,
  lastTs      BIGINT       NOT NULL,
  eventCount  INT          NOT NULL,
  -- Un message console de niveau `error` figure dans le lot.
  hasError    TINYINT(1)   NOT NULL DEFAULT 0,
  -- Chemin de la page au premier instantané du lot, sans requête ni fragment.
  href        VARCHAR(255) NULL,
  bytes       INT          NOT NULL,
  data        MEDIUMBLOB   NOT NULL,
  receivedAt  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY UQ_session_replay_chunk_lot (sessionId, segment, seq),
  INDEX IDX_session_replay_chunk_receivedAt (receivedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitor_session' AND COLUMN_NAME = 'sessionId'
);
SET @sql := CONCAT(
  'ALTER TABLE session_replay_chunk MODIFY sessionId VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ',
  @collation, ' NOT NULL'
);
PREPARE aligner FROM @sql;
EXECUTE aligner;
DEALLOCATE PREPARE aligner;
