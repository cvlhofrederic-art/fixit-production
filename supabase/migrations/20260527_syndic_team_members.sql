-- syndic_team_members : table des membres d'un cabinet syndic
--
-- Référencée depuis 001_syndic_tables.sql et 004_syndic_coproprios.sql
-- (RLS policies attendent : cabinet_id, user_id, is_active)
-- Aussi attendue par scripts/apply-team-sql.cjs (email, full_name, role)
-- et par /supabase-team.sql (spec jamais appliquée, désormais dépréciée).
--
-- Schéma canonique union :
-- - Authentification / invitation : email, full_name, role enum, invite_token,
--   invite_sent_at, accepted_at (flux de l'invitation par lien magique)
-- - Affichage V5.4 (TeamDropdown) : initials, color, display_order
--
-- Phase 1 étape 0 du scaffold syndic v54 : Claude Code + Claude Chat sync.
-- RLS scopée cabinet_id = auth.uid() pour la défense en profondeur.

CREATE TABLE IF NOT EXISTS syndic_team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- user_id nullable : null tant que l'invitation n'est pas acceptée,
  -- ou pour un membre display-only sans compte (ex. contabilista externe)
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- email nullable : un membre display-only peut ne pas avoir d'email connu
  email           TEXT,
  full_name       TEXT NOT NULL DEFAULT '',
  role            TEXT NOT NULL DEFAULT 'syndic_gestionnaire' CHECK (role IN (
    'syndic_admin',
    'syndic_tech',
    'syndic_secretaire',
    'syndic_gestionnaire',
    'syndic_comptable',
    'syndic_juriste'
  )),
  -- Champs design V5.4 (TeamDropdown, avatars)
  initials        TEXT NOT NULL DEFAULT '',
  display_order   INTEGER NOT NULL DEFAULT 0,
  color           TEXT,
  -- Flux invitation
  invite_token    TEXT UNIQUE,
  invite_sent_at  TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS syndic_team_members_cabinet_order_idx
  ON syndic_team_members (cabinet_id, display_order)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS syndic_team_members_user_idx
  ON syndic_team_members (user_id)
  WHERE user_id IS NOT NULL;

-- Unique partial : email unique parmi les membres avec email renseigné.
-- Permet ON CONFLICT (email) côté script invitation (apply-team-sql.cjs).
CREATE UNIQUE INDEX IF NOT EXISTS syndic_team_members_email_unique_idx
  ON syndic_team_members (email)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS syndic_team_members_invite_token_idx
  ON syndic_team_members (invite_token)
  WHERE invite_token IS NOT NULL;

ALTER TABLE syndic_team_members ENABLE ROW LEVEL SECURITY;

-- Le cabinet maître peut voir, créer, modifier et supprimer ses membres.
CREATE POLICY "syndic_team_members_cabinet_full_access"
  ON syndic_team_members
  FOR ALL
  USING (cabinet_id = auth.uid())
  WITH CHECK (cabinet_id = auth.uid());

-- Un membre connecté peut voir son propre enregistrement.
CREATE POLICY "syndic_team_members_member_select"
  ON syndic_team_members
  FOR SELECT
  USING (user_id = auth.uid());

-- Un membre connecté peut mettre à jour son propre enregistrement (acceptance,
-- préférences). Le cabinet maître a déjà le ALL plus haut.
CREATE POLICY "syndic_team_members_member_update_self"
  ON syndic_team_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION syndic_team_members_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS syndic_team_members_updated_at ON syndic_team_members;
CREATE TRIGGER syndic_team_members_updated_at
  BEFORE UPDATE ON syndic_team_members
  FOR EACH ROW
  EXECUTE FUNCTION syndic_team_members_set_updated_at();
