-- Consommation du modèle, appel par appel : ce que chaque compte coûte en IA.
--
-- La facture OpenAI dit combien on paie, jamais POUR QUI. Le relevé du
-- 16/09/2026 (analyse 64 %, marché 18 %, génération 17 %) a dû être reconstitué
-- à la main depuis les logs ; il ne disait rien d'un compte en particulier, ni
-- de ce que coûterait un autre modèle.
--
-- Deux tables, et une règle : on stocke des TOKENS, jamais des montants.
--
--   * `model_usage`  — une ligne par appel réellement parti (un cache servi
--     n'en écrit pas). Entrée, part en cache, sortie, part de raisonnement,
--     appels d'outil. Rien d'autre à conserver pour recalculer un coût.
--   * `model_price`  — le tarif d'un modèle À PARTIR d'une date. Un changement
--     de prix est une ligne de plus : le coût d'un appel se calcule au tarif du
--     jour où il est parti, et l'historique reste juste. Une projection sur un
--     autre modèle applique simplement une autre ligne aux mêmes tokens.
--
-- Un appel des routes publiques de l'étape 1 n'a pas de compte : il porte la
-- session (`X-Session-Id`), que `visitor_session.keycloakId` relie au compte
-- dès le premier appel authentifié. Ce qui n'est jamais relié est le coût des
-- visiteurs non convertis — un chiffre en soi.
--
-- Rien de rétroactif : ni les logs ni la base ne gardaient les tokens. Le
-- tableau de bord affiche « mesuré depuis le … ».
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-09-22-consommation-du-modele.sql
--
-- Retour arrière :
--   DROP TABLE model_usage; DROP TABLE model_price;

CREATE TABLE IF NOT EXISTS model_usage (
  id                BIGINT       NOT NULL AUTO_INCREMENT,
  createdAt         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  keycloakId        VARCHAR(64)  NULL,
  sessionId         VARCHAR(64)  NULL,
  projectId         VARCHAR(36)  NULL,
  route             VARCHAR(120) NULL,
  operation         VARCHAR(32)  NOT NULL,
  model             VARCHAR(64)  NOT NULL,
  inputTokens       INT          NOT NULL DEFAULT 0,
  cachedInputTokens INT          NOT NULL DEFAULT 0,
  outputTokens      INT          NOT NULL DEFAULT 0,
  reasoningTokens   INT          NOT NULL DEFAULT 0,
  webSearchCalls    SMALLINT     NOT NULL DEFAULT 0,
  items             SMALLINT     NOT NULL DEFAULT 1,
  durationMs        INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  INDEX IDX_model_usage_createdAt (createdAt),
  INDEX IDX_model_usage_keycloakId (keycloakId),
  INDEX IDX_model_usage_sessionId (sessionId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS model_price (
  id              INT           NOT NULL AUTO_INCREMENT,
  model           VARCHAR(64)   NOT NULL,
  effectiveFrom   DATETIME      NOT NULL,
  inputPerM       DECIMAL(10,4) NOT NULL DEFAULT 0,
  cachedInputPerM DECIMAL(10,4) NULL,
  outputPerM      DECIMAL(10,4) NOT NULL DEFAULT 0,
  perCall         DECIMAL(10,4) NULL,
  note            VARCHAR(255)  NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX IDX_model_price_model_effectiveFrom (model, effectiveFrom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ⚠ COLLATIONS : les agrégats joignent `model_usage` à `visitor_session` (par
-- la session) et à `user` (par le compte). MariaDB refuse de comparer deux
-- collations différentes — c'est ce qui a mis le tableau de bord à 500 le
-- 24/08/2026. Alignement DYNAMIQUE, comme pour `visitor_session` : la règle est
-- « la même que la colonne jointe », quelle qu'elle soit sur cette base.
SET @collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'keycloakId'
);
SET @sql := CONCAT(
  'ALTER TABLE model_usage MODIFY keycloakId VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ',
  @collation, ' NULL'
);
PREPARE aligner FROM @sql;
EXECUTE aligner;
DEALLOCATE PREPARE aligner;

SET @collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitor_session' AND COLUMN_NAME = 'sessionId'
);
SET @sql := CONCAT(
  'ALTER TABLE model_usage MODIFY sessionId VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ',
  @collation, ' NULL'
);
PREPARE aligner FROM @sql;
EXECUTE aligner;
DEALLOCATE PREPARE aligner;

-- `model_usage.model` est comparé à `model_price.model` : même collation aussi.
SET @collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'model_usage' AND COLUMN_NAME = 'model'
);
SET @sql := CONCAT(
  'ALTER TABLE model_price MODIFY model VARCHAR(64) CHARACTER SET utf8mb4 COLLATE ',
  @collation, ' NOT NULL'
);
PREPARE aligner FROM @sql;
EXECUTE aligner;
DEALLOCATE PREPARE aligner;

-- Tarifs de départ, en dollars par million de tokens (cf. CLAUDE.md, « Coût
-- des appels au modèle »). Valables depuis le 01/01/2026 pour couvrir tout le
-- relevé. Le tarif en cache est laissé NULL : non relevé, il retombe sur le
-- tarif plein — une surestimation, jamais une sous-estimation.
--
-- Nouveau tarif = nouvelle ligne, avec sa date d'effet :
--   INSERT INTO model_price (model, effectiveFrom, inputPerM, outputPerM)
--   VALUES ('gpt-5.6-luna', '2026-10-01', 0.15, 1.00);
INSERT IGNORE INTO model_price (model, effectiveFrom, inputPerM, cachedInputPerM, outputPerM, perCall, note) VALUES
  ('gpt-5.6-luna',  '2026-01-01 00:00:00', 0.2000,  NULL, 1.2000,  NULL,   'OPENAI_MODEL — tarif relevé au 16/09/2026'),
  ('gpt-5.6-terra', '2026-01-01 00:00:00', 2.0000,  NULL, 12.0000, NULL,   'OPENAI_MODEL_CREATIVE — tarif relevé au 16/09/2026'),
  ('web_search',    '2026-01-01 00:00:00', 0.0000,  NULL, 0.0000,  0.0100, 'Frais d''outil : 10 $ les mille appels, en plus des tokens');
