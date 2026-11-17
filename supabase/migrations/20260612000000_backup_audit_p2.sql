-- ══════════════════════════════════════════════════════════════════════════════
-- DÉJÀ APPLIQUÉE EN PRODUCTION le 13/06/2026 (supabase db push, projet irluhepekbqgquveaett) — NE PAS REJOUER.
-- Version 20260612000000 inscrite au registre des migrations de la prod (relevé du 17/11/2026).
-- Plusieurs de ces fichiers modifient des données ou des droits selon l'état de la base : n'en rejouer aucun, même
-- s'ils se disent idempotents.
-- Reprise telle quelle de la branche fix/audit-p2-data-layer (PR #470, commit 5cfbc11c) pour que le dépôt
-- reflète la base de production ; seul cet en-tête a été ajouté.
-- Rejouée, cette migration réécrirait l'instantané backup_audit_p2 (DROP TABLE IF EXISTS puis copie des tables actuelles).
-- La recette « RESTAURATION » plus bas date de juin 2026 : ne pas l'exécuter telle quelle (son TRUNCATE effacerait les
-- réservations créées depuis le 13/06/2026).
-- ══════════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000000 — Snapshot de sécurité AVANT le lot de remédiation P2
-- Date : 2026-06-13 — Audit Phase 2/9 Data Layer
-- ──────────────────────────────────────────────────────────────────────────────
-- CONTEXTE : le projet est sur le plan gratuit, SANS backup plateforme ni PITR.
-- Cette migration s'exécute en TÊTE du lot 20260612* (avant 000001) et copie les
-- tables qui vont être mutées par les migrations suivantes dans un schéma dédié
-- backup_audit_p2. C'est le filet de restauration intra-base pour cette opération.
--
-- Tables snapshotées et raison :
--   bookings              — 000003 soft-delete 4 doublons de créneau
--   syndic_oauth_tokens   — 000008 DROP de colonnes legacy (0 ligne en prod)
--   devis, factures       — 000001 NOT NULL + CHECK + FK (pas de perte, prudence)
--   referrals             — 000003 UNIQUE partiel (pas de perte, prudence)
--   doc_sequences         — 000002 CASCADE→RESTRICT (contrainte seule, prudence)
--   situations_btp, retenues_btp, dc4_btp, depenses_btp, pointages_btp
--                         — 000002 CASCADE→RESTRICT (contrainte seule, prudence)
--
-- RESTAURATION d'une table (exemple bookings) :
--   -- réimporter les lignes telles qu'avant :
--   TRUNCATE public.bookings;  -- ⚠️ seulement si vous savez ce que vous faites
--   INSERT INTO public.bookings SELECT * FROM backup_audit_p2.bookings_20260613;
--   -- OU, pour annuler uniquement les soft-delete du lot :
--   UPDATE public.bookings b SET deleted_at = NULL
--     FROM backup_audit_p2.bookings_20260613 o
--    WHERE b.id = o.id AND o.deleted_at IS NULL AND b.deleted_at IS NOT NULL;
--
-- Idempotent : DROP TABLE IF EXISTS avant chaque copie (rejouable).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS backup_audit_p2;
COMMENT ON SCHEMA backup_audit_p2 IS
  'Snapshot one-shot des tables mutées par le lot 20260612* (audit P2, 2026-06-13). Plan gratuit sans backup plateforme. Supprimable une fois la remédiation validée : DROP SCHEMA backup_audit_p2 CASCADE.';

DO $$
DECLARE
  v_tbl text;
  v_tables text[] := ARRAY[
    'bookings', 'syndic_oauth_tokens', 'devis', 'factures', 'referrals',
    'doc_sequences', 'situations_btp', 'retenues_btp', 'dc4_btp',
    'depenses_btp', 'pointages_btp'
  ];
BEGIN
  FOREACH v_tbl IN ARRAY v_tables LOOP
    -- ne snapshote que les tables réellement présentes en live
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format('DROP TABLE IF EXISTS backup_audit_p2.%I', v_tbl || '_20260613');
      EXECUTE format(
        'CREATE TABLE backup_audit_p2.%I AS TABLE public.%I',
        v_tbl || '_20260613', v_tbl
      );
      RAISE NOTICE 'Snapshot créé : backup_audit_p2.%_20260613', v_tbl;
    ELSE
      RAISE NOTICE 'Table public.% absente — snapshot ignoré', v_tbl;
    END IF;
  END LOOP;
END $$;

-- Récapitulatif des tables de sauvegarde et de leur nombre de lignes.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname,
           (xpath('/row/cnt/text()',
             query_to_xml(format('SELECT count(*) AS cnt FROM backup_audit_p2.%I', c.relname),
                          false, true, '')))[1]::text::bigint AS n
    FROM pg_class c
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE ns.nspname = 'backup_audit_p2' AND c.relkind = 'r'
    ORDER BY c.relname
  LOOP
    RAISE NOTICE 'backup_audit_p2.% : % lignes', r.relname, r.n;
  END LOOP;
END $$;
