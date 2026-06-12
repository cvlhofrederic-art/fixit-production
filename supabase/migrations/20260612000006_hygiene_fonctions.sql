-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000006 — Hygiène fonctions, index, policies
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : FNC-05 (validate_facture_transition sans search_path — le réglage
--            posé par 20260523 a été effacé par le CREATE OR REPLACE de
--            20260602000002), IDX-06 (artisans_catalogue filtrée par ville sans
--            index — app/api/artisans-catalogue + app/fr/recherche), IDX-02
--            (8 policies restantes avec auth.*() non encapsulé → ré-évalué par
--            ligne), IDX-04 (5 index doublons stricts d'index UNIQUE), TEN-08
--            (tables service-role only non documentées).
--
-- IMPORTANT : entièrement idempotente.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. FNC-05 — search_path sur validate_facture_transition ──────────────────
DO $$
BEGIN
  IF to_regprocedure('public.validate_facture_transition()') IS NOT NULL THEN
    ALTER FUNCTION public.validate_facture_transition() SET search_path = public;
  ELSE
    RAISE NOTICE 'validate_facture_transition() absente — FNC-05 ignoré';
  END IF;
END $$;

-- ── 2. IDX-06 — index sur artisans_catalogue(ville) ───────────────────────────
-- Table vivante sans CREATE dans le repo (drift) → garde to_regclass.
DO $$
BEGIN
  IF to_regclass('public.artisans_catalogue') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_artisans_catalogue_ville
      ON public.artisans_catalogue (ville);
  ELSE
    RAISE NOTICE 'artisans_catalogue absente — IDX-06 ignoré';
  END IF;
END $$;

-- ── 3. IDX-02 — encapsulation initplan des 8 policies restantes ───────────────
-- Pattern de référence : 20260610000002_rls_initplan_wrap.sql (ALTER POLICY,
-- jamais DROP/CREATE — cmd, rôles et nom préservés). Ici en DO $$ défensif :
-- on relit le qual/with_check réel via pg_policies et on n'encapsule que les
-- appels auth.uid()/auth.role()/auth.jwt() encore nus. Les formes déjà
-- encapsulées (affichées « ( SELECT auth.uid() AS uid) » par pg_get_expr) sont
-- protégées par placeholder avant remplacement. Idempotent : un second passage
-- ne trouve plus d'appel nu → no-op.
DO $$
DECLARE
  pol RECORD;
  new_qual  text;
  new_check text;
  stmt      text;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'syndic_orcamentos_owner',
        'syndic_dashboard_prefs_owner',
        'audit_logs_service_role_all',
        'sync_jobs_write',
        'data_requests_service_role',
        'ref_prix_read',
        'ref_taux_read',
        'documents_audit_log_service'
      )
  LOOP
    -- Encapsuler le USING (qual) si nécessaire
    new_qual := pol.qual;
    IF new_qual IS NOT NULL THEN
      new_qual := replace(new_qual, '( SELECT auth.uid() AS uid)',   '@@W_UID@@');
      new_qual := replace(new_qual, '( SELECT auth.role() AS role)', '@@W_ROLE@@');
      new_qual := replace(new_qual, '( SELECT auth.jwt() AS jwt)',   '@@W_JWT@@');
      new_qual := replace(new_qual, 'auth.uid()',  '(SELECT auth.uid())');
      new_qual := replace(new_qual, 'auth.role()', '(SELECT auth.role())');
      new_qual := replace(new_qual, 'auth.jwt()',  '(SELECT auth.jwt())');
      new_qual := replace(new_qual, '@@W_UID@@',  '( SELECT auth.uid() AS uid)');
      new_qual := replace(new_qual, '@@W_ROLE@@', '( SELECT auth.role() AS role)');
      new_qual := replace(new_qual, '@@W_JWT@@',  '( SELECT auth.jwt() AS jwt)');
    END IF;

    -- Encapsuler le WITH CHECK si nécessaire
    new_check := pol.with_check;
    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, '( SELECT auth.uid() AS uid)',   '@@W_UID@@');
      new_check := replace(new_check, '( SELECT auth.role() AS role)', '@@W_ROLE@@');
      new_check := replace(new_check, '( SELECT auth.jwt() AS jwt)',   '@@W_JWT@@');
      new_check := replace(new_check, 'auth.uid()',  '(SELECT auth.uid())');
      new_check := replace(new_check, 'auth.role()', '(SELECT auth.role())');
      new_check := replace(new_check, 'auth.jwt()',  '(SELECT auth.jwt())');
      new_check := replace(new_check, '@@W_UID@@',  '( SELECT auth.uid() AS uid)');
      new_check := replace(new_check, '@@W_ROLE@@', '( SELECT auth.role() AS role)');
      new_check := replace(new_check, '@@W_JWT@@',  '( SELECT auth.jwt() AS jwt)');
    END IF;

    -- Rien à réécrire → policy suivante
    IF (new_qual IS NOT DISTINCT FROM pol.qual)
       AND (new_check IS NOT DISTINCT FROM pol.with_check) THEN
      CONTINUE;
    END IF;

    stmt := format('ALTER POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    -- Les policies INSERT n'ont pas de USING ; SELECT/DELETE n'ont pas de WITH CHECK.
    IF new_qual IS NOT NULL THEN
      stmt := stmt || format(' USING (%s)', new_qual);
    END IF;
    IF new_check IS NOT NULL THEN
      stmt := stmt || format(' WITH CHECK (%s)', new_check);
    END IF;
    EXECUTE stmt;
    RAISE NOTICE 'IDX-02 : policy %.% réécrite (initplan wrap)', pol.tablename, pol.policyname;
  END LOOP;
END $$;

-- ── 4. IDX-04 — suppression des 5 index doublons stricts d'UNIQUE ─────────────
-- Chacun duplique exactement l'index implicite d'une contrainte UNIQUE/PK
-- (vérifié par l'audit sur le schéma live via pg_indexes). DROP INDEX échouerait
-- s'ils portaient une contrainte — ce ne sont que des index « plain ».
DROP INDEX IF EXISTS public.idx_idempotency_keys_key;      -- doublon de idempotency_keys(key) UNIQUE (037)
DROP INDEX IF EXISTS public.idx_pro_team_token;            -- doublon de pro_team_members(invite_token) UNIQUE (048)
DROP INDEX IF EXISTS public.idx_team_token;                -- doublon UNIQUE équivalent (objet live hors repo)
DROP INDEX IF EXISTS public.idx_booking_reviews_booking;   -- doublon de l'UNIQUE live sur booking_reviews(booking_id)
DROP INDEX IF EXISTS public.idx_sub_metrics_date;          -- doublon UNIQUE équivalent (objet live hors repo)

-- ── 5. TEN-08 — documenter les tables service-role only ───────────────────────
DO $$
BEGIN
  IF to_regclass('public.idempotency_keys') IS NOT NULL THEN
    COMMENT ON TABLE public.idempotency_keys IS
      'Service-role only — clés d''idempotence API (TTL 24 h, purge cron). Aucun accès client : RLS deny par défaut, écriture exclusivement via supabaseAdmin.';
  END IF;
  IF to_regclass('public.stripe_webhook_events') IS NOT NULL THEN
    COMMENT ON TABLE public.stripe_webhook_events IS
      'Service-role only — déduplication des événements webhook Stripe. Aucun accès client : RLS deny par défaut, écriture exclusivement via supabaseAdmin.';
  END IF;
END $$;
