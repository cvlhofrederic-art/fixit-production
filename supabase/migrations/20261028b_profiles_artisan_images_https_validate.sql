-- 20261028b_profiles_artisan_images_https_validate.sql
-- Lot 3 de l'analyse Sentry du 28/10/2026 — étape B, à lancer APRÈS la migration des données
-- (`npx tsx scripts/migrer-images-artisans-storage.ts --appliquer`, puis contrôle :
--   select count(*) from public.profiles_artisan where logo_url like 'data:%' or profile_photo_url like 'data:%';
-- doit renvoyer 0).
--
-- VALIDATE CONSTRAINT parcourt toutes les lignes sans bloquer les écritures ; il échoue s'il reste une data: URL.

ALTER TABLE public.profiles_artisan VALIDATE CONSTRAINT profiles_artisan_logo_url_sans_data_url;
ALTER TABLE public.profiles_artisan VALIDATE CONSTRAINT profiles_artisan_profile_photo_url_sans_data_url;
