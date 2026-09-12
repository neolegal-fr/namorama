-- Rattrape les inscriptions que l'entonnoir n'a jamais marquées.
--
-- `visitor_session.accountCreated` était levé par le seul appel qui se
-- trouvait avoir créé le compte, et uniquement s'il s'agissait de l'un des
-- deux points d'entrée de `UsersController`. Or au chargement de
-- l'application, une dizaine d'appels authentifiés partent ensemble et passent
-- tous par `findOrCreate` sur un `sub` encore inconnu : n'importe lequel des
-- vingt appelants pouvait gagner, et les dix-huit autres avalaient
-- l'information.
--
-- Relevé sur les 9 comptes créés du 05 au 12/09/2026 : 2 marqués. Le compte
-- était créé par `GET /brand-report/summaries`, quelques dizaines de
-- millisecondes avant `GET /users/credits`. La marche « compte créé » de
-- l'entonnoir sous-comptait donc d'un facteur quatre — et rien ne le signalait,
-- le chiffre restant plausible.
--
-- Le code marque désormais sur un fait daté (`user.createdAt >= firstSeenAt`),
-- pas sur une course. Ce script applique le MÊME critère à l'historique, sinon
-- le correctif ne vaudrait que pour l'avenir et la courbe garderait une marche
-- artificielle au 12/09.
--
-- Le critère ne peut pas produire de faux positif : une visite dont le compte
-- lui est ANTÉRIEUR est un retour, pas une inscription, et `>=` l'écarte. Sur
-- les données de production au 12/09/2026, il redonne les 2 marquages déjà
-- corrects, en ajoute 7, et laisse hors du compte la seconde visite de
-- `d1d977f0` (compte créé 272 s avant qu'elle ne commence).
--
-- Idempotent : rejouable sans effet une fois appliqué (`accountCreated = 0`
-- dans le WHERE).
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-09-12-inscriptions-manquees.sql
--
-- Retour arrière — il n'existe pas de « défaire » fidèle : le drapeau perdu
-- n'était enregistré nulle part, c'est tout le problème. Pour revenir à l'état
-- d'avant, il faut rabattre à 0 les visites que ce script vient de lever :
--   UPDATE visitor_session v JOIN user u ON u.keycloakId = v.keycloakId
--      SET v.accountCreated = 0
--    WHERE v.accountCreated = 1 AND u.createdAt >= v.firstSeenAt;
--   (ce qui effacerait aussi les 2 marquages d'origine, identiques par
--    construction — d'où l'absence de retour arrière exact.)

UPDATE visitor_session v
  JOIN user u ON u.keycloakId = v.keycloakId
   SET v.accountCreated = 1
 WHERE v.accountCreated = 0
   AND u.createdAt >= v.firstSeenAt;
