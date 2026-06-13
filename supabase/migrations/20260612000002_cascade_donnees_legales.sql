-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000002 — CASCADE → RESTRICT sur les données légales
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : INT-03 (doc_sequences.artisan_user_id ON DELETE CASCADE = perte de
--            la numérotation gapless art. L441-3 C. com. à la suppression du
--            compte), INT-04 (5 tables BTP légales en CASCADE sur auth.users :
--            situations_btp, retenues_btp, dc4_btp, depenses_btp, pointages_btp).
--
-- HORS PÉRIMÈTRE VOLONTAIRE : les ~45 FK ON DELETE CASCADE des tables syndic_*
-- (compta syndic PT incluse) ne sont PAS touchées ici — scope dormant, à
-- traiter avec la Phase 3 (RLS / multi-tenant).
--
-- Pattern : DO $$ défensif — retrouve le nom réel de la contrainte FK via
-- pg_constraint (les noms live attendus sont <table>_<colonne>_fkey, mais on ne
-- présume pas), la droppe SEULEMENT si elle est en ON DELETE CASCADE
-- (confdeltype = 'c'), puis recrée <table>_<colonne>_fkey en ON DELETE RESTRICT.
-- Idempotente : un second passage ne trouve plus de CASCADE → no-op.
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  tgt RECORD;
  con RECORD;
BEGIN
  FOR tgt IN
    SELECT *
    FROM (VALUES
      ('doc_sequences',  'artisan_user_id'),
      ('situations_btp', 'owner_id'),
      ('retenues_btp',   'owner_id'),
      ('dc4_btp',        'owner_id'),
      ('depenses_btp',   'owner_id'),
      ('pointages_btp',  'owner_id')
    ) AS t(tbl, col)
  LOOP
    -- Table absente (drift) → on passe, sans erreur.
    IF to_regclass('public.' || tgt.tbl) IS NULL THEN
      RAISE NOTICE 'Table public.% absente — ignorée', tgt.tbl;
      CONTINUE;
    END IF;

    FOR con IN
      SELECT c.conname
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass('public.' || tgt.tbl)
        AND c.contype = 'f'
        AND c.confrelid = 'auth.users'::regclass
        AND c.confdeltype = 'c'  -- ON DELETE CASCADE uniquement
        AND (
          SELECT array_agg(a.attname ORDER BY k.ord)
          FROM unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_attribute a
            ON a.attrelid = c.conrelid AND a.attnum = k.attnum
        ) = ARRAY[tgt.col]::name[]
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tgt.tbl, con.conname);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE RESTRICT',
        tgt.tbl, tgt.tbl || '_' || tgt.col || '_fkey', tgt.col
      );
      RAISE NOTICE 'FK % sur public.% : CASCADE → RESTRICT', con.conname, tgt.tbl;
    END LOOP;
  END LOOP;
END $$;

-- Documentation en base : pourquoi RESTRICT (défensif — seulement si la
-- contrainte porte bien le nom canonique).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'doc_sequences_artisan_user_id_fkey'
      AND conrelid = to_regclass('public.doc_sequences')
  ) THEN
    COMMENT ON CONSTRAINT doc_sequences_artisan_user_id_fkey ON public.doc_sequences IS
      'ON DELETE RESTRICT (audit INT-03) : la séquence de numérotation gapless (art. L441-3 C. com.) ne doit jamais disparaître avec le compte. Suppression de compte = procédure RGPD dédiée avec archivage préalable.';
  END IF;
END $$;
