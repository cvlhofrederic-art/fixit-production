-- ── Cron heartbeats ───────────────────────────────────────────────────────
-- Each cron job inserts a row when it runs to completion. The Sentry alert
-- `cron_missing_heartbeat` (see monitoring/sentry-alerts.json) checks that
-- the expected cron names appear at the expected schedule, with a +30 min
-- grace window. Service-role-only.

CREATE TABLE IF NOT EXISTS cron_heartbeats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name   TEXT NOT NULL,
  ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INT,
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  details     JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_heartbeats_name_ran_at
  ON cron_heartbeats (cron_name, ran_at DESC);

ALTER TABLE cron_heartbeats ENABLE ROW LEVEL SECURITY;
-- Service-role-only access.

COMMENT ON TABLE cron_heartbeats IS
  'One row per cron run for SLO alerting (cron_missing_heartbeat). Service-role only.';
