-- Longueur maximale des noms, réglée à l'étape de cadrage (« au plus N caractères »).
--
-- Chantier `refondre-l-ecran-de-cadrage` : l'écran ne règle plus qu'un MAXIMUM, le
-- minimum est un plancher fixé par le produit (6). `NULL` = « non réglé » : la
-- recherche applique alors la longueur du brief, ou le défaut [6, 10]. Ne pas
-- donner de valeur par défaut : un projet existant n'a jamais choisi de maximum,
-- et lui en prêter un le ferait passer pour un réglage explicite.
--
-- `project.minLength` reste en place, ni écrit ni lu : sa suppression est
-- reportée, pour qu'un retour arrière de l'image ne trouve pas de colonne manquante.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-11-01-longueur-maximale-du-projet.sql
--
-- Retour arrière :
--   ALTER TABLE project DROP COLUMN maxLength;

ALTER TABLE project ADD COLUMN IF NOT EXISTS maxLength INT NULL;
