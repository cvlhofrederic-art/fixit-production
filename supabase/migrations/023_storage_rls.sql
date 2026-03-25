-- ── Storage RLS Policies ──────────────────────────────────────────────────────
-- Sécurise les 3 buckets Storage avec des policies RLS.
-- Les API routes utilisent supabaseAdmin (service_role) et bypassent ces policies,
-- mais elles protègent contre tout accès direct client-side non autorisé.

-- ── 1. Bucket profile-photos ──────────────────────────────────────────────────
-- Photos de profil artisan : lecture publique (profils actifs), écriture propriétaire

DROP POLICY IF EXISTS "profile_photos_select" ON storage.objects;
CREATE POLICY "profile_photos_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_insert" ON storage.objects;
CREATE POLICY "profile_photos_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile_photos_delete" ON storage.objects;
CREATE POLICY "profile_photos_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 2. Bucket artisan-documents ───────────────────────────────────────────────
-- Documents sensibles (assurance, KBIS) : accès propriétaire uniquement

DROP POLICY IF EXISTS "artisan_docs_select" ON storage.objects;
CREATE POLICY "artisan_docs_select" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'artisan-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "artisan_docs_insert" ON storage.objects;
CREATE POLICY "artisan_docs_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'artisan-documents'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "artisan_docs_delete" ON storage.objects;
CREATE POLICY "artisan_docs_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'artisan-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── 3. Bucket artisan-photos ──────────────────────────────────────────────────
-- Photos de chantier / portfolio : lecture publique, écriture propriétaire

DROP POLICY IF EXISTS "artisan_photos_select" ON storage.objects;
CREATE POLICY "artisan_photos_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'artisan-photos');

DROP POLICY IF EXISTS "artisan_photos_insert" ON storage.objects;
CREATE POLICY "artisan_photos_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'artisan-photos'
    AND auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "artisan_photos_delete" ON storage.objects;
CREATE POLICY "artisan_photos_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'artisan-photos'
    AND auth.uid() IS NOT NULL
  );
