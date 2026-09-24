-- Tarifs consultés : l'offre est-elle seulement vue ?
--
-- Stripe est branché, trois packs sont en vente, et personne n'a rien acheté.
-- Deux lectures possibles — « personne ne voit l'offre » ou « tout le monde la
-- refuse » — et aucune mesure durable pour trancher : l'événement
-- `credits_dialog_opened` (depuis le 12/09/2026) ne vit que dans les logs, qui
-- tournent sur 30 jours.
--
-- Deux drapeaux de plus sur la visite, comme les autres marches de l'entonnoir :
--
--   * `pricingViewed`   — le dialogue des packs a été ouvert (la seule « page
--     tarifs » du produit), marqué par `POST /events` ;
--   * `checkoutStarted` — une session Stripe Checkout a été créée, marqué côté
--     serveur par `POST /payments/checkout/pack`.
--
-- Appliquer AVANT de déployer l'image qui en dépend :
--   mysql -u<user> -p<pass> namorama < 2026-09-24-tarifs-consultes.sql
--
-- Retour arrière :
--   ALTER TABLE visitor_session DROP COLUMN pricingViewed, DROP COLUMN checkoutStarted;

ALTER TABLE visitor_session
  ADD COLUMN IF NOT EXISTS pricingViewed   TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkoutStarted TINYINT NOT NULL DEFAULT 0;

-- Rattrapage : les ouvertures du 12/09/2026 à ce jour sont dans les logs, pas
-- en base. Il est produit à part, depuis les logs de production, par
-- `scripts/rattraper-tarifs-consultes.py` : un fichier SQL daté, relu, puis
-- appliqué — jamais écrit ici, où il figerait les sessions d'un jour donné.
