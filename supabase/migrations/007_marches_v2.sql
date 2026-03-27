-- ═══════════════════════════════════════════════════════════════
-- BOURSE AUX MARCHÉS V2 — Géolocalisation, matching, exigences
-- ═══════════════════════════════════════════════════════════════

-- 1. Nouveaux champs artisan : préférences bourse
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_opt_in BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_categories TEXT[] DEFAULT '{}';
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_work_mode TEXT DEFAULT 'forfait';
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_tarif_journalier NUMERIC(10,2);
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_tarif_horaire NUMERIC(10,2);
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS marches_description TEXT;

-- Compliance flags (synced from wallet uploads)
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS rc_pro_valid BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS decennale_valid BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS rge_valid BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS qualibat_valid BOOLEAN DEFAULT false;

-- 2. Nouveaux champs marches : géoloc, exigences, matching
ALTER TABLE marches ADD COLUMN IF NOT EXISTS location_lat NUMERIC(10,7);
ALTER TABLE marches ADD COLUMN IF NOT EXISTS location_lng NUMERIC(10,7);
ALTER TABLE marches ADD COLUMN IF NOT EXISTS max_candidatures INT DEFAULT 3;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS require_rc_pro BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS require_decennale BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS require_rge BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS require_qualibat BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS preferred_work_mode TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS matched_artisans UUID[] DEFAULT '{}';

-- 3. Index pour matching géographique
CREATE INDEX IF NOT EXISTS idx_marches_location ON marches(location_lat, location_lng) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_artisan_marches_opt_in ON profiles_artisan(marches_opt_in) WHERE marches_opt_in = true;
CREATE INDEX IF NOT EXISTS idx_artisan_marches_categories ON profiles_artisan USING GIN(marches_categories);

-- ═══════════════════════════════════════════════════════════════
-- V2.1: Extended publisher types & dynamic fields
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE marches ALTER COLUMN publisher_type SET DEFAULT 'particulier_proprietaire';
ALTER TABLE marches ADD COLUMN IF NOT EXISTS publisher_company TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS publisher_siret TEXT;
-- Syndic fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS immeuble_nom TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS immeuble_adresse TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS partie_commune BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS nb_lots INT;
-- Conciergerie fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS type_hebergement TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS nb_unites INT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS contrainte_calendrier TEXT;
-- BTP fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS lot_technique TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS reference_chantier TEXT;
-- Promoteur fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS programme_immobilier TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS phase_chantier TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS nb_logements INT;
-- Commerce fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS type_etablissement TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS mise_aux_normes BOOLEAN DEFAULT false;
-- Assurance fields
ALTER TABLE marches ADD COLUMN IF NOT EXISTS numero_sinistre TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS type_sinistre TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS expert_referent TEXT;
