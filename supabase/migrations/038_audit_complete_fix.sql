-- ============================================================================
-- MIGRATION: Audit complet — Corrections sécurité, intégrité, géolocalisation
-- Date: 2026-03-06
-- ============================================================================

-- ── 1. Table idempotency_keys ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  response_body JSONB,
  response_status INTEGER NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

-- Auto-cleanup keys older than 24h (run via pg_cron or Supabase scheduled function)
-- SELECT cron.schedule('cleanup-idempotency', '0 * * * *', $$DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'$$);

-- ── 2. Table devis (persistance serveur) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS devis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id UUID NOT NULL,
  artisan_user_id UUID REFERENCES auth.users(id),
  numero TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_ht_cents BIGINT NOT NULL DEFAULT 0,
  total_tax_cents BIGINT NOT NULL DEFAULT 0,
  total_ttc_cents BIGINT NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tax_label TEXT NOT NULL DEFAULT 'TVA',
  currency TEXT NOT NULL DEFAULT 'EUR',
  country TEXT NOT NULL DEFAULT 'FR',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','signed','expired','cancelled')),
  valid_until DATE,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  pdf_url TEXT,
  notes TEXT,
  legal_mentions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devis_artisan ON devis(artisan_id);
CREATE INDEX IF NOT EXISTS idx_devis_artisan_user ON devis(artisan_user_id);
CREATE INDEX IF NOT EXISTS idx_devis_status ON devis(status);

-- RLS
ALTER TABLE devis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devis_owner_access" ON devis;
CREATE POLICY "devis_owner_access" ON devis
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- ── 3. Table factures (persistance serveur) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS factures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  devis_id UUID REFERENCES devis(id),
  artisan_id UUID NOT NULL,
  artisan_user_id UUID REFERENCES auth.users(id),
  numero TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_ht_cents BIGINT NOT NULL DEFAULT 0,
  total_tax_cents BIGINT NOT NULL DEFAULT 0,
  total_ttc_cents BIGINT NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
  tax_label TEXT NOT NULL DEFAULT 'TVA',
  currency TEXT NOT NULL DEFAULT 'EUR',
  country TEXT NOT NULL DEFAULT 'FR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','cancelled','refunded')),
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  pdf_url TEXT,
  notes TEXT,
  legal_mentions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factures_artisan ON factures(artisan_id);
CREATE INDEX IF NOT EXISTS idx_factures_artisan_user ON factures(artisan_user_id);
CREATE INDEX IF NOT EXISTS idx_factures_status ON factures(status);
CREATE INDEX IF NOT EXISTS idx_factures_devis ON factures(devis_id);

-- RLS
ALTER TABLE factures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "factures_owner_access" ON factures;
CREATE POLICY "factures_owner_access" ON factures
  USING (artisan_user_id = auth.uid())
  WITH CHECK (artisan_user_id = auth.uid());

-- ── 4. Colonnes géolocalisation + pays sur profiles_artisan ──────────────────
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'FR';
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Index pour recherche par pays + géolocalisation
CREATE INDEX IF NOT EXISTS idx_artisan_country ON profiles_artisan(country);
CREATE INDEX IF NOT EXISTS idx_artisan_geo ON profiles_artisan(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_artisan_active_country ON profiles_artisan(active, country);

-- ── 5. Fonction Haversine pour calcul de distance ────────────────────────────
CREATE OR REPLACE FUNCTION haversine_distance(
  lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
  SELECT 6371.0 * acos(
    LEAST(1.0, GREATEST(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1)) +
      sin(radians(lat1)) * sin(radians(lat2))
    ))
  )
$$ LANGUAGE SQL IMMUTABLE STRICT;

-- ── 6. Fonction RPC recherche artisans proches ───────────────────────────────
CREATE OR REPLACE FUNCTION search_artisans_nearby(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 30,
  country_filter TEXT DEFAULT NULL,
  category_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  company_name TEXT,
  bio TEXT,
  categories TEXT[],
  hourly_rate NUMERIC,
  rating_avg NUMERIC,
  rating_count INTEGER,
  verified BOOLEAN,
  active BOOLEAN,
  zone_radius_km INTEGER,
  phone TEXT,
  email TEXT,
  company_city TEXT,
  company_postal_code TEXT,
  profile_photo_url TEXT,
  country TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION
) AS $$
  SELECT
    p.id, p.user_id, p.company_name, p.bio, p.categories,
    p.hourly_rate, p.rating_avg, p.rating_count, p.verified, p.active,
    p.zone_radius_km, p.phone, p.email, p.company_city, p.company_postal_code,
    p.profile_photo_url, p.country, p.latitude, p.longitude,
    haversine_distance(user_lat, user_lng, p.latitude, p.longitude) AS distance_km
  FROM profiles_artisan p
  WHERE p.active = true
    AND p.latitude IS NOT NULL
    AND p.longitude IS NOT NULL
    AND (country_filter IS NULL OR p.country = country_filter)
    AND (category_filter IS NULL OR category_filter = ANY(p.categories))
    AND haversine_distance(user_lat, user_lng, p.latitude, p.longitude) <= radius_km
  ORDER BY distance_km ASC
  LIMIT 50;
$$ LANGUAGE SQL STABLE;

-- ── 7. Table subscriptions (si pas encore créée) ─────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL DEFAULT 'artisan_starter',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due','trialing')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_owner" ON subscriptions;
CREATE POLICY "subscriptions_owner" ON subscriptions
  USING (user_id = auth.uid());
