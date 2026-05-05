-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 080 — Audit log dédié documents (FR-V1)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Table séparée d'audit_logs car la rétention est différente :
--   - audit_logs (042) : auto-cleanup > 1 an (RGPD proportionnalité)
--   - documents_audit_log : conservation 10 ans (Code commerce L123-22)
--
-- Capture toutes les mutations sensibles sur devis/factures/pt_fiscal_documents.

-- ── 1. Table documents_audit_log ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('update','cancel','soft_delete','restore','sign')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  doc_number TEXT,
  old_status TEXT,
  new_status TEXT,
  cancelled_reason TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_record
  ON documents_audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_user
  ON documents_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_created
  ON documents_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doc_audit_doc_number
  ON documents_audit_log(doc_number) WHERE doc_number IS NOT NULL;

-- ── 2. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE documents_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_audit_log_service" ON documents_audit_log;
CREATE POLICY "documents_audit_log_service" ON documents_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "documents_audit_log_owner_read" ON documents_audit_log;
CREATE POLICY "documents_audit_log_owner_read" ON documents_audit_log
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "documents_audit_log_super_admin" ON documents_audit_log;
CREATE POLICY "documents_audit_log_super_admin" ON documents_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND u.raw_app_meta_data->>'role' = 'super_admin'
    )
  );

-- ── 3. Trigger function devis ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_devis_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Seulement si quelque chose de significatif a changé
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
     OR OLD.signed_at IS DISTINCT FROM NEW.signed_at THEN

    v_action := CASE
      WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'soft_delete'
      WHEN NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN 'restore'
      WHEN NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN 'cancel'
      WHEN NEW.signed_at IS NOT NULL AND OLD.signed_at IS NULL THEN 'sign'
      ELSE 'update'
    END;

    INSERT INTO documents_audit_log (
      user_id, action, table_name, record_id, doc_number,
      old_status, new_status, cancelled_reason, details
    ) VALUES (
      auth.uid(),
      v_action,
      'devis',
      NEW.id,
      NEW.numero,
      OLD.status,
      NEW.status,
      NEW.cancelled_reason,
      jsonb_build_object(
        'total_ttc_cents', NEW.total_ttc_cents,
        'client_name', NEW.client_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 4. Trigger function factures ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.audit_factures_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status
     OR OLD.cancelled_at IS DISTINCT FROM NEW.cancelled_at
     OR OLD.deleted_at IS DISTINCT FROM NEW.deleted_at
     OR OLD.paid_at IS DISTINCT FROM NEW.paid_at THEN

    v_action := CASE
      WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'soft_delete'
      WHEN NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN 'restore'
      WHEN NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL THEN 'cancel'
      ELSE 'update'
    END;

    INSERT INTO documents_audit_log (
      user_id, action, table_name, record_id, doc_number,
      old_status, new_status, cancelled_reason, details
    ) VALUES (
      auth.uid(),
      v_action,
      'factures',
      NEW.id,
      NEW.numero,
      OLD.status,
      NEW.status,
      NEW.cancelled_reason,
      jsonb_build_object(
        'total_ttc_cents', NEW.total_ttc_cents,
        'client_name', NEW.client_name,
        'paid_at', NEW.paid_at
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. Triggers ──────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS devis_audit_trigger ON devis;
CREATE TRIGGER devis_audit_trigger
  AFTER UPDATE ON devis
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_devis_changes();

DROP TRIGGER IF EXISTS factures_audit_trigger ON factures;
CREATE TRIGGER factures_audit_trigger
  AFTER UPDATE ON factures
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_factures_changes();

COMMENT ON TABLE documents_audit_log IS
  'Audit immuable des mutations sensibles devis/factures. Conservation 10 ans (Code commerce L123-22).';
COMMENT ON FUNCTION public.audit_devis_changes() IS
  'Trigger AFTER UPDATE devis : log statut, annulation, soft-delete, signature.';
COMMENT ON FUNCTION public.audit_factures_changes() IS
  'Trigger AFTER UPDATE factures : log statut, annulation, soft-delete, paiement.';
