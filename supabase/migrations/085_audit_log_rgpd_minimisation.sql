-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 086 — RGPD minimisation sur documents_audit_log (FR-V8)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Audit security-reviewer 2026-05-05 : migration 080 logue `client_name` dans
-- documents_audit_log.details (JSONB). Quand anonymize_old_devis() / _factures()
-- (FR-V5) anonymise la ligne source à 11 ans, le client_name persiste dans
-- l'audit_log → violation RGPD Art. 5.1.e (minimisation).
--
-- Fix : retirer client_name du jsonb_build_object des triggers. Garder
-- uniquement les éléments nécessaires à la traçabilité fiscale (montant,
-- doc_number) qui ne sont PAS des données personnelles directes.
--
-- Pour les audit_log déjà créés contenant client_name : un job d'anonymisation
-- (commenté ci-dessous, à activer si volume significatif) peut nettoyer les
-- entrées > 11 ans. Pour l'instant la table est presque vide en prod.

-- ── 1. Recréer audit_devis_changes sans client_name ──────────────────────────
CREATE OR REPLACE FUNCTION public.audit_devis_changes()
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
      -- RGPD minimisation : pas de client_name. Le doc_number + record_id
      -- suffisent pour traçabilité ; client_name reste accessible dans la
      -- table source jusqu'à anonymisation à 11 ans.
      jsonb_build_object('total_ttc_cents', NEW.total_ttc_cents)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Recréer audit_factures_changes sans client_name ───────────────────────
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
      -- RGPD minimisation : pas de client_name (cf. fonction devis ci-dessus).
      jsonb_build_object('total_ttc_cents', NEW.total_ttc_cents, 'paid_at', NEW.paid_at)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Cleanup rétroactif des audit_log existants ────────────────────────────
-- Retire client_name des entrées déjà créées (puisque la prod n'a quasi rien
-- pour l'instant, l'opération est bornée). Idempotent.
UPDATE documents_audit_log
SET details = details - 'client_name'
WHERE details ? 'client_name';

COMMENT ON FUNCTION public.audit_devis_changes() IS
  'Trigger AFTER UPDATE devis. RGPD-minimisé (pas de client_name dans details). FR-V8.';
COMMENT ON FUNCTION public.audit_factures_changes() IS
  'Trigger AFTER UPDATE factures. RGPD-minimisé (pas de client_name dans details). FR-V8.';
