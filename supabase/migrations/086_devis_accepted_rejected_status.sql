-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 086 — Ajout statuts 'accepted' et 'rejected' aux devis (FR-V7)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Standard pro 2026 : un devis traverse Brouillon → Envoyé → Accepté/Refusé/
-- Expiré/Annulé. Avant cette migration, le code n'avait que 'signed' (= signé
-- avec signature électronique) comme statut d'acceptation. On ajoute :
--   - 'accepted'  : accepté manuellement par l'artisan (client a appelé,
--                   accord verbal, etc.) — pas de signature numérique
--   - 'rejected'  : refusé explicitement par le client
--
-- 'signed' reste pour les acceptations avec signature canvas (signature
-- électronique simple eIDAS art. 25 §1 + hash chain FR-V1).
--
-- Compatibilité hash chain (FR-V1) : la transition sent → accepted/rejected
-- ne modifie PAS le content_hash (qui reste celui calculé à l'émission).
-- L'audit log (FR-V1) capture la transition automatiquement.

-- ── 1. Étendre le CHECK constraint sur devis.status ──────────────────────────
ALTER TABLE devis DROP CONSTRAINT IF EXISTS devis_status_check;
ALTER TABLE devis ADD CONSTRAINT devis_status_check
  CHECK (status IN ('draft','sent','signed','accepted','rejected','expired','cancelled'));

-- ── 2. Étendre le trigger validate_devis_transition ──────────────────────────
-- Matrice étendue :
--   draft     → sent | cancelled
--   sent      → signed | accepted | rejected | expired | cancelled
--   signed    → cancelled
--   accepted  → cancelled
--   rejected  → terminal
--   expired   → terminal
--   cancelled → terminal
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
  ELSIF OLD.status = 'sent' AND NEW.status IN ('signed', 'accepted', 'rejected', 'expired', 'cancelled') THEN
    allowed := TRUE;
  ELSIF OLD.status = 'signed' AND NEW.status = 'cancelled' THEN
    allowed := TRUE;
  ELSIF OLD.status = 'accepted' AND NEW.status = 'cancelled' THEN
    allowed := TRUE;
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid devis status transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation',
            HINT = 'See migration 086 for the allowed transition matrix';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Colonnes traçabilité de la réponse client (optionnel, FR-V7) ──────────
-- Pour permettre à l'artisan de noter manuellement quand/pourquoi un devis a
-- été accepté/refusé. La preuve de transition reste dans documents_audit_log.
ALTER TABLE devis ADD COLUMN IF NOT EXISTS client_response_at TIMESTAMPTZ;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS client_response_reason TEXT;

COMMENT ON COLUMN devis.client_response_at IS
  'Horodatage de la réponse client (acceptation manuelle ou refus). NULL si pas de réponse.';
COMMENT ON COLUMN devis.client_response_reason IS
  'Raison du refus ou note libre sur l''acceptation.';
COMMENT ON FUNCTION public.validate_devis_transition() IS
  'Empêche transitions de statut interdites sur devis (FR-V7 : accepted, rejected ajoutés).';
