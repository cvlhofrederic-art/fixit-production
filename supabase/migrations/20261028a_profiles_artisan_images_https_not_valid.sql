-- 20261028a_profiles_artisan_images_https_not_valid.sql
-- Lot 3 de l'analyse Sentry du 28/10/2026 (issues V, W : fiche artisan de 3 Mo à cause d'une image en base64).
--
-- Plus aucune image en data: URL dans profiles_artisan : logo_url et profile_photo_url ne contiennent qu'une URL
-- https de Supabase Storage (bucket public profile-photos, écrite par /api/save-logo et /api/upload) ou NULL.
--
-- Ordre exact (migrations appliquées à la main) :
--   1. déploiement de la PR du lot 3 (/api/save-logo n'écrit plus de data: URL) ;
--   2. migration des données : `npx tsx scripts/migrer-images-artisans-storage.ts --appliquer` (simulation sans
--      drapeau d'abord, voir l'en-tête du script) ;
--   3. contrôle en lecture seule, qui doit renvoyer 0 :
--        select count(*) from public.profiles_artisan where logo_url like 'data:%' or profile_photo_url like 'data:%';
--      s'il reste des lignes (valeur laissée telle quelle par le script : format non pris en charge, échec d'envoi),
--      les traiter avant d'aller plus loin ;
--   4. ce fichier : garde-fou, puis contraintes ajoutées NOT VALID ;
--   5. 20261028b_profiles_artisan_images_https_validate.sql : validation des contraintes sur toutes les lignes.
--
-- Jamais avant le script : une contrainte CHECK, même NOT VALID, est vérifiée sur la nouvelle version de toute ligne
-- insérée ou mise à jour, quelles que soient les colonnes touchées (NOT VALID dispense seulement de vérifier les
-- lignes existantes au moment de l'ajout). Appliqué avant la migration des données, ce fichier ferait échouer toute
-- mise à jour d'une fiche encore en data: URL (réglages, last_seen_at du dashboard pro, KYC) et empêcherait le
-- script de migrer une fiche dont les deux colonnes sont en data: URL (il met à jour une colonne à la fois).
-- Le bloc DO lève donc une exception tant qu'il reste une data: URL ; le fichier étant une transaction explicite,
-- aucune contrainte n'est alors ajoutée, quel que soit l'outil (éditeur SQL Supabase, psql). Sur la base vide du
-- job CI « SQL Migrations — Validation », il ne trouve aucune ligne et laisse passer.
--
-- NOT VALID reste utile : l'ajout ne parcourt pas la table sous verrou exclusif ; 20261028b valide ensuite toutes
-- les lignes sans bloquer les écritures.
--
-- Comptage du 28/10/2026 (lecture seule) : 764 fiches, 3 logos et 2 photos en data: URL, aucune URL https.

BEGIN;

DO $garde$
DECLARE
  fiches_en_data_url bigint;
BEGIN
  SELECT count(*) INTO fiches_en_data_url
  FROM public.profiles_artisan
  WHERE logo_url LIKE 'data:%' OR profile_photo_url LIKE 'data:%';

  IF fiches_en_data_url > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Migration 20261028a refusée : ' || fiches_en_data_url || ' fiche(s) de profiles_artisan ont encore'
        || ' logo_url ou profile_photo_url en data: URL. Lancer d''abord'
        || ' npx tsx scripts/migrer-images-artisans-storage.ts --appliquer, vérifier que le comptage de contrôle'
        || ' renvoie 0, puis appliquer 20261028a et 20261028b.',
      HINT = 'Comptage de contrôle : select count(*) from public.profiles_artisan'
        || ' where logo_url like ''data:%'' or profile_photo_url like ''data:%''';
  END IF;
END
$garde$;

ALTER TABLE public.profiles_artisan
  ADD CONSTRAINT profiles_artisan_logo_url_sans_data_url
  CHECK (logo_url IS NULL OR logo_url NOT LIKE 'data:%') NOT VALID;

ALTER TABLE public.profiles_artisan
  ADD CONSTRAINT profiles_artisan_profile_photo_url_sans_data_url
  CHECK (profile_photo_url IS NULL OR profile_photo_url NOT LIKE 'data:%') NOT VALID;

COMMIT;
