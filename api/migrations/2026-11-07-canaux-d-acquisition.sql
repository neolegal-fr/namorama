-- Origine d'une visite : page d'arrivée, paramètres de campagne, domaine référent.
--
-- Chantier `mesurer-les-canaux-d-acquisition`. Écrites une seule fois, par le premier
-- `page_viewed` de la visite ; `NULL` partout pour une visite antérieure à la mesure ou
-- créée par une étape sans affichage reçu. Le canal (ChatGPT, moteurs, réseaux…) n'est
-- PAS stocké : il se déduit à la lecture (`api/src/common/funnel/origine.ts`), pour
-- qu'une règle corrigée vaille aussi pour les visites passées.
--
-- Aucune donnée identifiante : le référent est réduit à son domaine dans le navigateur,
-- et les paramètres de campagne passent un jeu de caractères strict.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-11-07-canaux-d-acquisition.sql
--
-- Retour arrière :
--   ALTER TABLE visitor_session DROP COLUMN landingPath, DROP COLUMN utmSource,
--     DROP COLUMN utmMedium, DROP COLUMN utmCampaign, DROP COLUMN referrerHost;

ALTER TABLE visitor_session ADD COLUMN IF NOT EXISTS landingPath VARCHAR(120) NULL;
ALTER TABLE visitor_session ADD COLUMN IF NOT EXISTS utmSource VARCHAR(60) NULL;
ALTER TABLE visitor_session ADD COLUMN IF NOT EXISTS utmMedium VARCHAR(60) NULL;
ALTER TABLE visitor_session ADD COLUMN IF NOT EXISTS utmCampaign VARCHAR(60) NULL;
ALTER TABLE visitor_session ADD COLUMN IF NOT EXISTS referrerHost VARCHAR(120) NULL;
