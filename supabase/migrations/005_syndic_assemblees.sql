-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 005 : Tables Assemblées Générales Digitales
-- Migre les AG de localStorage vers Supabase (3 tables)
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table principale : syndic_assemblees ─────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_assemblees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identification
  titre           TEXT NOT NULL DEFAULT '',
  immeuble        TEXT NOT NULL DEFAULT '',
  date_ag         TIMESTAMPTZ NOT NULL,
  lieu            TEXT NOT NULL DEFAULT '',
  type_ag         TEXT NOT NULL DEFAULT 'ordinaire'
                  CHECK (type_ag IN ('ordinaire', 'extraordinaire')),

  -- Statut workflow
  statut          TEXT NOT NULL DEFAULT 'brouillon'
                  CHECK (statut IN ('brouillon', 'convoquée', 'en_cours', 'clôturée', 'annulée')),

  -- Ordre du jour (tableau de textes)
  ordre_du_jour   JSONB NOT NULL DEFAULT '[]',

  -- Quorum et tantièmes
  quorum          NUMERIC(5,2) NOT NULL DEFAULT 50,
  total_tantiemes INTEGER NOT NULL DEFAULT 10000,
  presents        INTEGER NOT NULL DEFAULT 0,

  -- Signature PV
  signataire_nom  TEXT,
  signataire_role TEXT,
  signature_ts    TIMESTAMPTZ,

  -- Convocation email
  convocation_sent_at TIMESTAMPTZ,
  convocation_count   INTEGER DEFAULT 0,

  -- Notes / PV texte libre
  notes           TEXT,
  pv_content      TEXT,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Table résolutions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_resolutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assemblee_id    UUID NOT NULL REFERENCES syndic_assemblees(id) ON DELETE CASCADE,
  cabinet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Contenu
  titre           TEXT NOT NULL DEFAULT '',
  description     TEXT,
  numero_ordre    INTEGER NOT NULL DEFAULT 0,

  -- Type de majorité (loi 10/07/1965 FR ou Código Civil PT)
  majorite        TEXT NOT NULL DEFAULT 'art24'
                  CHECK (majorite IN ('art24', 'art25', 'art26', 'unanimite')),

  -- Votes en séance (tantièmes)
  vote_pour       INTEGER NOT NULL DEFAULT 0,
  vote_contre     INTEGER NOT NULL DEFAULT 0,
  vote_abstention INTEGER NOT NULL DEFAULT 0,

  -- Résultat
  statut          TEXT NOT NULL DEFAULT 'en_cours'
                  CHECK (statut IN ('en_cours', 'adoptée', 'rejetée')),

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Table votes par correspondance ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_votes_correspondance (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolution_id   UUID NOT NULL REFERENCES syndic_resolutions(id) ON DELETE CASCADE,
  cabinet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Votant
  copropriétaire  TEXT NOT NULL DEFAULT '',
  coproprio_id    UUID REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  tantiemes       INTEGER NOT NULL DEFAULT 0,

  -- Vote
  vote            TEXT NOT NULL CHECK (vote IN ('pour', 'contre', 'abstention')),
  date_reception  DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. Table présence AG (feuille d'émargement) ────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_ag_presences (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assemblee_id    UUID NOT NULL REFERENCES syndic_assemblees(id) ON DELETE CASCADE,
  cabinet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Participant
  coproprio_id    UUID REFERENCES syndic_coproprios(id) ON DELETE SET NULL,
  nom             TEXT NOT NULL DEFAULT '',
  tantiemes       INTEGER NOT NULL DEFAULT 0,

  -- Présence
  type_presence   TEXT NOT NULL DEFAULT 'present'
                  CHECK (type_presence IN ('present', 'représenté', 'absent', 'procuration')),
  representant    TEXT,
  heure_arrivee   TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- Assemblées
CREATE INDEX idx_assemblees_cabinet ON syndic_assemblees(cabinet_id);
CREATE INDEX idx_assemblees_date ON syndic_assemblees(cabinet_id, date_ag DESC);
CREATE INDEX idx_assemblees_statut ON syndic_assemblees(cabinet_id, statut);
CREATE INDEX idx_assemblees_immeuble ON syndic_assemblees(cabinet_id, immeuble);

-- Résolutions
CREATE INDEX idx_resolutions_assemblee ON syndic_resolutions(assemblee_id);
CREATE INDEX idx_resolutions_cabinet ON syndic_resolutions(cabinet_id);

-- Votes correspondance
CREATE INDEX idx_votes_corr_resolution ON syndic_votes_correspondance(resolution_id);
CREATE INDEX idx_votes_corr_cabinet ON syndic_votes_correspondance(cabinet_id);

-- Présences
CREATE INDEX idx_presences_assemblee ON syndic_ag_presences(assemblee_id);
CREATE INDEX idx_presences_cabinet ON syndic_ag_presences(cabinet_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

-- ── syndic_assemblees ──────────────────────────────────────────────────────
ALTER TABLE syndic_assemblees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assemblees_owner_all" ON syndic_assemblees
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY "assemblees_team_select" ON syndic_assemblees
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_assemblees.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

CREATE POLICY "assemblees_team_update" ON syndic_assemblees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_assemblees.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- ── syndic_resolutions ────────────────────────────────────────────────────
ALTER TABLE syndic_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resolutions_owner_all" ON syndic_resolutions
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY "resolutions_team_select" ON syndic_resolutions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_resolutions.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

CREATE POLICY "resolutions_team_update" ON syndic_resolutions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_resolutions.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- ── syndic_votes_correspondance ───────────────────────────────────────────
ALTER TABLE syndic_votes_correspondance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_corr_owner_all" ON syndic_votes_correspondance
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY "votes_corr_team_select" ON syndic_votes_correspondance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_votes_correspondance.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- ── syndic_ag_presences ───────────────────────────────────────────────────
ALTER TABLE syndic_ag_presences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presences_owner_all" ON syndic_ag_presences
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY "presences_team_select" ON syndic_ag_presences
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_ag_presences.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

CREATE POLICY "presences_team_update" ON syndic_ag_presences
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_ag_presences.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS auto updated_at
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_assemblees_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_assemblees_updated_at
  BEFORE UPDATE ON syndic_assemblees
  FOR EACH ROW EXECUTE FUNCTION update_assemblees_updated_at();

CREATE OR REPLACE FUNCTION update_resolutions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_resolutions_updated_at
  BEFORE UPDATE ON syndic_resolutions
  FOR EACH ROW EXECUTE FUNCTION update_resolutions_updated_at();
