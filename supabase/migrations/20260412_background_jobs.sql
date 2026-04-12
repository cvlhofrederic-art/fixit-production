-- ── Background Jobs Queue Table ──────────────────────────────────────────────
-- Fallback queue for long-running async jobs when Cloudflare Queues
-- is not yet configured. Used during Vercel → Cloudflare migration.

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result JSONB,
  error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3
);

-- Index for polling pending jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_scheduled
  ON background_jobs (status, scheduled_at)
  WHERE status = 'pending';

-- Index for job type queries
CREATE INDEX IF NOT EXISTS idx_background_jobs_type
  ON background_jobs (type);

-- Auto-cleanup: delete completed jobs older than 7 days
-- (Run via cron or scheduled function)

-- RLS: only service role can access this table
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;

-- No RLS policies = only service_role (supabaseAdmin) can access
