-- ══════════════════════════════════════════════════════════════════════════════
-- Analytics Events — Lightweight GDPR-compliant event tracking
-- ══════════════════════════════════════════════════════════════════════════════
-- Stores batched client-side events sent via /api/analytics/track.
-- Retention: 90 days (proportionnalité RGPD).

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  page_url TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Query patterns: filter by event type + date range
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created
  ON analytics_events (event_type, created_at DESC);

-- Query patterns: user-level funnels
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
  ON analytics_events (user_id, created_at DESC);

-- Query patterns: session replay / grouping
CREATE INDEX IF NOT EXISTS idx_analytics_events_session
  ON analytics_events (session_id);

-- ── RLS: only service_role can INSERT/SELECT ─────────────────────────────────
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "analytics_events_service_role_all" ON analytics_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── Auto-delete after 90 days (pg_cron) ─────────────────────────────────────
-- Enable via Supabase Dashboard > Database > Extensions > pg_cron
-- Then run once:
SELECT cron.schedule(
  'analytics_events_cleanup',
  '0 4 * * 0',
  $$DELETE FROM analytics_events WHERE created_at < NOW() - INTERVAL '90 days'$$
);
