-- ════════════════════════════════════════════════════════════════════════════
-- 072 — Champs légaux BTP : RCS/RM, APE/NAF, Capital social, TVA intra
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : la modale Devis BTP affichait ces 4 champs vides à chaque création
-- car ils étaient lus uniquement depuis localStorage. On les persiste en DB
-- pour qu'une saisie unique dans Mon profil suffise pour tous les devis futurs.
--
-- Ces champs sont normalement extractibles du Kbis (PDF B). À ce stade ils sont
-- saisis manuellement par l'utilisateur dans son profil ; un futur extracteur
-- OCR pourra les remplir automatiquement (hors scope de cette migration).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS rcs_number TEXT;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS ape_code TEXT;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS share_capital TEXT;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS tva_intra TEXT;

COMMENT ON COLUMN profiles_artisan.rcs_number IS 'Numéro RCS / RM (issu du Kbis) — affiché sur devis et factures BTP';
COMMENT ON COLUMN profiles_artisan.ape_code IS 'Code APE / NAF — affiché sur devis et factures BTP';
COMMENT ON COLUMN profiles_artisan.share_capital IS 'Capital social en euros (texte, ex: "10 000")';
COMMENT ON COLUMN profiles_artisan.tva_intra IS 'Numéro de TVA intracommunautaire (ex: FR12345678901)';
