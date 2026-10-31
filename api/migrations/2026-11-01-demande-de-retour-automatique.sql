-- Demande de retour automatique, 24 h après l'inscription (chantier
-- `demande-de-retour-automatique`).
--
-- user.demandeRetourAt     : réservation de l'envoi automatique (posée AVANT l'envoi,
--                            par UPDATE … WHERE demandeRetourAt IS NULL — un seul envoi
--                            par compte, même si deux passages se croisent).
-- user.utilite / utiliteAt : réponse « oui » / « non » au clic du courriel, et sa date.
--                            Posées une seule fois : c'est le verrou des 100 crédits.
-- user.desinscritRetoursAt : désinscription des demandes de retour, automatiques ou manuelles.
-- user.langueInscription   : langue du navigateur à la création du compte (Accept-Language),
--                            limitée aux langues traduites ; `locale` (Keycloak) est vide
--                            pour la plupart des comptes.
-- admin_mail.automatique   : la ligne vient de l'envoi automatique, sans administrateur
--                            (adminSub devient donc facultatif).
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-11-01-demande-de-retour-automatique.sql
--
-- Retour arrière (une image antérieure ignore ces colonnes ; rendre adminSub
-- obligatoire suppose qu'aucune ligne automatique n'existe) :
--   ALTER TABLE user DROP COLUMN demandeRetourAt, DROP COLUMN utilite, DROP COLUMN utiliteAt,
--     DROP COLUMN desinscritRetoursAt, DROP COLUMN langueInscription;
--   DELETE FROM admin_mail WHERE automatique = 1;
--   ALTER TABLE admin_mail DROP COLUMN automatique, MODIFY adminSub VARCHAR(255) NOT NULL;

ALTER TABLE user
  ADD COLUMN IF NOT EXISTS demandeRetourAt DATETIME NULL,
  ADD COLUMN IF NOT EXISTS utilite VARCHAR(3) NULL,
  ADD COLUMN IF NOT EXISTS utiliteAt DATETIME NULL,
  ADD COLUMN IF NOT EXISTS desinscritRetoursAt DATETIME NULL,
  ADD COLUMN IF NOT EXISTS langueInscription VARCHAR(5) NULL;

ALTER TABLE admin_mail
  ADD COLUMN IF NOT EXISTS automatique TINYINT(1) NOT NULL DEFAULT 0,
  MODIFY adminSub VARCHAR(255) NULL;
