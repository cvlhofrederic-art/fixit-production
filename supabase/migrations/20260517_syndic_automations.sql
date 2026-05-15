-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Table syndic_automations (Plan F — Tempo agent)
-- Date: 2026-05-17
-- ══════════════════════════════════════════════════════════════════════════════
-- Tempo orchestre des automatisations récurrentes (cron) déléguant à
-- Léa/Max/Alfredo/Fixy ou exécutant directement via template.
--
-- task_type :
--   - send_email_template : sendEmail avec template + params dynamiques
--   - send_appel_charges  : Léa génère contenu + send par email
--   - send_relance_impaye : Léa rédige relance + send (filtre impayés > N jours)
--   - send_convocation_ag : Max génère convocation AG officielle + send + PDF
--   - generate_monthly_report : Léa+Fixy compilent rapport mensuel + email
--   - remind_echeance_legale : DPE/ascenseur/gaz — calcul date expiration
--   - backup_docs : export ZIP archives docs cabinet (no LLM)

CREATE TABLE IF NOT EXISTS syndic_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  task_type text NOT NULL CHECK (task_type IN (
    'send_email_template', 'send_appel_charges', 'send_relance_impaye',
    'send_convocation_ag', 'generate_monthly_report', 'remind_echeance_legale',
    'backup_docs'
  )),
  cron_expr text NOT NULL,                       -- ex "0 9 1 1,4,7,10 *"
  timezone text NOT NULL DEFAULT 'Europe/Paris', -- pour évaluer le cron
  params jsonb NOT NULL DEFAULT '{}'::jsonb,     -- { immeuble_id, recipients, template_id, threshold_days, ... }
  locale text NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr','pt')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  last_run_at timestamptz,
  last_run_status text CHECK (last_run_status IN ('success','partial','failed')),
  last_run_message text,
  next_run_at timestamptz,                       -- calculé à la création/run
  run_count int NOT NULL DEFAULT 0,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automations_cabinet ON syndic_automations(cabinet_id, status, next_run_at);
CREATE INDEX idx_automations_due ON syndic_automations(next_run_at) WHERE status = 'active';

-- Audit log des exécutions (1 row par run)
CREATE TABLE IF NOT EXISTS syndic_automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES syndic_automations(id) ON DELETE CASCADE,
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('running','success','partial','failed','skipped')),
  emails_sent int NOT NULL DEFAULT 0,
  docs_generated int NOT NULL DEFAULT 0,
  error_message text,
  result_meta jsonb
);

CREATE INDEX idx_automation_runs_cabinet ON syndic_automation_runs(cabinet_id, started_at DESC);
CREATE INDEX idx_automation_runs_automation ON syndic_automation_runs(automation_id, started_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE syndic_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_automations_all ON syndic_automations FOR ALL USING (
  cabinet_id = auth.uid()
  OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY syndic_automation_runs_select ON syndic_automation_runs FOR SELECT USING (
  cabinet_id = auth.uid()
  OR cabinet_id IN (SELECT cabinet_id FROM syndic_team_members WHERE user_id = auth.uid() AND is_active = true)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_automation_modtime() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_automation_modtime
  BEFORE UPDATE ON syndic_automations
  FOR EACH ROW EXECUTE FUNCTION update_automation_modtime();
