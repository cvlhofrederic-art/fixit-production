-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000007 — Complétion des triggers updated_at
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constat : C-03 — 29 tables ont une colonne updated_at sans trigger de mise à
--           jour (chantiers_btp, charges_fixes, referrals, settings_btp,
--           syndic_ai_conversations, syndic_emails_analysed,
--           syndic_oauth_tokens + 22 autres syndic_*) : la colonne ment dès le
--           premier UPDATE.
--
-- Approche générique demandée par l'audit : DO $$ qui itère sur TOUTES les
-- tables du schéma public ayant une colonne updated_at et aucun trigger
-- updated_at (set_updated_at() de 056, ou trigger custom dont le nom contient
-- « updated_at », ex. syndic_team_members_set_updated_at de 20260527).
-- Couvre la liste C-03 et restera correct pour rfqs recréée par 20260612000005.
--
-- IMPORTANT : entièrement idempotente (un second passage ne trouve plus de
-- table sans trigger). Convention de nommage : trg_<table>_updated_at (056).
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  rec RECORD;
  trig_name text;
  nb int := 0;
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NULL THEN
    RAISE EXCEPTION 'Fonction public.set_updated_at() absente — appliquer 056_updated_at_triggers.sql / 20260612000001 d''abord';
  END IF;

  FOR rec IN
    SELECT pc.oid AS reloid, pc.relname AS tbl
    FROM pg_class pc
    JOIN pg_namespace n  ON n.oid = pc.relnamespace AND n.nspname = 'public'
    JOIN pg_attribute a  ON a.attrelid = pc.oid
                        AND a.attname = 'updated_at'
                        AND a.attnum > 0
                        AND NOT a.attisdropped
    WHERE pc.relkind IN ('r', 'p')  -- tables ordinaires + partitionnées
      AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger tg
        WHERE tg.tgrelid = pc.oid
          AND NOT tg.tgisinternal
          AND (
            tg.tgfoid = to_regprocedure('public.set_updated_at()')
            OR tg.tgname ~* 'updated_at'
          )
      )
    ORDER BY pc.relname
  LOOP
    trig_name := 'trg_' || rec.tbl || '_updated_at';
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      trig_name, rec.tbl
    );
    nb := nb + 1;
    RAISE NOTICE 'C-03 : trigger % créé sur public.%', trig_name, rec.tbl;
  END LOOP;

  RAISE NOTICE 'C-03 : % trigger(s) updated_at créé(s)', nb;
END $$;
