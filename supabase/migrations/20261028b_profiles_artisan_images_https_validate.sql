-- 20261028b_profiles_artisan_images_https_validate.sql
-- Lot 3 de l'analyse Sentry du 28/10/2026 — dernière étape. Ordre exact (détaillé dans l'en-tête de 20261028a) :
--   1. déploiement de la PR du lot 3 ;
--   2. migration des données : `npx tsx scripts/migrer-images-artisans-storage.ts --appliquer` ;
--   3. contrôle en lecture seule, qui doit renvoyer 0 :
--        select count(*) from public.profiles_artisan where logo_url like 'data:%' or profile_photo_url like 'data:%';
--   4. 20261028a_profiles_artisan_images_https_not_valid.sql (garde-fou, puis contraintes NOT VALID) ;
--   5. ce fichier.
--
-- VALIDATE CONSTRAINT parcourt toutes les lignes sans bloquer les écritures ; il échoue s'il reste une data: URL.

ALTER TABLE public.profiles_artisan VALIDATE CONSTRAINT profiles_artisan_logo_url_sans_data_url;
ALTER TABLE public.profiles_artisan VALIDATE CONSTRAINT profiles_artisan_profile_photo_url_sans_data_url;
