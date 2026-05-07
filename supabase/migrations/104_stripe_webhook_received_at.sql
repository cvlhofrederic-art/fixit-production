-- ── Stripe webhook: received_at column ─────────────────────────────────────
-- Adds a received_at TIMESTAMPTZ column to stripe_webhook_events so the
-- gap (processed_at - received_at) is observable. The cron at
-- /api/cron/stripe-webhook-stale-check uses that gap to flag webhook
-- handlers that take suspiciously long (> 30 min from signature verify
-- to end-of-handler).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, the UPDATE is bounded by IS NULL,
-- the SET DEFAULT only applies to new rows.

ALTER TABLE stripe_webhook_events
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ;

-- Migration of existing rows: gap = 0 on the past, the real signal starts
-- post-deploy. Better than NULL (which would make the cron query null-aware
-- for no benefit).
UPDATE stripe_webhook_events
   SET received_at = processed_at
 WHERE received_at IS NULL;

ALTER TABLE stripe_webhook_events
  ALTER COLUMN received_at SET NOT NULL,
  ALTER COLUMN received_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_stripe_events_received
  ON stripe_webhook_events (received_at);

COMMENT ON COLUMN stripe_webhook_events.received_at IS
  'Timestamp of signature verify (start of handler). processed_at is end-of-handler. The gap is the observable signal for the stripe_webhook_stale_events alert (manifest sentry-alerts.json).';
