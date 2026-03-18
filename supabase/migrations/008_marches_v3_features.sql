-- ═══════════════════════════════════════════════════════════════
-- BOURSE AUX MARCHÉS V3 — Messagerie, évaluations, templates, récurrence
-- ═══════════════════════════════════════════════════════════════

-- 1. Messagerie marchés (donneur ↔ artisan)
CREATE TABLE IF NOT EXISTS marches_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marche_id UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  candidature_id UUID REFERENCES marches_candidatures(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('publisher', 'artisan')),
  sender_name TEXT NOT NULL,
  sender_email TEXT,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marches_messages_marche ON marches_messages(marche_id);
CREATE INDEX IF NOT EXISTS idx_marches_messages_candidature ON marches_messages(candidature_id);
CREATE INDEX IF NOT EXISTS idx_marches_messages_created ON marches_messages(created_at DESC);

-- RLS
ALTER TABLE marches_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marches_messages_read" ON marches_messages FOR SELECT USING (true);
CREATE POLICY "marches_messages_insert" ON marches_messages FOR INSERT WITH CHECK (true);

-- 2. Évaluations bidirectionnelles post-mission
CREATE TABLE IF NOT EXISTS marches_evaluations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marche_id UUID NOT NULL REFERENCES marches(id) ON DELETE CASCADE,
  candidature_id UUID NOT NULL REFERENCES marches_candidatures(id) ON DELETE CASCADE,
  evaluator_type TEXT NOT NULL CHECK (evaluator_type IN ('publisher', 'artisan')),
  -- Ratings (1-5)
  note_globale INT NOT NULL CHECK (note_globale BETWEEN 1 AND 5),
  note_qualite INT CHECK (note_qualite BETWEEN 1 AND 5),
  note_ponctualite INT CHECK (note_ponctualite BETWEEN 1 AND 5),
  note_prix INT CHECK (note_prix BETWEEN 1 AND 5),
  note_communication INT CHECK (note_communication BETWEEN 1 AND 5),
  -- Comment
  commentaire TEXT,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- One evaluation per type per candidature
  UNIQUE(candidature_id, evaluator_type)
);

CREATE INDEX IF NOT EXISTS idx_marches_evaluations_marche ON marches_evaluations(marche_id);
CREATE INDEX IF NOT EXISTS idx_marches_evaluations_candidature ON marches_evaluations(candidature_id);

ALTER TABLE marches_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evaluations_read" ON marches_evaluations FOR SELECT USING (true);
CREATE POLICY "evaluations_insert" ON marches_evaluations FOR INSERT WITH CHECK (true);

-- 3. Champs supplémentaires sur marches
ALTER TABLE marches ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS recurrence_interval TEXT; -- 'mensuel', 'trimestriel', 'annuel'
ALTER TABLE marches ADD COLUMN IF NOT EXISTS parent_marche_id UUID REFERENCES marches(id);
ALTER TABLE marches ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE marches ADD COLUMN IF NOT EXISTS artisan_dispo_info JSONB DEFAULT '{}';
ALTER TABLE marches ADD COLUMN IF NOT EXISTS unread_messages_count INT DEFAULT 0;

-- 4. Champs évaluation sur candidatures
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS publisher_evaluated BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_evaluated BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_company_name TEXT;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_rating NUMERIC(3,2);
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_rating_count INT;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_distance_km NUMERIC(10,1);
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_work_mode TEXT;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_tarif_journalier NUMERIC(10,2);
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_tarif_horaire NUMERIC(10,2);
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_rc_pro_valid BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_decennale_valid BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_rge_valid BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_qualibat_valid BOOLEAN DEFAULT false;
ALTER TABLE marches_candidatures ADD COLUMN IF NOT EXISTS artisan_disponibilite TEXT;
