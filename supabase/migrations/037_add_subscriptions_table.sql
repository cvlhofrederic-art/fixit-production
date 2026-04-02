-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : add_subscriptions_table.sql
-- Date       : 2026-03-01
-- Description: Stripe subscription management table with RLS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id TEXT NOT NULL DEFAULT 'artisan_starter',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_subscription" ON subscriptions;
CREATE POLICY "users_read_own_subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Idempotency keys table (used by lib/idempotency.ts)
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  response_body JSONB,
  response_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_key ON idempotency_keys(key);

-- Auto-cleanup old idempotency keys (older than 24h)
-- Run periodically: DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours';
