-- ═══════════════════════════════════════════════════════════════════
-- 059 — Zones d'intervention (régions / départements / villes) + langue
-- ═══════════════════════════════════════════════════════════════════
-- Le nouveau sélecteur de zones (SettingsSection → ZonesInterventionCard)
-- écrivait uniquement en localStorage. Conséquence : les zones n'étaient
-- jamais visibles sur la fiche artisan publique, et la page publique
-- continuait d'afficher « rayon 30 km » par défaut.
--
-- Cette migration :
--   1. Ajoute profiles_artisan.intervention_zones (jsonb) pour persister
--      le nouveau modèle { regions: [], departments: [], cities: [] }.
--   2. Ajoute profiles_artisan.language (text) pour fiabiliser la
--      segmentation FR vs PT côté recherche client.
--   3. Ajoute profiles_artisan.legal_form (text) — utilisé par le code
--      (API artisan-company, WalletConformite, MateriauxSection) mais
--      jamais formellement déclaré dans une migration baseline. CREATE
--      IF NOT EXISTS le rend idempotent si déjà présent.
--   4. Backfill language depuis country (FR→fr, PT→pt) pour les
--      artisans existants.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS intervention_zones JSONB DEFAULT '{"regions": [], "departments": [], "cities": []}'::jsonb;

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS language TEXT;

ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS legal_form TEXT;

-- Backfill language depuis country pour les artisans existants
UPDATE profiles_artisan
  SET language = CASE
    WHEN country = 'PT' THEN 'pt'
    WHEN country = 'FR' THEN 'fr'
    ELSE LOWER(COALESCE(country, 'fr'))
  END
  WHERE language IS NULL;

-- Index sur language pour accélérer les filtres dans la recherche artisan
CREATE INDEX IF NOT EXISTS idx_artisan_language ON profiles_artisan(language);

-- Contrainte : valeurs autorisées (fr, pt, en) + tolérance NULL pour compat
ALTER TABLE profiles_artisan
  DROP CONSTRAINT IF EXISTS profiles_artisan_language_check;
ALTER TABLE profiles_artisan
  ADD CONSTRAINT profiles_artisan_language_check
  CHECK (language IS NULL OR language IN ('fr', 'pt', 'en'));

COMMENT ON COLUMN profiles_artisan.intervention_zones IS
  'Zones d''intervention granulaires : { regions: string[], departments: string[], cities: string[] }. Remplace progressivement zone_radius_km.';
COMMENT ON COLUMN profiles_artisan.language IS
  'Langue principale de l''artisan (fr/pt/en). Utilisé pour segmenter les recherches client côté FR et PT.';
COMMENT ON COLUMN profiles_artisan.legal_form IS
  'Forme juridique (SARL, SAS, SASU, EURL, SA, EI, auto-entrepreneur). Détermine si l''entité est une société ou un artisan individuel.';
