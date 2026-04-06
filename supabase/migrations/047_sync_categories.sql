-- ── 047: Sync categories table with lib/categories.ts ──────────────────────
-- Removes duplicates (jardinage, paysagiste) and ensures all 28 categories
-- exist with correct slugs, icons, and display order.
-- Run via: Supabase Dashboard > SQL Editor, or POST /api/admin/sync-categories

-- Add display_order column if missing
ALTER TABLE categories ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 99;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;

-- Deactivate deprecated categories (jardinage = doublon espaces-verts, paysagiste idem)
UPDATE categories SET active = false WHERE slug IN ('jardinage', 'paysagiste');

-- Upsert all 28 active categories
INSERT INTO categories (name, slug, icon, active, display_order, featured) VALUES
  ('Plomberie',              'plomberie',            '🔧', true,  1,  true),
  ('Électricité',            'electricite',          '⚡', true,  2,  true),
  ('Serrurerie',             'serrurerie',           '🔑', true,  3,  true),
  ('Chauffage',              'chauffage',            '🔥', true,  4,  true),
  ('Peinture',               'peinture',             '🎨', true,  5,  true),
  ('Maçonnerie',             'maconnerie',           '🧱', true,  6,  true),
  ('Menuiserie',             'menuiserie',           '🪚', true,  7,  true),
  ('Toiture',                'toiture',              '🏚️', true,  8,  true),
  ('Climatisation',          'climatisation',        '❄️', true,  10, false),
  ('Déménagement',           'demenagement',         '🚚', true,  11, false),
  ('Rénovation',             'renovation',           '🏡', true,  12, false),
  ('Vitrerie',               'vitrerie',             '🪟', true,  13, false),
  ('Petits travaux',         'petits-travaux',       '🛠️', true,  14, false),
  ('Espaces verts',          'espaces-verts',        '🌳', true,  15, false),
  ('Nettoyage',              'nettoyage',            '🧹', true,  16, false),
  ('Traitement nuisibles',   'traitement-nuisibles', '🐛', true,  17, false),
  ('Aménagement extérieur',  'amenagement-exterieur','🏡', true,  18, false),
  ('Carrelage',              'carrelage',            '🧱', true,  19, false),
  ('Diagnostic',             'diagnostic',           '🔍', true,  20, false),
  ('Nettoyage après travaux','nettoyage-travaux',    '🧹', true,  21, false),
  ('Nettoyage copropriété',  'nettoyage-copro',      '🏢', true,  22, false),
  ('Nettoyage industriel',   'nettoyage-industriel', '🏭', true,  23, false),
  ('Plaquiste',              'plaquiste',            '🔳', true,  24, false),
  ('Pisciniste',             'piscine',              '🏊', true,  25, false),
  ('Ramoneur',               'ramonage',             '🔥', true,  26, false),
  ('Store Banne & Pergola',  'store-banne',          '☀️', true,  27, false),
  ('Débouchage',             'debouchage',           '🚿', true,  28, false),
  ('Métallerie / Ferronnerie','metallerie',          '⚙️', true,  29, false)
ON CONFLICT (slug) DO UPDATE SET
  name          = EXCLUDED.name,
  icon          = EXCLUDED.icon,
  active        = EXCLUDED.active,
  display_order = EXCLUDED.display_order,
  featured      = EXCLUDED.featured;

-- Migrate artisan profiles that reference deprecated slugs
UPDATE profiles_artisan
SET categories = array_replace(categories, 'jardinage', 'espaces-verts')
WHERE 'jardinage' = ANY(categories);

UPDATE profiles_artisan
SET categories = array_replace(categories, 'paysagiste', 'espaces-verts')
WHERE 'paysagiste' = ANY(categories);

-- Remove duplicates from categories arrays after migration
UPDATE profiles_artisan
SET categories = (SELECT ARRAY(SELECT DISTINCT unnest(categories)))
WHERE 'espaces-verts' = ANY(categories);
