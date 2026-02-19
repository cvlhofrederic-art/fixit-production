-- ============================================================
-- MIGRATION : Colonnes upload + Buckets Supabase Storage
-- À exécuter dans l'éditeur SQL de Supabase
-- ============================================================

-- 1. Ajouter les colonnes documents au profil artisan
ALTER TABLE profiles_artisan
  ADD COLUMN IF NOT EXISTS insurance_url TEXT,
  ADD COLUMN IF NOT EXISTS kbis_url TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- 2. Créer les buckets Storage (public)
-- Bucket photos de profil (artisans + clients)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  10485760, -- 10 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Bucket documents artisans (assurance, kbis)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'artisan-documents',
  'artisan-documents',
  true,
  10485760, -- 10 Mo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies Storage — accès public en lecture
CREATE POLICY "Public read profile-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

CREATE POLICY "Public read artisan-documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'artisan-documents');

-- Upload autorisé via service_role (notre API route utilise supabaseAdmin)
-- Aucune policy INSERT/UPDATE/DELETE nécessaire côté client car on passe par l'API route

-- 4. Vérification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'profiles_artisan'
  AND column_name IN ('insurance_url', 'kbis_url', 'profile_photo_url');
