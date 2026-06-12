-- ══════════════════════════════════════════════════════════════════════════════
-- Migration P4 — Léa Agent Comptable : templates PDF
-- Date: 2026-05-21
-- ══════════════════════════════════════════════════════════════════════════════
-- Permet à chaque cabinet de syndic de déposer ses modèles PDF (chamada de
-- quotas, ata AG, lettre de relance, etc.) avec placeholders nommés, puis à
-- Léa de les remplir via le tool generate_pdf.
--
-- Pattern réutilisé : bucket privé + RLS folder = cabinet_id (cf 20260518).
-- 2026-06-12 (audit Phase 2, réconciliation registre) : migration jamais
-- appliquée en prod ; rendue idempotente (DROP POLICY IF EXISTS) avant le
-- `supabase db push` du runbook supabase/REPAIR-RUNBOOK.md.

-- ── 1. Bucket Storage pour les templates et les PDFs générés ─────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('syndic-pdf-templates', 'syndic-pdf-templates', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('syndic-pdf-generated', 'syndic-pdf-generated', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS syndic_pdf_templates_select ON storage.objects;
CREATE POLICY syndic_pdf_templates_select ON storage.objects FOR SELECT USING (
  bucket_id = 'syndic-pdf-templates'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
DROP POLICY IF EXISTS syndic_pdf_templates_insert ON storage.objects;
CREATE POLICY syndic_pdf_templates_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'syndic-pdf-templates'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);
DROP POLICY IF EXISTS syndic_pdf_templates_delete ON storage.objects;
CREATE POLICY syndic_pdf_templates_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'syndic-pdf-templates'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

DROP POLICY IF EXISTS syndic_pdf_generated_select ON storage.objects;
CREATE POLICY syndic_pdf_generated_select ON storage.objects FOR SELECT USING (
  bucket_id = 'syndic-pdf-generated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
DROP POLICY IF EXISTS syndic_pdf_generated_insert ON storage.objects;
CREATE POLICY syndic_pdf_generated_insert ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'syndic-pdf-generated'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);
DROP POLICY IF EXISTS syndic_pdf_generated_delete ON storage.objects;
CREATE POLICY syndic_pdf_generated_delete ON storage.objects FOR DELETE USING (
  bucket_id = 'syndic-pdf-generated'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

-- ── 2. Enum types templates ──────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE syndic_pdf_template_type AS ENUM (
    'chamada_quotas',
    'lettre_relance_impaye',
    'ata_ag',
    'pv_assemblee',
    'convocation_ag',
    'avis_passage',
    'autre'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ── 3. Table syndic_pdf_templates ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS syndic_pdf_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type syndic_pdf_template_type NOT NULL DEFAULT 'autre',
  description text,
  storage_path text NOT NULL UNIQUE,
  -- Placeholders : { "key_name": { "label": "Nom du copropriétaire", "default": "", "required": true } }
  -- Le PDF source contient des balises {{key_name}} que pdf-lib remplacera.
  placeholders jsonb NOT NULL DEFAULT '{}'::jsonb,
  locale text NOT NULL DEFAULT 'fr' CHECK (locale IN ('fr', 'pt')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_syndic_pdf_templates_cabinet
  ON syndic_pdf_templates(cabinet_id, type, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_syndic_pdf_templates_cabinet_name
  ON syndic_pdf_templates(cabinet_id, name);

-- ── 4. Table syndic_pdf_generated (historique des PDFs générés) ──────────────
CREATE TABLE IF NOT EXISTS syndic_pdf_generated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cabinet_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES syndic_pdf_templates(id) ON DELETE SET NULL,
  filename text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  -- Valeurs utilisées pour remplir les placeholders (pour audit / regénération)
  field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  size_bytes bigint NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  generated_by uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_syndic_pdf_generated_cabinet
  ON syndic_pdf_generated(cabinet_id, generated_at DESC);

CREATE INDEX IF NOT EXISTS idx_syndic_pdf_generated_template
  ON syndic_pdf_generated(template_id) WHERE template_id IS NOT NULL;

-- ── 5. RLS strict scopée par cabinet_id ──────────────────────────────────────
ALTER TABLE syndic_pdf_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS syndic_pdf_templates_select_own ON syndic_pdf_templates;
CREATE POLICY syndic_pdf_templates_select_own ON syndic_pdf_templates
  FOR SELECT USING (cabinet_id = auth.uid());
DROP POLICY IF EXISTS syndic_pdf_templates_insert_own ON syndic_pdf_templates;
CREATE POLICY syndic_pdf_templates_insert_own ON syndic_pdf_templates
  FOR INSERT WITH CHECK (cabinet_id = auth.uid());
DROP POLICY IF EXISTS syndic_pdf_templates_update_own ON syndic_pdf_templates;
CREATE POLICY syndic_pdf_templates_update_own ON syndic_pdf_templates
  FOR UPDATE USING (cabinet_id = auth.uid());
DROP POLICY IF EXISTS syndic_pdf_templates_delete_own ON syndic_pdf_templates;
CREATE POLICY syndic_pdf_templates_delete_own ON syndic_pdf_templates
  FOR DELETE USING (cabinet_id = auth.uid());

ALTER TABLE syndic_pdf_generated ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS syndic_pdf_generated_select_own ON syndic_pdf_generated;
CREATE POLICY syndic_pdf_generated_select_own ON syndic_pdf_generated
  FOR SELECT USING (cabinet_id = auth.uid());
DROP POLICY IF EXISTS syndic_pdf_generated_insert_own ON syndic_pdf_generated;
CREATE POLICY syndic_pdf_generated_insert_own ON syndic_pdf_generated
  FOR INSERT WITH CHECK (cabinet_id = auth.uid());
DROP POLICY IF EXISTS syndic_pdf_generated_delete_own ON syndic_pdf_generated;
CREATE POLICY syndic_pdf_generated_delete_own ON syndic_pdf_generated
  FOR DELETE USING (cabinet_id = auth.uid());

-- ── 6. Commentaires ──────────────────────────────────────────────────────────
COMMENT ON TABLE syndic_pdf_templates IS 'Modèles PDF du cabinet syndic (chamada quotas, ata AG, lettres relance…). Stockés dans bucket syndic-pdf-templates. Placeholders {{key}} remplis par pdf-lib au runtime.';
COMMENT ON COLUMN syndic_pdf_templates.placeholders IS 'JSON { "key": { "label": "…", "default": "", "required": true } } — descriptif des champs à remplir.';
COMMENT ON TABLE syndic_pdf_generated IS 'Historique des PDFs générés à partir des templates. Stockés dans bucket syndic-pdf-generated. field_values conservées pour audit / regénération.';
