-- Migration 024: Add missing foreign keys
-- Audit finding: 3 FK manquantes identifiées

-- 1. syndic_signalements.cabinet_id → syndic_cabinets.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_syndic_signalements_cabinet'
  ) THEN
    ALTER TABLE syndic_signalements
      ADD CONSTRAINT fk_syndic_signalements_cabinet
      FOREIGN KEY (cabinet_id) REFERENCES syndic_cabinets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. syndic_missions.cabinet_id → syndic_cabinets.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_syndic_missions_cabinet'
  ) THEN
    ALTER TABLE syndic_missions
      ADD CONSTRAINT fk_syndic_missions_cabinet
      FOREIGN KEY (cabinet_id) REFERENCES syndic_cabinets(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. marches_candidatures.artisan_id → profiles_artisan.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_marches_candidatures_artisan'
  ) THEN
    ALTER TABLE marches_candidatures
      ADD CONSTRAINT fk_marches_candidatures_artisan
      FOREIGN KEY (artisan_id) REFERENCES profiles_artisan(id) ON DELETE CASCADE;
  END IF;
END $$;
