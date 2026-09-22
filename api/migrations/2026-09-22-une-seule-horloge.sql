-- Une seule horloge : ramener à l'heure de Paris les dates que l'API écrivait en UTC.
--
-- La base date elle-même, à l'heure de Paris (`@@system_time_zone = CEST`),
-- tout ce qui passe par `CURRENT_TIMESTAMP` ou `NOW()` : création des comptes,
-- projets, rapports, feedbacks, visites. L'API, dans un conteneur sans `TZ`,
-- datait le reste en UTC : `new Date()` est sérialisé par le pilote dans le
-- fuseau du processus. Relevé le 22/09/2026 : 66 comptes sur 79 avaient une
-- dernière activité antérieure à leur création, de ~2 h en été, ~1 h en hiver.
--
-- L'image corrigée pose `TZ=Europe/Paris`. Ce script ramène les valeurs déjà
-- écrites en UTC dans le même fuseau :
--
--   user.lastLogin, user.lastFreeReset,
--   domain_suggestion.createdAt, domain_suggestion.checkedAt,
--   project_share.acceptedAt
--
-- Décalage de Paris calculé à la main : MariaDB n'a pas les tables de fuseaux
-- (`mysql.time_zone_name` est vide, `CONVERT_TZ` rend NULL). +2 h pendant
-- l'heure d'été 2026 (du 29/03 01:00 UTC au 25/10 01:00 UTC), +1 h sinon. Les
-- données commencent en mars 2026 ; une valeur antérieure au 01/01/2026 fait
-- échouer le script plutôt que d'être décalée d'une heure au hasard.
--
-- Le journal d'activité (`user_activity_day`) n'est PAS corrigé : il ne garde
-- que le jour, et rien ne dit quelles lignes ont été rangées la veille. L'erreur
-- se limite aux activités de 0 h à 2 h (heure de Paris) avant la bascule.
--
-- ⚠ ORDRE INVERSE DE L'HABITUDE : APRÈS le déploiement de l'image, pas avant.
-- Seules les valeurs ANTÉRIEURES à l'instant de bascule sont corrigées. Toute
-- valeur écrite par la nouvelle image est à l'heure de Paris, donc au moins deux
-- heures au-delà de cet instant exprimé en UTC : les deux familles ne se
-- chevauchent pas, et l'ancienne peut être isolée par une simple comparaison.
--
-- `@bascule` = démarrage du nouveau conteneur, en UTC :
--   docker inspect -f '{{.State.StartedAt}}' namorama-api-1
--
-- Une seule exécution : la table `correctif_applique` retient le passage, et un
-- second lancement ne décale plus rien.
--
-- Application :
--   sed "s/@BASCULE@/2026-09-22 11:30:00/" 2026-09-22-une-seule-horloge.sql | mysql … namorama
--
-- Retour arrière : restaurer la sauvegarde prise juste avant
-- (`backups/horloge-<date>.sql`, tables user, domain_suggestion, project_share).

SET @bascule := '@BASCULE@';

CREATE TABLE IF NOT EXISTS correctif_applique (
  nom        VARCHAR(64) NOT NULL,
  appliqueLe DATETIME    NOT NULL,
  PRIMARY KEY (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @deja := (SELECT COUNT(*) FROM correctif_applique WHERE nom = 'une-seule-horloge');

-- Garde-fou : la bascule doit être une date, et une valeur antérieure à 2026
-- n'a pas de règle de décalage ici. Un `SIGNAL` arrête tout avant la moindre écriture.
DELIMITER //
CREATE OR REPLACE PROCEDURE verifier_horloge()
BEGIN
  IF STR_TO_DATE(@bascule, '%Y-%m-%d %H:%i:%s') IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '@bascule absente ou mal formée';
  END IF;
  IF (SELECT LEAST(
        COALESCE((SELECT MIN(lastLogin) FROM user), '2099-01-01'),
        COALESCE((SELECT MIN(lastFreeReset) FROM user), '2099-01-01'),
        COALESCE((SELECT MIN(createdAt) FROM domain_suggestion), '2099-01-01'),
        COALESCE((SELECT MIN(checkedAt) FROM domain_suggestion), '2099-01-01'),
        COALESCE((SELECT MIN(acceptedAt) FROM project_share), '2099-01-01'))) < '2026-01-01' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Date antérieure à 2026 : règle de décalage à compléter';
  END IF;
END //
DELIMITER ;
CALL verifier_horloge();
DROP PROCEDURE verifier_horloge;

-- Décalage de Paris pour un instant UTC de 2026.
--   heure d'été : 29/03/2026 01:00 UTC → 25/10/2026 01:00 UTC
START TRANSACTION;

UPDATE user
   SET lastLogin = lastLogin + INTERVAL
       IF(lastLogin >= '2026-03-29 01:00:00' AND lastLogin < '2026-10-25 01:00:00', 2, 1) HOUR
 WHERE @deja = 0 AND lastLogin IS NOT NULL AND lastLogin < @bascule;

UPDATE user
   SET lastFreeReset = lastFreeReset + INTERVAL
       IF(lastFreeReset >= '2026-03-29 01:00:00' AND lastFreeReset < '2026-10-25 01:00:00', 2, 1) HOUR
 WHERE @deja = 0 AND lastFreeReset IS NOT NULL AND lastFreeReset < @bascule;

UPDATE domain_suggestion
   SET createdAt = createdAt + INTERVAL
       IF(createdAt >= '2026-03-29 01:00:00' AND createdAt < '2026-10-25 01:00:00', 2, 1) HOUR
 WHERE @deja = 0 AND createdAt IS NOT NULL AND createdAt < @bascule;

UPDATE domain_suggestion
   SET checkedAt = checkedAt + INTERVAL
       IF(checkedAt >= '2026-03-29 01:00:00' AND checkedAt < '2026-10-25 01:00:00', 2, 1) HOUR
 WHERE @deja = 0 AND checkedAt IS NOT NULL AND checkedAt < @bascule;

UPDATE project_share
   SET acceptedAt = acceptedAt + INTERVAL
       IF(acceptedAt >= '2026-03-29 01:00:00' AND acceptedAt < '2026-10-25 01:00:00', 2, 1) HOUR
 WHERE @deja = 0 AND acceptedAt IS NOT NULL AND acceptedAt < @bascule;

INSERT IGNORE INTO correctif_applique (nom, appliqueLe) VALUES ('une-seule-horloge', NOW());

COMMIT;

-- Contrôle : il ne doit plus rester de compte actif avant d'exister (hors
-- écart de quelques secondes entre la création et le premier appel).
SELECT COUNT(*) AS actifs_avant_creation
  FROM user
 WHERE lastLogin < createdAt - INTERVAL 1 MINUTE;
