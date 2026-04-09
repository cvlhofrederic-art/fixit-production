-- Migration 050 — Add ville + code_postal to chantiers_btp
-- Separate city/postal from free-text address for reliable weather geocoding

ALTER TABLE chantiers_btp ADD COLUMN IF NOT EXISTS ville TEXT;
ALTER TABLE chantiers_btp ADD COLUMN IF NOT EXISTS code_postal TEXT;
