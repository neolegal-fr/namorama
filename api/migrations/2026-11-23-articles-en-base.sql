-- Articles du blog en base, révisions et jetons de rédaction.
--
-- Chantier `articles-en-base`. Les articles quittent le dépôt (`web/src/content/articles/`)
-- pour être corrigés et publiés sans déploiement : depuis l'administration, ou par Claude
-- avec un jeton de rédaction. Tables vides à la création : l'import des 31 articles passe
-- ensuite par l'API (`just article-importer`), pour que chacun traverse le compilateur.
--
-- `article.source` est la vérité (Markdown à en-tête) ; les autres colonnes en sont
-- dérivées à l'enregistrement. `jeton_api.empreinte` est un SHA-256 : aucune valeur de
-- jeton n'est stockée.
--
-- Appliquer AVANT de déployer l'image API qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-11-23-articles-en-base.sql
--
-- Retour arrière (perd les articles écrits en base depuis) :
--   DROP TABLE IF EXISTS article_revision, article, jeton_api;

CREATE TABLE IF NOT EXISTS article (
  id INT NOT NULL AUTO_INCREMENT,
  path VARCHAR(200) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description VARCHAR(500) NOT NULL,
  titre VARCHAR(300) NOT NULL,
  extrait VARCHAR(500) NOT NULL,
  categorie VARCHAR(40) NOT NULL,
  publie DATE NOT NULL,
  misAJour DATE NOT NULL,
  etat ENUM('brouillon', 'publie') NOT NULL DEFAULT 'brouillon',
  premiereParution DATE NULL,
  source MEDIUMTEXT NOT NULL,
  h1 TEXT NOT NULL,
  segments MEDIUMTEXT NOT NULL,
  liens TEXT NOT NULL,
  lecture SMALLINT NOT NULL,
  revision INT NOT NULL DEFAULT 1,
  creeLe DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  majLe DATETIME NOT NULL,
  majPar VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY IDX_article_path (path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS article_revision (
  id INT NOT NULL AUTO_INCREMENT,
  articleId INT NOT NULL,
  numero INT NOT NULL,
  source MEDIUMTEXT NOT NULL,
  auteurType ENUM('compte', 'jeton') NOT NULL,
  auteurId VARCHAR(64) NOT NULL,
  auteurNom VARCHAR(120) NOT NULL,
  creeLe DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY IDX_article_revision_numero (articleId, numero)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS jeton_api (
  id INT NOT NULL AUTO_INCREMENT,
  nom VARCHAR(80) NOT NULL,
  prefixe VARCHAR(12) NOT NULL,
  empreinte VARCHAR(64) NOT NULL,
  portee VARCHAR(20) NOT NULL DEFAULT 'articles',
  creePar VARCHAR(64) NOT NULL,
  creeLe DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  derniereUtilisation DATETIME NULL,
  revoqueLe DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY IDX_jeton_api_empreinte (empreinte)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
