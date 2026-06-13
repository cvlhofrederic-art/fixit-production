-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000001 — Intégrité facturation (devis / factures)
-- Date : 2026-06-12 — Audit Phase 2/9 Data Layer
-- Constats : INT-02 (FK artisan_id manquantes), C-04 (artisan_user_id NULLABLE,
--            clé RLS), CHECK montants manquants, triggers updated_at absents
--            sur devis/factures (056 enregistrée mais triggers absents en live).
--
-- IMPORTANT : entièrement idempotente. Volumes minuscules vérifiés par l'audit
-- (0 orphelin artisan_id, 0 NULL artisan_user_id au 2026-06-12) → pose directe
-- des contraintes acceptable. Sur de gros volumes, préférer ADD CONSTRAINT ...
-- NOT VALID puis VALIDATE CONSTRAINT dans une transaction séparée.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. FK devis.artisan_id / factures.artisan_id → profiles_artisan(id) ──────
-- ON DELETE RESTRICT : un profil artisan ne peut pas être supprimé tant que
-- des documents de facturation (conservation légale 10 ans) le référencent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devis_artisan_id_fkey'
      AND conrelid = 'public.devis'::regclass
  ) THEN
    ALTER TABLE public.devis
      ADD CONSTRAINT devis_artisan_id_fkey
      FOREIGN KEY (artisan_id) REFERENCES public.profiles_artisan(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'factures_artisan_id_fkey'
      AND conrelid = 'public.factures'::regclass
  ) THEN
    ALTER TABLE public.factures
      ADD CONSTRAINT factures_artisan_id_fkey
      FOREIGN KEY (artisan_id) REFERENCES public.profiles_artisan(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ── 2. NOT NULL sur artisan_user_id (C-04 — colonne pivot des policies RLS) ──
-- Garde-fou : échec explicite si des NULL sont apparus depuis l'audit.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.devis WHERE artisan_user_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'devis.artisan_user_id contient des NULL — corriger les lignes avant de poser NOT NULL (audit C-04 : 0 NULL vérifié le 2026-06-12)';
  END IF;
  ALTER TABLE public.devis ALTER COLUMN artisan_user_id SET NOT NULL;

  IF EXISTS (SELECT 1 FROM public.factures WHERE artisan_user_id IS NULL LIMIT 1) THEN
    RAISE EXCEPTION 'factures.artisan_user_id contient des NULL — corriger les lignes avant de poser NOT NULL (audit C-04 : 0 NULL vérifié le 2026-06-12)';
  END IF;
  ALTER TABLE public.factures ALTER COLUMN artisan_user_id SET NOT NULL;
END $$;

-- ── 3. CHECK montants ─────────────────────────────────────────────────────────
-- devis : jamais de montants négatifs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'devis_montants_non_negatifs'
      AND conrelid = 'public.devis'::regclass
  ) THEN
    ALTER TABLE public.devis
      ADD CONSTRAINT devis_montants_non_negatifs
      CHECK (total_ht_cents >= 0 AND total_tax_cents >= 0 AND total_ttc_cents >= 0);
  END IF;
END $$;

-- factures : montants négatifs autorisés UNIQUEMENT pour les avoirs.
-- Réf. 20260514_tva_regime_facturation.sql : « un avoir = facture avec montants
-- négatifs + avoir_de_facture_id pointant vers la facture corrigée ».
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'factures_montants_non_negatifs_sauf_avoir'
      AND conrelid = 'public.factures'::regclass
  ) THEN
    ALTER TABLE public.factures
      ADD CONSTRAINT factures_montants_non_negatifs_sauf_avoir
      CHECK (
        avoir_de_facture_id IS NOT NULL
        OR (total_ht_cents >= 0 AND total_tax_cents >= 0 AND total_ttc_cents >= 0)
      );
  END IF;
END $$;

-- ── 4. Triggers updated_at sur devis / factures ───────────────────────────────
-- Réutilise la fonction générique de 056_updated_at_triggers.sql.
-- CREATE OR REPLACE avec SET search_path = pg_catalog, public pour ne PAS
-- effacer le réglage posé par 071_function_search_path.sql (leçon : 20260602
-- avait wipé le search_path de validate_facture_transition via OR REPLACE).
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devis_updated_at ON public.devis;
CREATE TRIGGER trg_devis_updated_at
  BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_factures_updated_at ON public.factures;
CREATE TRIGGER trg_factures_updated_at
  BEFORE UPDATE ON public.factures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
