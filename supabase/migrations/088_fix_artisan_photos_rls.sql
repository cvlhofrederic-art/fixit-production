-- F06: Fix overly permissive artisan-photos insert policy
-- Restrict inserts so users can only upload to their own folder
DROP POLICY IF EXISTS "artisan_photos_insert" ON storage.objects;
CREATE POLICY "artisan_photos_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'artisan-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
