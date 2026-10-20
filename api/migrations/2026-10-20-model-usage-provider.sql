-- Fournisseur de chaque appel au modèle : OpenAI ou Anthropic.
--
-- `AI_PROVIDER` choisit qui sert les appels, et `AI_FALLBACK_PROVIDER` peut
-- les faire passer chez l'autre quand les crédits du principal sont épuisés.
-- Le modèle suffit à chiffrer un appel (tarif par préfixe), mais pas à
-- rapprocher le relevé de deux factures : le total `anthropic` se compare à la
-- Console, le total `openai` à la facture OpenAI.
--
-- Le défaut range tout l'historique chez OpenAI, ce qui est exact : avant ce
-- script, namorama ne parlait qu'à lui.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-10-20-model-usage-provider.sql
--
-- Retour arrière :
--   ALTER TABLE model_usage DROP COLUMN provider;

ALTER TABLE model_usage
  ADD COLUMN IF NOT EXISTS provider VARCHAR(16) NOT NULL DEFAULT 'openai';
