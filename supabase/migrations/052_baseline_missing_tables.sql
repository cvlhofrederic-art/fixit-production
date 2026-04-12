-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 052 — Baseline des tables creees hors migration
-- Date: 2026-04-12
-- Audit: DB-01 — Tables critiques sans definition de migration
--
-- Ces tables ont ete creees directement dans Supabase Dashboard.
-- Cette migration les documente et les recree de maniere idempotente.
-- IMPORTANT: Entierement idempotent (IF NOT EXISTS). Safe en prod.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. profiles_artisan ─────────────────────────────────────────────────────
-- Table centrale des profils artisan. Cree au lancement du projet.
CREATE TABLE IF NOT EXISTS profiles_artisan (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name                TEXT DEFAULT '',
  nom                         TEXT DEFAULT '',
  email                       TEXT,
  phone                       TEXT,
  bio                         TEXT,
  siret                       TEXT,
  nif                         TEXT,
  category                    TEXT,
  categories                  TEXT[] DEFAULT '{}',
  specialties                 TEXT[] DEFAULT '{}',
  hourly_rate                 NUMERIC,
  slug                        TEXT UNIQUE,
  city                        TEXT,
  company_city                TEXT,
  postal_code                 TEXT,
  company_postal_code         TEXT,
  country                     TEXT NOT NULL DEFAULT 'FR',
  latitude                    DOUBLE PRECISION,
  longitude                   DOUBLE PRECISION,
  zone_radius_km              INTEGER DEFAULT 30,
  active                      BOOLEAN DEFAULT false,
  verified                    BOOLEAN DEFAULT false,
  rating_avg                  NUMERIC DEFAULT 0,
  rating_count                INTEGER DEFAULT 0,
  logo_url                    TEXT,
  profile_photo_url           TEXT,
  insurance_name              TEXT,
  insurance_number            TEXT,
  insurance_coverage          TEXT,
  insurance_type              TEXT,
  insurance_expiry            DATE,
  insurance_verified          BOOLEAN DEFAULT false,
  insurance_url               TEXT,
  insurance_scan_data         JSONB,
  kbis_url                    TEXT,
  id_document_url             TEXT,
  subscription_plan           TEXT DEFAULT 'artisan_starter',
  subscription_status         TEXT DEFAULT 'active',
  stripe_customer_id          TEXT,
  referral_code               TEXT UNIQUE,
  referral_parrain_id         UUID,
  credit_mois_gratuits        INTEGER DEFAULT 0,
  total_parrainages_reussis   INTEGER DEFAULT 0,
  referral_flagged            BOOLEAN DEFAULT false,
  marches_opt_in              BOOLEAN DEFAULT false,
  marches_categories          TEXT[] DEFAULT '{}',
  marches_work_mode           TEXT,
  rc_pro_valid                BOOLEAN DEFAULT false,
  decennale_valid             BOOLEAN DEFAULT false,
  rge_valid                   BOOLEAN DEFAULT false,
  qualibat_valid              BOOLEAN DEFAULT false,
  type_activite               TEXT,
  periodicite_declaration     TEXT,
  acre_actif                  BOOLEAN DEFAULT false,
  declaration_configuree      BOOLEAN DEFAULT false,
  auto_accept                 BOOLEAN DEFAULT false,
  auto_reply_message          TEXT DEFAULT '',
  auto_block_duration_minutes INTEGER DEFAULT 240,
  paiement_modes              JSONB,
  tva_auto_activate           BOOLEAN DEFAULT false,
  tva_notified_level          TEXT,
  kyc_score                   INTEGER DEFAULT 0,
  kyc_checks                  JSONB,
  kyc_verified_at             TIMESTAMPTZ,
  kyc_market                  TEXT,
  kbis_extracted              JSONB,
  certidao_extracted          JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes deja crees dans d'autres migrations (038, 045) — idempotent
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_user_id ON profiles_artisan(user_id);
CREATE INDEX IF NOT EXISTS idx_artisan_country ON profiles_artisan(country);
CREATE INDEX IF NOT EXISTS idx_artisan_active_country ON profiles_artisan(active, country);
CREATE INDEX IF NOT EXISTS idx_artisan_geo ON profiles_artisan(latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;


-- ── 2. profiles_client ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles_client (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name         TEXT DEFAULT '',
  email             TEXT,
  phone             TEXT,
  address           TEXT,
  city              TEXT,
  postal_code       TEXT,
  avatar_url        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_profiles_client_user_id ON profiles_client(id);


-- ── 3. services ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id            UUID NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  price_ht              NUMERIC,
  price_ttc             NUMERIC,
  duration_minutes      INTEGER DEFAULT 60,
  active                BOOLEAN DEFAULT true,
  category              TEXT,
  validation_auto       BOOLEAN DEFAULT false,
  delai_minimum_heures  INTEGER DEFAULT 24,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_artisan ON services(artisan_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);


-- ── 4. bookings ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id            UUID NOT NULL,
  service_id            UUID,
  client_id             UUID,
  syndic_id             UUID,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','cancelled','completed')),
  booking_date          DATE,
  booking_time          TEXT,
  duration_minutes      INTEGER,
  address               TEXT,
  notes                 TEXT,
  price_ht              NUMERIC,
  price_ttc             NUMERIC,
  client_name           TEXT,
  client_phone          TEXT,
  client_email          TEXT,
  client_address        TEXT,
  confirmed_at          TIMESTAMPTZ,
  cancelled_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  expires_at            TIMESTAMPTZ,
  rapport_ia_source     TEXT,
  rapport_ia_genere_le  TIMESTAMPTZ,
  rapport_ia_texte_brut TEXT,
  metadata              JSONB,
  deleted_at            TIMESTAMPTZ,
  deleted_by            UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Indexes deja crees dans migration 039 — idempotent
CREATE INDEX IF NOT EXISTS idx_bookings_artisan_id ON bookings(artisan_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at);


-- ── 5. availability ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id      UUID NOT NULL,
  day_of_week     INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_available    BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_availability_artisan ON availability(artisan_id);


-- ── 6. booking_reviews ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL,
  client_id       UUID NOT NULL,
  artisan_id      UUID NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_artisan ON booking_reviews(artisan_id);
CREATE INDEX IF NOT EXISTS idx_booking_reviews_booking ON booking_reviews(booking_id);


-- ── 7. client_favorites ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_favorites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  artisan_id      UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, artisan_id)
);
CREATE INDEX IF NOT EXISTS idx_client_favorites_client ON client_favorites(client_id);


-- ── 8. syndic_cabinets ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_cabinets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom             TEXT NOT NULL DEFAULT '',
  siret           TEXT,
  adresse         TEXT DEFAULT '',
  ville           TEXT DEFAULT '',
  code_postal     TEXT DEFAULT '',
  telephone       TEXT,
  email           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_syndic_cabinets_user ON syndic_cabinets(user_id);


-- ── 9. artisan_photos (si pas deja cree) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS artisan_photos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id      UUID NOT NULL,
  url             TEXT NOT NULL,
  caption         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artisan_photos_artisan ON artisan_photos(artisan_id);


-- ── 10. RLS sur les tables baseline (deja fait dans migration 041 mais idempotent) ──
ALTER TABLE profiles_artisan ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles_client ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_cabinets ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_photos ENABLE ROW LEVEL SECURITY;


-- ══════════════════════════════════════════════════════════════════════════════
-- NOTE: Les policies RLS pour ces tables sont deja definies dans
-- migration 041_rls_complete_audit.sql. Cette migration ne cree que les
-- definitions de tables manquantes.
-- ══════════════════════════════════════════════════════════════════════════════
