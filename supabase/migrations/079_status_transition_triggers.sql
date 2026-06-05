-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 079 — Triggers de transition de statut (FR-V1)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Conformité art. 242 nonies CGI (continuité numérotation, immutabilité post-
-- émission). Empêche les retours en arrière (`paid → pending`, `signed → draft`)
-- ainsi que les transitions invalides arbitraires.
--
-- Matrice DEVIS:
--   draft     → sent | cancelled
--   sent      → signed | expired | cancelled
--   signed    → cancelled
--   expired   → terminal
--   cancelled → terminal
--
-- Matrice FACTURE:
--   pending   → paid | overdue | cancelled
--   paid      → refunded | cancelled
--   overdue   → paid | cancelled
--   refunded  → terminal
--   cancelled → terminal

-- ── DEVIS ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_devis_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'draft' AND NEW.status IN ('sent', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'sent' AND NEW.status IN ('signed', 'expired', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'signed' AND NEW.status = 'cancelled' THEN
    allowed := TRUE;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid devis status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation',
            HINT = 'See migration 079 for the allowed transition matrix';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS devis_validate_transition ON devis;
CREATE TRIGGER devis_validate_transition
  BEFORE UPDATE OF status ON devis
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_devis_transition();

-- ── FACTURES ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_facture_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'pending' AND NEW.status IN ('paid', 'overdue', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'paid' AND NEW.status IN ('refunded', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'overdue' AND NEW.status IN ('paid', 'cancelled') THEN
    allowed := TRUE;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid facture status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation',
            HINT = 'See migration 079 for the allowed transition matrix';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS factures_validate_transition ON factures;
CREATE TRIGGER factures_validate_transition
  BEFORE UPDATE OF status ON factures
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_facture_transition();

COMMENT ON FUNCTION public.validate_devis_transition() IS
  'Empêche transitions de statut interdites sur devis (art. 242 nonies CGI).';
COMMENT ON FUNCTION public.validate_facture_transition() IS
  'Empêche transitions de statut interdites sur factures (art. 242 nonies CGI).';
