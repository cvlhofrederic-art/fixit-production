-- Migration: Informations de paiement artisan
-- Ajoute les modes de paiement configurables sur le profil artisan

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS paiement_modes JSONB NULL,
  ADD COLUMN IF NOT EXISTS paiement_mention_devis BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS paiement_mention_facture BOOLEAN DEFAULT true;

-- Structure paiement_modes :
-- [
--   { "type": "virement", "iban": "FR76...", "bic": "BNPA...", "titulaire": "Nom", "actif": true },
--   { "type": "stripe", "lien": "https://buy.stripe.com/...", "actif": true },
--   { "type": "cheque", "ordre": "Nom", "actif": false },
--   { "type": "especes", "actif": false },
--   { "type": "autre", "description": "PayPal, Lydia...", "actif": false }
-- ]

COMMENT ON COLUMN profiles_artisan.paiement_modes IS 'Modes de paiement configurés par l artisan (JSONB array)';
COMMENT ON COLUMN profiles_artisan.paiement_mention_devis IS 'Afficher les infos paiement sur les devis';
COMMENT ON COLUMN profiles_artisan.paiement_mention_facture IS 'Afficher les infos paiement sur les factures';
