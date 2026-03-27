-- ══════════════════════════════════════════════════════════════════════════════
-- FIXIT — Système Multi-Équipe Syndic
-- Table syndic_team_members + invitations
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table des membres de l'équipe syndic ───────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_team_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id    UUID NOT NULL,           -- user.id du compte maître syndic
  user_id       UUID,                    -- null jusqu'à acceptation de l'invitation
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  role          TEXT NOT NULL CHECK (role IN (
    'syndic_admin',       -- accès total (même que le maître)
    'syndic_tech',        -- gestionnaire technique : interventions + comptabilité tech
    'syndic_secretaire',  -- accueil, copropriétaires, planning
    'syndic_gestionnaire',-- gestion courante : immeubles, missions, alertes
    'syndic_comptable'    -- comptabilité + facturation seulement
  )),
  invite_token  TEXT UNIQUE,             -- token d'invitation (null après acceptation)
  invite_sent_at TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_team_cabinet ON syndic_team_members(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_team_user    ON syndic_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_email   ON syndic_team_members(email);
CREATE INDEX IF NOT EXISTS idx_team_token   ON syndic_team_members(invite_token);

-- ── 2. RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE syndic_team_members ENABLE ROW LEVEL SECURITY;

-- Le cabinet maître peut voir son équipe
CREATE POLICY "syndic_team_select" ON syndic_team_members
  FOR SELECT USING (
    cabinet_id = auth.uid()
    OR user_id = auth.uid()
  );

-- Seul le cabinet maître peut insérer / modifier / supprimer
CREATE POLICY "syndic_team_insert" ON syndic_team_members
  FOR INSERT WITH CHECK (cabinet_id = auth.uid());

CREATE POLICY "syndic_team_update" ON syndic_team_members
  FOR UPDATE USING (cabinet_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "syndic_team_delete" ON syndic_team_members
  FOR DELETE USING (cabinet_id = auth.uid());

-- ── 3. Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_team_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_team_updated_at ON syndic_team_members;
CREATE TRIGGER trg_team_updated_at
  BEFORE UPDATE ON syndic_team_members
  FOR EACH ROW EXECUTE FUNCTION update_team_updated_at();

-- ── 4. Realtime (optionnel) ───────────────────────────────────────────────────
-- ALTER PUBLICATION supabase_realtime ADD TABLE syndic_team_members;
