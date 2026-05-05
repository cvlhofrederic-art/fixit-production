-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 082 — PT Proforma Lockdown (PT-V1)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Vitfix.io n'est PAS un logiciel certifié AT (Decreto-Lei 28/2019). L'émission
-- de fatura PT avec un certNumber hardcodé constitue un délit fiscal (peines :
-- 1500-150 000€ + interdiction d'exercer).
--
-- Cette migration désactive l'émission de fatura PT côté DB :
--   - Trigger BEFORE INSERT sur pt_fiscal_documents → RAISE EXCEPTION
--   - Documents existants conservés en lecture seule (preuve historique)
--   - À réactiver UNIQUEMENT si Vitfix obtient sa certification AT
--     (cf. docs/integrations/pt-fatura-reactivation.md)

-- ── 1. Trigger blocking new fatura emissions ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_pt_fiscal_emission()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'PT fiscal document emission is disabled. Vitfix is not AT-certified (Decreto-Lei 28/2019). Use third-party certified software (Moloni, InvoiceXpress) for legal invoicing in Portugal.'
    USING ERRCODE = 'feature_not_supported',
          HINT = 'See docs/integrations/pt-fatura-providers.md';
END;
$$;

DROP TRIGGER IF EXISTS pt_fiscal_documents_block_insert ON pt_fiscal_documents;
CREATE TRIGGER pt_fiscal_documents_block_insert
  BEFORE INSERT ON pt_fiscal_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.block_pt_fiscal_emission();

-- ── 2. Marquer les fiscal series existantes comme désactivées (informationnel) ─
DO $migration$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pt_fiscal_series' AND column_name = 'description') THEN
    UPDATE pt_fiscal_series
    SET description = COALESCE(description, '') || ' [DISABLED 2026-05 — Vitfix non-certifié AT]'
    WHERE description IS NULL OR description NOT LIKE '%DISABLED 2026-05%';
  END IF;
END $migration$;

COMMENT ON FUNCTION public.block_pt_fiscal_emission() IS
  'PT-V1 lockdown : Vitfix non-certifié AT, émission de fatura interdite (Decreto-Lei 28/2019).';
