-- 20261028a_profiles_artisan_images_https_not_valid.sql
-- Lot 3 de l'analyse Sentry du 28/10/2026 (issues V, W : fiche artisan de 3 Mo à cause d'une image en base64).
--
-- Plus aucune image en data: URL dans profiles_artisan : logo_url et profile_photo_url ne contiennent qu'une URL
-- https de Supabase Storage (bucket public profile-photos, écrite par /api/save-logo et /api/upload) ou NULL.
--
-- Étape A (ce fichier) : contraintes ajoutées NOT VALID. Elles s'appliquent aux nouvelles écritures seulement ;
-- les lignes existantes ne sont pas évaluées, le fichier peut donc être appliqué avant la migration des données.
-- Étape B (20261028b_…_validate.sql) : après `npx tsx scripts/migrer-images-artisans-storage.ts --appliquer`,
-- validation des contraintes sur toutes les lignes (échoue s'il reste une data: URL).
--
-- Comptage du 28/10/2026 (lecture seule) : 764 fiches, 3 logos et 2 photos en data: URL, aucune URL https.

ALTER TABLE public.profiles_artisan
  ADD CONSTRAINT profiles_artisan_logo_url_sans_data_url
  CHECK (logo_url IS NULL OR logo_url NOT LIKE 'data:%') NOT VALID;

ALTER TABLE public.profiles_artisan
  ADD CONSTRAINT profiles_artisan_profile_photo_url_sans_data_url
  CHECK (profile_photo_url IS NULL OR profile_photo_url NOT LIKE 'data:%') NOT VALID;
