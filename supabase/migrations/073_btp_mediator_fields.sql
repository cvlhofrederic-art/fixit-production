-- ════════════════════════════════════════════════════════════════════════════
-- 073 — Médiateur conso BTP : nom + URL
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : la mention du médiateur de la consommation est obligatoire sur
-- les devis et factures depuis 2016. Ces champs étaient saisis à chaque
-- nouveau devis BTP. On les persiste pour qu'une saisie unique dans Mon
-- profil suffise pour tous les devis futurs (même mécanisme que les champs
-- légaux Kbis ajoutés en migration 072).
--
-- Les colonnes insurance_name / insurance_number / insurance_coverage /
-- insurance_type / insurance_expiry existent déjà depuis la baseline 052 ;
-- elles seront simplement exposées dans Mon profil sans migration nouvelle.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS mediator_name TEXT;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS mediator_url TEXT;

COMMENT ON COLUMN profiles_artisan.mediator_name IS 'Nom du médiateur de la consommation (obligatoire sur devis/factures B2C)';
COMMENT ON COLUMN profiles_artisan.mediator_url IS 'Site web du médiateur de la consommation';
