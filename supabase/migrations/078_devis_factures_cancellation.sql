-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 078 — Soft-delete + colonnes annulation + RLS split (FR-V1)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Conformité loi anti-fraude TVA (art. 88 LF 2016) + LF 2026 :
-- - Aucun hard DELETE possible via RLS sur devis/factures (toute « suppression »
--   passe par UPDATE deleted_at ou cancelled_at).
-- - Documents émis ne peuvent plus être physiquement supprimés (art. L123-22
--   Code commerce, art. 242 nonies CGI).
-- - Trace immuable de l'annulation (raison, auteur, timestamp).

-- ── 1. Colonnes annulation + soft-delete ─────────────────────────────────────
ALTER TABLE devis ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE factures ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS cancelled_reason TEXT;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS cancelled_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
-- factures.deleted_at déjà migrée via 062

-- ── 2. Indexes partiels (perf sur les listes filtrées) ───────────────────────
CREATE INDEX IF NOT EXISTS idx_devis_cancelled_at
  ON devis(cancelled_at) WHERE cancelled_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devis_deleted_at
  ON devis(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_factures_cancelled_at
  ON factures(cancelled_at) WHERE cancelled_at IS NOT NULL;

-- ── 3. RLS split : SELECT/INSERT/UPDATE seulement (pas de DELETE) ────────────
-- Remplacement du FOR ALL policy par 3 policies séparées.
-- L'absence volontaire de FOR DELETE policy = DELETE refusé par défaut sous RLS.

-- DEVIS
DROP POLICY IF EXISTS "devis_owner_access" ON devis;
DROP POLICY IF EXISTS "devis_owner_select" ON devis;
DROP POLICY IF EXISTS "devis_owner_insert" ON devis;
DROP POLICY IF EXISTS "devis_owner_update" ON devis;

CREATE POLICY "devis_owner_select" ON devis
  FOR SELECT
  USING (artisan_user_id = auth.uid());

CREATE POLICY "devis_owner_insert" ON devis
  FOR INSERT
  WITH CHECK (artisan_user_id = auth.uid());

CREATE POLICY "devis_owner_update" ON devis
  FOR UPDATE
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- FACTURES
DROP POLICY IF EXISTS "factures_owner_access" ON factures;
DROP POLICY IF EXISTS "factures_owner_select" ON factures;
DROP POLICY IF EXISTS "factures_owner_insert" ON factures;
DROP POLICY IF EXISTS "factures_owner_update" ON factures;

CREATE POLICY "factures_owner_select" ON factures
  FOR SELECT
  USING (artisan_user_id = auth.uid());

CREATE POLICY "factures_owner_insert" ON factures
  FOR INSERT
  WITH CHECK (artisan_user_id = auth.uid());

CREATE POLICY "factures_owner_update" ON factures
  FOR UPDATE
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- ── 4. Commentaires de documentation ─────────────────────────────────────────
COMMENT ON COLUMN devis.cancelled_at IS 'Horodatage annulation (post-envoi). NULL = non annulé.';
COMMENT ON COLUMN devis.cancelled_reason IS 'Raison libre de l''annulation (5-500 chars) — preuve fiscale.';
COMMENT ON COLUMN devis.cancelled_by_user_id IS 'Utilisateur ayant annulé.';
COMMENT ON COLUMN devis.deleted_at IS 'Soft-delete brouillon uniquement. Filtre côté UI.';

COMMENT ON COLUMN factures.cancelled_at IS 'Horodatage annulation (post-envoi). NULL = non annulée.';
COMMENT ON COLUMN factures.cancelled_reason IS 'Raison libre de l''annulation (5-500 chars) — preuve fiscale.';
COMMENT ON COLUMN factures.cancelled_by_user_id IS 'Utilisateur ayant annulé.';
