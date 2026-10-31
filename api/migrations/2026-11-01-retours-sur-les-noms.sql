-- Retours sur les noms, saisis sous la liste des résultats (« Affiner »).
--
-- Chantier `affiner-par-retour-libre` : les retours s'additionnent, ne valent que pour
-- les recherches suivantes et ne modifient jamais la description. Ils sont donc rangés
-- à part, sur le projet, et restaurés à sa réouverture.
--
-- JSON d'une liste de textes (au plus 10 × 200 caractères), en TEXT : un retour
-- contient naturellement des virgules (« plus court, plus doux »), qu'un
-- `simple-array` prendrait pour des séparateurs. `NULL` = aucun retour.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-11-01-retours-sur-les-noms.sql
--
-- Retour arrière (une image antérieure ignore la colonne) :
--   ALTER TABLE project DROP COLUMN retours;

ALTER TABLE project ADD COLUMN IF NOT EXISTS retours TEXT NULL;
