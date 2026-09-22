-- Tarifs du modèle vérifiés à la source, et le tarif en cache qui manquait.
--
-- Les tarifs de départ (`2026-09-22-consommation-du-modele.sql`) avaient été
-- recopiés du CLAUDE.md, sans vérification, et sans tarif en cache : l'entrée
-- servie par le cache était donc comptée au plein tarif, dix fois trop cher.
-- Relevé sur developers.openai.com/api/docs/pricing le 22/09/2026, tarif
-- standard :
--
--   gpt-5.6-luna   0,20 $ / 0,02 $ en cache / 1,20 $
--   gpt-5.6-terra  2,00 $ / 0,20 $ en cache / 12,00 $
--   gpt-5.6-sol    4,00 $ / 0,40 $ en cache / 20,00 $  (absent jusqu'ici)
--   web_search     10 $ les mille appels, contenu facturé au tarif d'entrée
--
-- Au-delà de 272 000 tokens d'entrée, luna et sol passent à un tarif « long
-- contexte » (×2 en entrée, ×1,5 en sortie). Nos appels en font quelques
-- milliers : il n'est pas modélisé.
--
-- Des UPDATE, et non des lignes datées : ce sont des corrections de saisie à
-- la même date d'effet, pas des changements de prix. Un changement de prix,
-- lui, se saisit depuis l'écran « Tarifs IA » de l'administration.
--
-- Déjà appliqué en production le 22/09/2026, à la main. Rejouable.
--   mysql -u<user> -p<pass> namorama < 2026-09-22-tarifs-verifies.sql
--
-- Retour arrière :
--   UPDATE model_price SET cachedInputPerM = NULL WHERE model IN ('gpt-5.6-luna', 'gpt-5.6-terra');
--   DELETE FROM model_price WHERE model = 'gpt-5.6-sol' AND effectiveFrom = '2026-01-01';

UPDATE model_price
   SET cachedInputPerM = 0.0200,
       note = 'Vérifié sur developers.openai.com/api/docs/pricing le 22/09/2026 (standard, contexte < 272k)'
 WHERE model = 'gpt-5.6-luna' AND effectiveFrom = '2026-01-01 00:00:00';

UPDATE model_price
   SET cachedInputPerM = 0.2000,
       note = 'Vérifié sur developers.openai.com/api/docs/pricing le 22/09/2026 (standard)'
 WHERE model = 'gpt-5.6-terra' AND effectiveFrom = '2026-01-01 00:00:00';

UPDATE model_price
   SET note = 'Vérifié le 22/09/2026 : 10 $ les mille appels, contenu de recherche facturé au tarif d''entrée du modèle'
 WHERE model = 'web_search' AND effectiveFrom = '2026-01-01 00:00:00';

INSERT IGNORE INTO model_price (model, effectiveFrom, inputPerM, cachedInputPerM, outputPerM, note)
VALUES ('gpt-5.6-sol', '2026-01-01 00:00:00', 4.0000, 0.4000, 20.0000,
        'Vérifié sur developers.openai.com/api/docs/pricing le 22/09/2026 (standard, contexte < 272k)');
