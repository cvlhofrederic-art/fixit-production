-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 058 — Activation cron job idempotency_keys + verification
-- Date: 2026-04-12
-- Audit: DB-22 — Job de cleanup idempotency_keys commente dans migration 038
--
-- IMPORTANT: Necessite l'extension pg_cron activee.
-- Si pg_cron n'est pas actif, cette migration echoue silencieusement.
-- ══════════════════════════════════════════════════════════════════════════════

-- Activer le cleanup des idempotency_keys > 24h (chaque heure)
-- Note: delimiters nommes $outer$ pour eviter conflit avec $$ imbrique
-- dans la chaine SQL passee a cron.schedule (bug migration pre-existante).
DO $outer$ BEGIN
  PERFORM cron.schedule(
    'cleanup-idempotency',
    '17 * * * *',
    $inner$DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '24 hours'$inner$
  );
EXCEPTION WHEN undefined_function OR insufficient_privilege THEN
  RAISE WARNING 'pg_cron not available — idempotency_keys cleanup not scheduled. Enable pg_cron in Supabase Dashboard > Database > Extensions.';
END $outer$;

-- Verification : lister tous les jobs pg_cron actifs
-- SELECT * FROM cron.job ORDER BY jobname;
-- Attendu : cleanup-idempotency, audit_logs_cleanup, analytics_events_cleanup, anonymize-old-bookings
