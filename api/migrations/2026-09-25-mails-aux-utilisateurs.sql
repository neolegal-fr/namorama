-- Courriels écrits par un administrateur à un utilisateur pour lui demander
-- un retour.
--
-- Un destinataire à la fois, choisi dans la liste des utilisateurs, avec un
-- brouillon rédigé par le modèle à partir de son activité, relu avant envoi.
-- Chaque envoi est gardé — y compris les échecs SMTP — pour savoir, des mois
-- plus tard, si l'on a déjà écrit à quelqu'un et avec quelles consignes.
--
--   * `promptVersion` — version des consignes du brouillon : après une
--     amélioration du prompt, on sait à qui l'ancienne version a écrit ;
--   * `feedbackId` — la réponse reçue par courriel, saisie depuis l'admin,
--     devient un feedback ordinaire (et ouvre droit aux crédits promis).
--
-- Pas d'alignement de collation à prévoir : la table se joint à `user` par
-- `userId` (un entier), jamais par `keycloakId`.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-09-25-mails-aux-utilisateurs.sql
--
-- Retour arrière :
--   DROP TABLE admin_mail;

CREATE TABLE IF NOT EXISTS admin_mail (
  id          INT          NOT NULL AUTO_INCREMENT,
  userId      INT          NOT NULL,
  keycloakId  VARCHAR(255) NOT NULL,
  adminSub    VARCHAR(255) NOT NULL,
  subject     VARCHAR(200) NOT NULL,
  body        TEXT         NOT NULL,
  aiDrafted     TINYINT      NOT NULL DEFAULT 0,
  promptVersion VARCHAR(20)  NULL,
  delivered     TINYINT      NOT NULL,
  feedbackId    VARCHAR(36)  NULL,
  createdAt   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY IDX_admin_mail_user_date (userId, createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
