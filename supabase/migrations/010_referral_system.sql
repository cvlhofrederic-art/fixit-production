-- ══════════════════════════════════════════════════════════════════════════════
-- VITFIX — Programme de Parrainage : Schema complet
-- Adapté MySQL → PostgreSQL/Supabase
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 2.1 Table referrals ─────────────────────────────────────────────────────
-- Cycle de vie complet d'un parrainage : clic → inscription → paiement → J+7 → récompense

CREATE TABLE IF NOT EXISTS referrals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parrain_id      UUID NOT NULL REFERENCES profiles_artisan(id) ON DELETE CASCADE,
  filleul_id      UUID NULL REFERENCES profiles_artisan(id) ON DELETE SET NULL,
  code            TEXT NOT NULL,

  -- Statut du cycle de vie
  statut          TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN (
      'en_attente',
      'inscrit',
      'paiement_valide',
      'periode_verification',
      'converti',
      'recompense_distribuee',
      'fraude_suspectee',
      'bloque'
    )),

  -- Dates du cycle
  date_clic                       TIMESTAMPTZ NULL,
  date_inscription                TIMESTAMPTZ NULL,
  date_premier_paiement           TIMESTAMPTZ NULL,
  date_fin_periode_verification   TIMESTAMPTZ NULL,
  date_recompense                 TIMESTAMPTZ NULL,

  -- Données de tracking
  ip_clic         TEXT NULL,
  ip_inscription  TEXT NULL,
  source_partage  TEXT DEFAULT 'autre'
    CHECK (source_partage IN ('whatsapp', 'sms', 'email', 'lien_copie', 'autre')),

  -- Anti-fraude
  risk_score                        SMALLINT DEFAULT 0,
  risk_flags                        JSONB DEFAULT '[]'::jsonb,
  stripe_customer_id_filleul        TEXT NULL,
  stripe_payment_method_filleul     TEXT NULL,
  meme_ip_que_parrain               BOOLEAN DEFAULT false,
  meme_moyen_paiement_que_parrain   BOOLEAN DEFAULT false,
  en_revue_manuelle                 BOOLEAN DEFAULT false,
  note_admin                        TEXT NULL,

  -- Récompenses
  mois_offerts_parrain  SMALLINT DEFAULT 1,
  mois_offerts_filleul  SMALLINT DEFAULT 1,

  -- Rappel filleul inactif (max 1)
  rappel_envoye   BOOLEAN DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index pour requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_referrals_parrain ON referrals(parrain_id);
CREATE INDEX IF NOT EXISTS idx_referrals_filleul ON referrals(filleul_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(code);
CREATE INDEX IF NOT EXISTS idx_referrals_statut ON referrals(statut);
CREATE INDEX IF NOT EXISTS idx_referrals_verification ON referrals(statut, date_fin_periode_verification)
  WHERE statut IN ('paiement_valide', 'periode_verification');

-- ── 2.2 Colonnes sur profiles_artisan ────────────────────────────────────────

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS referral_code              TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referral_parrain_id        UUID REFERENCES profiles_artisan(id),
  ADD COLUMN IF NOT EXISTS credit_mois_gratuits       SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_parrainages_reussis  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_flagged           BOOLEAN DEFAULT false;

COMMENT ON COLUMN profiles_artisan.referral_code IS 'Code parrainage unique 8 chars (sans 0/O/1/I/L)';
COMMENT ON COLUMN profiles_artisan.referral_parrain_id IS 'ID du parrain qui a invité cet artisan';
COMMENT ON COLUMN profiles_artisan.credit_mois_gratuits IS 'Mois gratuits disponibles (cumulés)';
COMMENT ON COLUMN profiles_artisan.total_parrainages_reussis IS 'Nombre total de parrainages validés';
COMMENT ON COLUMN profiles_artisan.referral_flagged IS 'Artisan en surveillance anti-fraude';

-- ── 2.3 Table referral_risk_log ──────────────────────────────────────────────
-- Historique de tous les événements suspects — jamais effacé

CREATE TABLE IF NOT EXISTS referral_risk_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id     UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  artisan_id      UUID NULL REFERENCES profiles_artisan(id),
  type_evenement  TEXT NOT NULL,
  detail          TEXT NULL,
  ip              TEXT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_risk_log_referral ON referral_risk_log(referral_id);
CREATE INDEX IF NOT EXISTS idx_risk_log_artisan ON referral_risk_log(artisan_id);

-- ── 2.4 Table credits_log ────────────────────────────────────────────────────
-- Historique de tous les crédits (gains et consommations)

CREATE TABLE IF NOT EXISTS credits_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artisan_id    UUID NOT NULL REFERENCES profiles_artisan(id) ON DELETE CASCADE,
  type          TEXT NOT NULL
    CHECK (type IN ('parrainage_parrain', 'parrainage_filleul', 'consommation')),
  mois_credits  INTEGER NOT NULL,
  referral_id   UUID NULL REFERENCES referrals(id),
  description   TEXT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credits_log_artisan ON credits_log(artisan_id);
CREATE INDEX IF NOT EXISTS idx_credits_log_referral ON credits_log(referral_id);

-- ── 2.5 Génération des codes pour artisans existants ─────────────────────────
-- Caractères autorisés : A-Z + 2-9 sans O/I/L (= ABCDEFGHJKMNPQRSTUVWXYZ23456789)
-- 8 caractères par code

DO $$
DECLARE
  r RECORD;
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  FOR r IN SELECT id FROM profiles_artisan WHERE referral_code IS NULL
  LOOP
    LOOP
      new_code := '';
      FOR i IN 1..8 LOOP
        new_code := new_code || substr(chars, floor(random() * length(chars))::int + 1, 1);
      END LOOP;
      SELECT EXISTS(SELECT 1 FROM profiles_artisan WHERE referral_code = new_code) INTO code_exists;
      EXIT WHEN NOT code_exists;
    END LOOP;
    UPDATE profiles_artisan SET referral_code = new_code WHERE id = r.id;
  END LOOP;
END $$;

-- ── 2.6 RLS Policies ────────────────────────────────────────────────────────
-- Artisans ne voient que leurs propres referrals

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_risk_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE credits_log ENABLE ROW LEVEL SECURITY;

-- referrals : lecture si parrain ou filleul
CREATE POLICY "artisan_read_own_referrals" ON referrals
  FOR SELECT USING (
    parrain_id IN (SELECT id FROM profiles_artisan WHERE user_id = auth.uid())
    OR filleul_id IN (SELECT id FROM profiles_artisan WHERE user_id = auth.uid())
  );

-- referral_risk_log : aucun accès direct côté client (admin only via service role)
CREATE POLICY "no_client_access_risk_log" ON referral_risk_log
  FOR SELECT USING (false);

-- credits_log : lecture de ses propres crédits
CREATE POLICY "artisan_read_own_credits" ON credits_log
  FOR SELECT USING (
    artisan_id IN (SELECT id FROM profiles_artisan WHERE user_id = auth.uid())
  );
