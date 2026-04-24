-- Migration 062 — Add deleted_at soft-delete column to factures
-- Required by v_rentabilite_chantier view (060) which filters on f.deleted_at IS NULL

ALTER TABLE factures
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_factures_deleted_at
  ON factures(deleted_at) WHERE deleted_at IS NOT NULL;
