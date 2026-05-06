-- ── Subscription analytics tables ──────────────────────────────────────────
-- Series A hardening: gives Stripe lifecycle events a home and lets us
-- pre-aggregate MRR / churn snapshots in a tiny daily table that the admin
-- dashboard can read without scanning the full subscriptions table.
--
-- This migration is intentionally idempotent (CREATE TABLE IF NOT EXISTS,
-- CREATE POLICY IF NOT EXISTS where supported, otherwise wrapped in DO blocks)
-- so re-running it on environments that already have the tables is a no-op.

-- ── subscription_events ────────────────────────────────────────────────────
-- One row per "interesting" Stripe webhook event we want to analyse later
-- (refunds, trial-end warnings, payment-action-required, disputes, …).
-- The webhook route writes here defensively — if the table is missing in
-- a given environment the route just logs and continues, so no event is
-- ever lost between the existing stripe_webhook_events dedupe and the
-- moment this migration is applied.

CREATE TABLE IF NOT EXISTS subscription_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id          TEXT,                  -- not unique: a single Stripe event can map to several rows in the future
  event_type               TEXT NOT NULL,
  stripe_customer_id       TEXT,
  stripe_subscription_id   TEXT,
  payload                  JSONB NOT NULL DEFAULT '{}',
  occurred_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_type      ON subscription_events (event_type);
CREATE INDEX IF NOT EXISTS idx_sub_events_customer  ON subscription_events (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_occurred  ON subscription_events (occurred_at DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
-- No policies = service_role-only access, which matches how the webhook
-- and the admin dashboard read this table.

COMMENT ON TABLE subscription_events IS
  'Stripe lifecycle events for revenue analytics. Service-role access only.';

-- ── subscription_metrics ───────────────────────────────────────────────────
-- One row per day, aggregated by a daily cron. Powers the admin MRR card.

CREATE TABLE IF NOT EXISTS subscription_metrics (
  date           DATE PRIMARY KEY,
  active_count   INT  NOT NULL DEFAULT 0,
  mrr_cents      BIGINT NOT NULL DEFAULT 0,
  churn_count    INT  NOT NULL DEFAULT 0,
  new_count      INT  NOT NULL DEFAULT 0,
  trial_count    INT  NOT NULL DEFAULT 0,
  past_due_count INT  NOT NULL DEFAULT 0,
  snapshot_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_metrics_date ON subscription_metrics (date DESC);

ALTER TABLE subscription_metrics ENABLE ROW LEVEL SECURITY;
-- Service-role-only by default. The admin/revenue route reads this via
-- supabaseAdmin and gates on isSuperAdmin(user) at the application layer.

COMMENT ON TABLE subscription_metrics IS
  'Daily snapshot of MRR / churn / trial counts. Computed by a daily cron.';
