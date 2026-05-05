-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 083 — Pipeline rétention 10 ans + anonymisation 11 ans (FR-V5)
-- Date: 2026-05-05
-- ══════════════════════════════════════════════════════════════════════════════
-- Conformité Code commerce L. 123-22 (10 ans conservation) + RGPD Art. 5.1.e
-- (principe de minimisation : anonymisation des données personnelles dès qu'on
-- n'en a plus l'usage légal).
--
-- Stratégie :
--   - 10 ans : aucune action (les docs restent intacts)
--   - 11 ans : anonymisation des données personnelles client (nom, email, NIF,
--     adresse) sur les docs émis. Les montants HT/TTC, doc_number, hash chain
--     restent en place comme preuve fiscale agrégée.
--   - Mécanisme legal_hold : flag par doc qui suspend l'anonymisation si litige
--     actif (le responsable doit le poser manuellement).
--
-- Pas de DELETE physique : la durée de conservation peut être prolongée par
-- une obligation légale supérieure (litige, enquête fiscale).

-- ── 1. Colonne legal_hold (suspension de l'anonymisation) ────────────────────
ALTER TABLE devis ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS legal_hold BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE factures ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_devis_anonymize_eligible
  ON devis(created_at) WHERE anonymized_at IS NULL AND legal_hold = FALSE;
CREATE INDEX IF NOT EXISTS idx_factures_anonymize_eligible
  ON factures(created_at) WHERE anonymized_at IS NULL AND legal_hold = FALSE;

-- ── 2. Fonctions d'anonymisation ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.anonymize_old_devis()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH anonymized AS (
    UPDATE devis SET
      client_name = '[ANONYMIZED]',
      client_email = NULL,
      client_phone = NULL,
      client_address = NULL,
      anonymized_at = NOW()
    WHERE created_at < NOW() - INTERVAL '11 years'
      AND anonymized_at IS NULL
      AND legal_hold = FALSE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM anonymized;

  -- Log dans documents_audit_log (FR-V1)
  IF v_count > 0 THEN
    INSERT INTO documents_audit_log (
      user_id, action, table_name, record_id, doc_number,
      old_status, new_status, details
    )
    SELECT NULL, 'anonymize', 'devis', NULL, NULL, NULL, NULL,
           jsonb_build_object('count', v_count, 'reason', 'RGPD Art 5.1.e — 11 ans');
  END IF;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_old_factures()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH anonymized AS (
    UPDATE factures SET
      client_name = '[ANONYMIZED]',
      client_email = NULL,
      client_phone = NULL,
      client_address = NULL,
      anonymized_at = NOW()
    WHERE created_at < NOW() - INTERVAL '11 years'
      AND anonymized_at IS NULL
      AND legal_hold = FALSE
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM anonymized;

  IF v_count > 0 THEN
    INSERT INTO documents_audit_log (
      user_id, action, table_name, record_id, doc_number,
      old_status, new_status, details
    )
    SELECT NULL, 'anonymize', 'factures', NULL, NULL, NULL, NULL,
           jsonb_build_object('count', v_count, 'reason', 'RGPD Art 5.1.e — 11 ans');
  END IF;

  RETURN v_count;
END;
$$;

-- ── 3. Modifier l'enum action de documents_audit_log pour inclure 'anonymize' ─
DO $migration_083_check$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'documents_audit_log'
  ) THEN
    -- Élargir le CHECK constraint si nécessaire
    ALTER TABLE documents_audit_log DROP CONSTRAINT IF EXISTS documents_audit_log_action_check;
    ALTER TABLE documents_audit_log ADD CONSTRAINT documents_audit_log_action_check
      CHECK (action IN ('update','cancel','soft_delete','restore','sign','anonymize'));
  END IF;
END $migration_083_check$;

-- ── 4. pg_cron : exécuter le 1er de chaque mois à 4h UTC ────────────────────
-- Si pg_cron n'est pas disponible (env CI), DO block silently skip.
DO $migration_083_cron$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Devis
    PERFORM cron.unschedule('anonymize_old_devis_monthly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anonymize_old_devis_monthly');
    PERFORM cron.schedule(
      'anonymize_old_devis_monthly',
      '0 4 1 * *',
      'SELECT public.anonymize_old_devis()'
    );
    -- Factures
    PERFORM cron.unschedule('anonymize_old_factures_monthly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'anonymize_old_factures_monthly');
    PERFORM cron.schedule(
      'anonymize_old_factures_monthly',
      '5 4 1 * *',  -- 5 min après devis
      'SELECT public.anonymize_old_factures()'
    );
    RAISE NOTICE 'Anonymization cron jobs scheduled.';
  ELSE
    RAISE NOTICE 'pg_cron extension not available — anonymization must be run manually.';
  END IF;
END $migration_083_cron$;

-- ── 5. Vue récapitulative pour audit / dashboard ─────────────────────────────
CREATE OR REPLACE VIEW v_documents_retention_status AS
SELECT
  'devis' AS table_name,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '10 years' AND anonymized_at IS NULL) AS over_10y_not_anonymized,
  COUNT(*) FILTER (WHERE anonymized_at IS NOT NULL) AS anonymized_count,
  COUNT(*) FILTER (WHERE legal_hold = TRUE) AS legal_hold_count
FROM devis
UNION ALL
SELECT
  'factures' AS table_name,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '10 years' AND anonymized_at IS NULL) AS over_10y_not_anonymized,
  COUNT(*) FILTER (WHERE anonymized_at IS NOT NULL) AS anonymized_count,
  COUNT(*) FILTER (WHERE legal_hold = TRUE) AS legal_hold_count
FROM factures;

COMMENT ON COLUMN devis.legal_hold IS 'Suspend l''anonymisation automatique (litige actif).';
COMMENT ON COLUMN devis.anonymized_at IS 'Timestamp d''anonymisation. NULL = données personnelles encore présentes.';
COMMENT ON COLUMN factures.legal_hold IS 'Suspend l''anonymisation automatique (litige actif).';
COMMENT ON COLUMN factures.anonymized_at IS 'Timestamp d''anonymisation. NULL = données personnelles encore présentes.';
COMMENT ON FUNCTION public.anonymize_old_devis() IS
  'FR-V5 : anonymise client_name/email/phone/address sur devis > 11 ans (RGPD Art. 5.1.e).';
COMMENT ON FUNCTION public.anonymize_old_factures() IS
  'FR-V5 : anonymise client_name/email/phone/address sur factures > 11 ans (RGPD Art. 5.1.e).';
COMMENT ON VIEW v_documents_retention_status IS
  'Dashboard de conformité : combien de docs au-delà de 10 ans, anonymisés, en legal hold.';
