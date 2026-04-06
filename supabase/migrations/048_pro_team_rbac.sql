-- ══════════════════════════════════════════════════════════════════════════════
-- VITFIX — Système Multi-Comptes Société BTP (pro_societe)
-- Table pro_team_members + pro_role_permissions + audit_log
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Table des membres de l'équipe société ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_team_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,            -- user.id du gérant (compte maître)
  user_id         UUID,                     -- null jusqu'à acceptation de l'invitation
  email           TEXT NOT NULL,
  full_name       TEXT NOT NULL DEFAULT '',
  phone           TEXT DEFAULT '',
  role            TEXT NOT NULL CHECK (role IN (
    'GERANT',
    'CONDUCTEUR_TRAVAUX',
    'CHEF_CHANTIER',
    'SECRETAIRE',
    'COMPTABLE',
    'OUVRIER'
  )),
  assigned_chantiers UUID[] DEFAULT '{}',   -- chantiers assignés (scope filtering)
  invite_token    TEXT UNIQUE,              -- token d'invitation (null après acceptation)
  invite_sent_at  TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pro_team_company  ON pro_team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_pro_team_user     ON pro_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pro_team_email    ON pro_team_members(email);
CREATE INDEX IF NOT EXISTS idx_pro_team_token    ON pro_team_members(invite_token);
CREATE INDEX IF NOT EXISTS idx_pro_team_active   ON pro_team_members(company_id, is_active);

-- ── 2. Table des overrides de permissions par membre ─────────────────────────
CREATE TABLE IF NOT EXISTS pro_role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  member_id       UUID NOT NULL REFERENCES pro_team_members(id) ON DELETE CASCADE,
  module_id       TEXT NOT NULL,            -- slug du module (matches useModulesConfig)
  access_level    TEXT NOT NULL CHECK (access_level IN ('FULL', 'READ', 'NONE')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_perms_member  ON pro_role_permissions(member_id);
CREATE INDEX IF NOT EXISTS idx_pro_perms_company ON pro_role_permissions(company_id);

-- ── 3. Table d'audit log ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pro_team_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL,
  actor_id        UUID NOT NULL,            -- qui a fait l'action
  action          TEXT NOT NULL,             -- 'invite', 'update_role', 'deactivate', 'reactivate', 'delete', 'update_permissions'
  target_member_id UUID,
  details         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_audit_company ON pro_team_audit_log(company_id, created_at DESC);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE pro_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pro_team_audit_log ENABLE ROW LEVEL SECURITY;

-- pro_team_members: le gérant et les membres de l'équipe voient leur équipe
CREATE POLICY "pro_team_select" ON pro_team_members
  FOR SELECT USING (company_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "pro_team_insert" ON pro_team_members
  FOR INSERT WITH CHECK (company_id = auth.uid());

CREATE POLICY "pro_team_update" ON pro_team_members
  FOR UPDATE USING (company_id = auth.uid());

CREATE POLICY "pro_team_delete" ON pro_team_members
  FOR DELETE USING (company_id = auth.uid());

-- pro_role_permissions: gérant gère, membres voient les leurs
CREATE POLICY "pro_perms_select" ON pro_role_permissions
  FOR SELECT USING (
    company_id = auth.uid()
    OR member_id IN (SELECT id FROM pro_team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "pro_perms_insert" ON pro_role_permissions
  FOR INSERT WITH CHECK (company_id = auth.uid());

CREATE POLICY "pro_perms_update" ON pro_role_permissions
  FOR UPDATE USING (company_id = auth.uid());

CREATE POLICY "pro_perms_delete" ON pro_role_permissions
  FOR DELETE USING (company_id = auth.uid());

-- pro_team_audit_log: lecture par le gérant uniquement
CREATE POLICY "pro_audit_select" ON pro_team_audit_log
  FOR SELECT USING (company_id = auth.uid());

CREATE POLICY "pro_audit_insert" ON pro_team_audit_log
  FOR INSERT WITH CHECK (company_id = auth.uid() OR actor_id = auth.uid());

-- ── 5. Trigger updated_at ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_pro_team_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pro_team_updated_at ON pro_team_members;
CREATE TRIGGER trg_pro_team_updated_at
  BEFORE UPDATE ON pro_team_members
  FOR EACH ROW EXECUTE FUNCTION update_pro_team_updated_at();

DROP TRIGGER IF EXISTS trg_pro_perms_updated_at ON pro_role_permissions;
CREATE TRIGGER trg_pro_perms_updated_at
  BEFORE UPDATE ON pro_role_permissions
  FOR EACH ROW EXECUTE FUNCTION update_pro_team_updated_at();
