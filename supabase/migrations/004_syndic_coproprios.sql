-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 004 : Table syndic_coproprios
-- Migre les copropriétaires de localStorage vers Supabase
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Créer la table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_coproprios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identification du lot
  immeuble      TEXT NOT NULL DEFAULT '',
  batiment      TEXT NOT NULL DEFAULT '',
  etage         INTEGER NOT NULL DEFAULT 0,
  numero_porte  TEXT NOT NULL DEFAULT '',

  -- Propriétaire
  nom_proprietaire    TEXT NOT NULL DEFAULT '',
  prenom_proprietaire TEXT NOT NULL DEFAULT '',
  email_proprietaire  TEXT NOT NULL DEFAULT '',
  tel_proprietaire    TEXT NOT NULL DEFAULT '',

  -- Locataire (optionnel)
  nom_locataire       TEXT,
  prenom_locataire    TEXT,
  email_locataire     TEXT,
  tel_locataire       TEXT,

  -- Statut
  est_occupe    BOOLEAN NOT NULL DEFAULT false,
  notes         TEXT,

  -- Financier (ExtranetSection)
  tantieme      NUMERIC(10,4) DEFAULT 0,
  solde         NUMERIC(12,2) DEFAULT 0,
  acces_portail BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX idx_coproprios_cabinet ON syndic_coproprios(cabinet_id);
CREATE INDEX idx_coproprios_immeuble ON syndic_coproprios(cabinet_id, immeuble);
CREATE INDEX idx_coproprios_email ON syndic_coproprios(email_proprietaire) WHERE email_proprietaire != '';
CREATE INDEX idx_coproprios_email_locataire ON syndic_coproprios(email_locataire) WHERE email_locataire IS NOT NULL AND email_locataire != '';

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE syndic_coproprios ENABLE ROW LEVEL SECURITY;

-- Syndic owner: full access
CREATE POLICY "coproprios_owner_all" ON syndic_coproprios
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

-- Team members: read + update
CREATE POLICY "coproprios_team_select" ON syndic_coproprios
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_coproprios.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

CREATE POLICY "coproprios_team_update" ON syndic_coproprios
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_coproprios.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- Copropriétaire: can read own data (by email match)
CREATE POLICY "coproprios_self_read" ON syndic_coproprios
  FOR SELECT
  USING (
    email_proprietaire = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR email_locataire = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- ── 4. Auto-update updated_at ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_coproprios_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coproprios_updated_at
  BEFORE UPDATE ON syndic_coproprios
  FOR EACH ROW
  EXECUTE FUNCTION update_coproprios_updated_at();
