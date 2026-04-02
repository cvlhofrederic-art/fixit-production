-- ============================================================================
-- MIGRATION: RLS Policies for Storage Buckets
-- Date: 2026-04-02
-- Description: Adds RLS policies on storage.objects for all 5 buckets.
--              Prevents unauthorized access if anon key is exposed.
--              API routes use service_role (bypasses RLS) so this is defense-in-depth.
--
-- IMPORTANT: Fully idempotent. Safe to run multiple times.
--            Execute in: Supabase Dashboard > SQL Editor
-- ============================================================================

-- ── 1. artisan-documents — Owner read/write, no public access ────────────────
DROP POLICY IF EXISTS "artisan_documents_owner_select" ON storage.objects;
CREATE POLICY "artisan_documents_owner_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'artisan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "artisan_documents_owner_insert" ON storage.objects;
CREATE POLICY "artisan_documents_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artisan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "artisan_documents_owner_delete" ON storage.objects;
CREATE POLICY "artisan_documents_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'artisan-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 2. profile-photos — Owner write, public read for active profiles ─────────
DROP POLICY IF EXISTS "profile_photos_public_read" ON storage.objects;
CREATE POLICY "profile_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

DROP POLICY IF EXISTS "profile_photos_owner_insert" ON storage.objects;
CREATE POLICY "profile_photos_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "profile_photos_owner_delete" ON storage.objects;
CREATE POLICY "profile_photos_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'profile-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 3. artisan-photos — Owner write, public read (portfolio/chantier photos) ─
DROP POLICY IF EXISTS "artisan_photos_public_read" ON storage.objects;
CREATE POLICY "artisan_photos_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'artisan-photos');

DROP POLICY IF EXISTS "artisan_photos_owner_insert" ON storage.objects;
CREATE POLICY "artisan_photos_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'artisan-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "artisan_photos_owner_delete" ON storage.objects;
CREATE POLICY "artisan_photos_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'artisan-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 4. mission-reports — Owner (syndic) read/write ───────────────────────────
DROP POLICY IF EXISTS "mission_reports_owner_select" ON storage.objects;
CREATE POLICY "mission_reports_owner_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'mission-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "mission_reports_owner_insert" ON storage.objects;
CREATE POLICY "mission_reports_owner_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'mission-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "mission_reports_owner_delete" ON storage.objects;
CREATE POLICY "mission_reports_owner_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'mission-reports' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 5. tracking — No anon access (server-only bucket) ───────────────────────
DROP POLICY IF EXISTS "tracking_deny_all" ON storage.objects;
CREATE POLICY "tracking_deny_all" ON storage.objects FOR SELECT
  USING (bucket_id = 'tracking' AND false);
