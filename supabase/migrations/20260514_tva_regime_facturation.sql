-- supabase/migrations/20260514_tva_regime_facturation.sql
-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Régime TVA au niveau facture/devis + support avoirs
-- Date: 2026-05-14
--
-- Pourquoi :
--   Le calcul TVA était implicite (toggle `tvaEnabled` global). Or le droit
--   fiscal français impose trois régimes distincts qui ne peuvent pas se
--   mélanger sur une même facture, et chacun a des mentions légales propres.
--
--   - classique           : assujetti normal, TVA collectée par taux
--   - franchise_293b      : franchise en base — CGI art. 293 B
--                           (abrogé au 1er sept 2026, ord. n°2025-1247 du 17/12/2025)
--   - autoliquidation_btp : sous-traitance BTP — CGI art. 283, 2 nonies
--
--   Cette migration ajoute le régime au niveau document, permettant :
--     1. Mentions légales conditionnelles dans le PDF
--     2. Override des taux TVA ligne par ligne (forcé à 0 si non-classique)
--     3. Stockage cohérent total_tax_cents / total_ttc_cents (corrige bug
--        antérieur où total_tax_cents=0 systématiquement)
--     4. Préparation export CA3 ultérieur (ventilation par régime)
--
--   Ajoute également la référence d'avoir (FK self-ref sur factures) :
--     un avoir = facture avec montants négatifs + avoir_de_facture_id pointant
--     vers la facture corrigée. Numérotation déjà gérée par next_doc_number
--     RPC avec préfixe AV-.
--
-- Garde-fous métier (appliqués côté API/form, pas DB) :
--   - autoliquidation_btp : nécessite client_type='professionnel' + client_siren
--     + tva_intra_emetteur. Hard block au save.
--   - classique : interdit si settings_btp.regime_tva = 'franchise'.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis
  ADD COLUMN regime_tva text NOT NULL DEFAULT 'classique'
    CHECK (regime_tva IN ('classique', 'franchise_293b', 'autoliquidation_btp')),
  ADD COLUMN client_type text DEFAULT 'professionnel'
    CHECK (client_type IN ('particulier', 'professionnel')),
  ADD COLUMN client_siren text,
  ADD COLUMN tva_intra_emetteur text,
  ADD COLUMN tva_intra_preneur text;

ALTER TABLE factures
  ADD COLUMN regime_tva text NOT NULL DEFAULT 'classique'
    CHECK (regime_tva IN ('classique', 'franchise_293b', 'autoliquidation_btp')),
  ADD COLUMN client_type text DEFAULT 'professionnel'
    CHECK (client_type IN ('particulier', 'professionnel')),
  ADD COLUMN client_siren text,
  ADD COLUMN tva_intra_emetteur text,
  ADD COLUMN tva_intra_preneur text,
  ADD COLUMN avoir_de_facture_id uuid REFERENCES factures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factures_avoir_de_facture_id
  ON factures(avoir_de_facture_id)
  WHERE avoir_de_facture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factures_regime_tva
  ON factures(artisan_user_id, regime_tva)
  WHERE regime_tva != 'classique';

COMMENT ON COLUMN devis.regime_tva IS
  'Régime TVA appliqué à ce devis : classique | franchise_293b | autoliquidation_btp. Distinct de settings_btp.regime_tva qui désigne le régime fiscal de la société.';
COMMENT ON COLUMN devis.client_type IS
  'particulier | professionnel — détermine éligibilité autoliquidation BTP.';
COMMENT ON COLUMN devis.client_siren IS
  'SIREN du donneur d''ordre, obligatoire pour autoliquidation BTP.';
COMMENT ON COLUMN devis.tva_intra_emetteur IS
  'N° TVA intracom de l''émetteur (snapshot au moment du devis), obligatoire pour autoliquidation BTP.';
COMMENT ON COLUMN devis.tva_intra_preneur IS
  'N° TVA intracom du donneur d''ordre, requis sur facture autoliquidation BTP.';

COMMENT ON COLUMN factures.regime_tva IS
  'Régime TVA appliqué à cette facture : classique | franchise_293b | autoliquidation_btp.';
COMMENT ON COLUMN factures.client_type IS
  'particulier | professionnel — détermine éligibilité autoliquidation BTP.';
COMMENT ON COLUMN factures.client_siren IS
  'SIREN du donneur d''ordre, obligatoire pour autoliquidation BTP.';
COMMENT ON COLUMN factures.tva_intra_emetteur IS
  'N° TVA intracom de l''émetteur (snapshot facture).';
COMMENT ON COLUMN factures.tva_intra_preneur IS
  'N° TVA intracom du donneur d''ordre.';
COMMENT ON COLUMN factures.avoir_de_facture_id IS
  'Si NOT NULL, cette facture est un avoir émis sur la facture référencée. Numéro AV-xxxx, montants négatifs. Mécanisme de correction des factures TVA mal facturées (ex. classique au lieu d''autoliquidation).';
