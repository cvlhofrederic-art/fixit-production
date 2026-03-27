-- Migration 028 — Sous-traitance BTP : offres de recrutement
-- Étend la table marches existante pour les offres publiées par les PRO BTP
-- Visible dans la bourse aux marchés côté auto-entrepreneurs

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Étendre la table marches avec les champs BTP sous-traitance
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE marches
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'public'
    CHECK (source_type IN ('public', 'btp_sous_traitance')),
  ADD COLUMN IF NOT EXISTS mission_type TEXT
    CHECK (mission_type IN ('sous_traitance_complete', 'renfort_equipe')),
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS duration_text TEXT,
  ADD COLUMN IF NOT EXISTS btp_company_id TEXT,
  ADD COLUMN IF NOT EXISTS btp_company_name TEXT,
  ADD COLUMN IF NOT EXISTS nb_intervenants_souhaite INT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Étendre marches_candidatures avec les champs spécifiques sous-traitance
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE marches_candidatures
  ADD COLUMN IF NOT EXISTS disponibilites TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INT,
  ADD COLUMN IF NOT EXISTS artisan_company_name TEXT,
  ADD COLUMN IF NOT EXISTS artisan_rating NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS artisan_phone TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index pour les requêtes fréquentes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_marches_source_type ON marches(source_type);
CREATE INDEX IF NOT EXISTS idx_marches_btp_company ON marches(btp_company_id);
CREATE INDEX IF NOT EXISTS idx_marches_source_status ON marches(source_type, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Table btp_candidature_messages — messagerie interne entre BTP et artisan
--    (distinct de marches_messages qui est artisan→publisher)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS btp_candidature_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidature_id  UUID NOT NULL REFERENCES marches_candidatures(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id),
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('btp_company', 'artisan')),
  content         TEXT NOT NULL,
  read            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_btp_msgs_candidature ON btp_candidature_messages(candidature_id);
CREATE INDEX IF NOT EXISTS idx_btp_msgs_sender ON btp_candidature_messages(sender_id);

ALTER TABLE btp_candidature_messages ENABLE ROW LEVEL SECURITY;

-- Participants (sender ou propriétaire du marché) peuvent lire/écrire
CREATE POLICY "btp_msgs_read" ON btp_candidature_messages FOR SELECT
  USING (
    auth.uid() = sender_id
    OR auth.uid() IN (
      SELECT mc.artisan_user_id FROM marches_candidatures mc WHERE mc.id = candidature_id
    )
    OR auth.uid() IN (
      SELECT m.publisher_user_id FROM marches m
      JOIN marches_candidatures mc ON mc.marche_id = m.id
      WHERE mc.id = candidature_id
    )
  );

CREATE POLICY "btp_msgs_insert" ON btp_candidature_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);
