-- 031_marches_zones.sql
-- Extend marches table for multi-country support + test zones (FR dept 13 + Porto PT)

-- ── New columns for Portugal support + zone tagging ──
ALTER TABLE marches ADD COLUMN IF NOT EXISTS pays TEXT DEFAULT 'FR';
ALTER TABLE marches ADD COLUMN IF NOT EXISTS district TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS concelho TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS zone_test TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS langue TEXT DEFAULT 'fr';
ALTER TABLE marches ADD COLUMN IF NOT EXISTS titre_traduit TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS source_id TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS departement TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS procedure_type TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS cpv_codes TEXT[];
ALTER TABLE marches ADD COLUMN IF NOT EXISTS montant_estime NUMERIC(12,2);
ALTER TABLE marches ADD COLUMN IF NOT EXISTS acheteur TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS date_publication TIMESTAMPTZ;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS url_source TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_marches_pays ON marches(pays);
CREATE INDEX IF NOT EXISTS idx_marches_zone_test ON marches(zone_test);
CREATE INDEX IF NOT EXISTS idx_marches_district ON marches(district);
CREATE INDEX IF NOT EXISTS idx_marches_source ON marches(source);
CREATE INDEX IF NOT EXISTS idx_marches_departement ON marches(departement);
CREATE INDEX IF NOT EXISTS idx_marches_date_pub ON marches(date_publication DESC);

-- ── Unique constraint for upsert deduplication ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_marches_source_id ON marches(source, source_id) WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- ── Sync jobs tracking table ──
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  zone_test TEXT,
  statut TEXT DEFAULT 'running' CHECK (statut IN ('running', 'success', 'partial', 'failed')),
  nb_inserts INT DEFAULT 0,
  nb_updates INT DEFAULT 0,
  nb_errors INT DEFAULT 0,
  nb_skipped INT DEFAULT 0,
  error_detail TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_source ON sync_jobs(source);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created ON sync_jobs(created_at DESC);

-- ── RLS for sync_jobs (admin only write, public read for dashboard) ──
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_jobs_read" ON sync_jobs FOR SELECT USING (true);
CREATE POLICY "sync_jobs_write" ON sync_jobs FOR ALL USING (auth.role() = 'service_role');
