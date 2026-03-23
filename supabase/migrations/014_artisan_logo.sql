-- Migration: Add logo_url column to profiles_artisan
-- Allows artisans to upload a company logo for PDF devis/factures

ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN profiles_artisan.logo_url IS 'URL du logo entreprise pour les devis/factures PDF';
