-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 064 — rapports_btp table
-- Persists intervention reports (previously localStorage-only) to Supabase.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS rapports_btp (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chantier_id  UUID REFERENCES chantiers_btp(id) ON DELETE SET NULL,
  titre        TEXT,
  date         TEXT,
  contenu      JSONB NOT NULL DEFAULT '{}',
  photos       JSONB NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'brouillon',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE rapports_btp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rapports_btp_owner" ON rapports_btp
  FOR ALL USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS rapports_btp_owner_idx ON rapports_btp(owner_id);
CREATE INDEX IF NOT EXISTS rapports_btp_chantier_idx ON rapports_btp(chantier_id);
