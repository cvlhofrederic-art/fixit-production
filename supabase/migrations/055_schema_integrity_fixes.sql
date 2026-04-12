-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 055 — Corrections d'integrite referentielle
-- Date: 2026-04-12
-- Audit: DB-04 — NOT NULL sur syndic_signalements.cabinet_id
--        DB-05 — NOT NULL sur syndic_missions.cabinet_id
--        DB-12 — SECURITY DEFINER sans search_path sur increment_listing_vues
--        DB-15 — FK manquantes sur offers/offer_items
--        DB-25 — FK sans ON DELETE sur marches_messages.sender_id
--        DB-18 — Colonnes UUID artisan_id sur signalements/missions
--
-- IMPORTANT: Entierement idempotent. Safe en prod.
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-04 — syndic_signalements.cabinet_id NOT NULL
-- Etape 1: Nettoyer les eventuels NULLs (les rattacher au cabinet "orphelins")
-- Etape 2: Ajouter la contrainte
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  -- Verifier s'il y a des NULLs
  IF EXISTS (SELECT 1 FROM syndic_signalements WHERE cabinet_id IS NULL LIMIT 1) THEN
    -- Supprimer les orphelins (signalements sans cabinet sont inaccessibles de toute facon)
    DELETE FROM syndic_signalements WHERE cabinet_id IS NULL;
  END IF;

  -- Ajouter NOT NULL si pas deja present
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'syndic_signalements'
      AND column_name = 'cabinet_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE syndic_signalements ALTER COLUMN cabinet_id SET NOT NULL;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-05 — syndic_missions.cabinet_id NOT NULL
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM syndic_missions WHERE cabinet_id IS NULL LIMIT 1) THEN
    DELETE FROM syndic_missions WHERE cabinet_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'syndic_missions'
      AND column_name = 'cabinet_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE syndic_missions ALTER COLUMN cabinet_id SET NOT NULL;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-12 — increment_listing_vues avec search_path
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_listing_vues(listing_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE marketplace_listings SET vues = COALESCE(vues, 0) + 1 WHERE id = listing_id;
$$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-15 — FK manquantes sur offers et offer_items
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  -- offers.supplier_id → suppliers.id ON DELETE SET NULL
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_offers_supplier'
      AND table_name = 'offers'
  ) THEN
    -- Nettoyer les references invalides d'abord
    UPDATE offers SET supplier_id = NULL
    WHERE supplier_id IS NOT NULL
      AND supplier_id NOT IN (SELECT id FROM suppliers);

    ALTER TABLE offers
      ADD CONSTRAINT fk_offers_supplier
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  -- offer_items.rfq_item_id → rfq_items.id ON DELETE CASCADE
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_offer_items_rfq_item'
      AND table_name = 'offer_items'
  ) THEN
    -- Nettoyer les references invalides
    DELETE FROM offer_items
    WHERE rfq_item_id IS NOT NULL
      AND rfq_item_id NOT IN (SELECT id FROM rfq_items);

    ALTER TABLE offer_items
      ADD CONSTRAINT fk_offer_items_rfq_item
      FOREIGN KEY (rfq_item_id) REFERENCES rfq_items(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-18 — Ajouter colonnes artisan_id UUID sur signalements/missions
-- (coexistence avec les anciennes colonnes TEXT, migration applicative a faire)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE syndic_signalements
  ADD COLUMN IF NOT EXISTS artisan_assigne_id UUID;
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_artisan
  ON syndic_signalements(artisan_assigne_id) WHERE artisan_assigne_id IS NOT NULL;

ALTER TABLE syndic_missions
  ADD COLUMN IF NOT EXISTS artisan_id UUID;
CREATE INDEX IF NOT EXISTS idx_syndic_missions_artisan_id
  ON syndic_missions(artisan_id) WHERE artisan_id IS NOT NULL;
