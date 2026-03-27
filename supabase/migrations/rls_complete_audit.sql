-- ============================================================================
-- MIGRATION: RLS Complete Audit — Defense-in-depth for ALL tables
-- Date: 2026-03-08
-- Description: Ensures every public table has RLS enabled with appropriate
--              policies. Even though API routes use service_role (bypasses RLS),
--              this prevents data leaks if the anon key is ever exposed.
--
-- IMPORTANT: Fully idempotent. Safe to run multiple times.
--            Execute in: Supabase Dashboard > SQL Editor
-- ============================================================================


-- ── 1. profiles_artisan — Public read, owner write ──────────────────────────
ALTER TABLE profiles_artisan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_artisan_public_read" ON profiles_artisan;
CREATE POLICY "profiles_artisan_public_read" ON profiles_artisan FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "profiles_artisan_owner_read" ON profiles_artisan;
CREATE POLICY "profiles_artisan_owner_read" ON profiles_artisan FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_artisan_owner_update" ON profiles_artisan;
CREATE POLICY "profiles_artisan_owner_update" ON profiles_artisan FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profiles_artisan_owner_insert" ON profiles_artisan;
CREATE POLICY "profiles_artisan_owner_insert" ON profiles_artisan FOR INSERT
  WITH CHECK (user_id = auth.uid());


-- ── 2. profiles_client — Owner access only ──────────────────────────────────
ALTER TABLE profiles_client ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_client_owner" ON profiles_client;
CREATE POLICY "profiles_client_owner" ON profiles_client
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());


-- ── 3. bookings — Client or artisan (via profiles_artisan) ──────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bookings_participant_read" ON bookings;
CREATE POLICY "bookings_participant_read" ON bookings FOR SELECT
  USING (
    (deleted_at IS NULL)
    AND (
      client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles_artisan pa
        WHERE pa.id = bookings.artisan_id AND pa.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "bookings_client_insert" ON bookings;
CREATE POLICY "bookings_client_insert" ON bookings FOR INSERT
  WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "bookings_participant_update" ON bookings;
CREATE POLICY "bookings_participant_update" ON bookings FOR UPDATE
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = bookings.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 4. services — Public read, artisan owner write ──────────────────────────
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services_public_read" ON services;
CREATE POLICY "services_public_read" ON services FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "services_owner_read" ON services;
CREATE POLICY "services_owner_read" ON services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = services.artisan_id AND pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "services_owner_write" ON services;
CREATE POLICY "services_owner_write" ON services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = services.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 5. categories — Public read only ────────────────────────────────────────
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT
  USING (active = true);


-- ── 6. availability — Public read (for booking UX), artisan owner write ─────
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "availability_public_read" ON availability;
CREATE POLICY "availability_public_read" ON availability FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "availability_owner_write" ON availability;
CREATE POLICY "availability_owner_write" ON availability FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = availability.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 7. artisan_notifications — Owner only ───────────────────────────────────
ALTER TABLE artisan_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artisan_notifications_owner" ON artisan_notifications;
CREATE POLICY "artisan_notifications_owner" ON artisan_notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = artisan_notifications.artisan_id AND pa.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "artisan_notifications_owner_update" ON artisan_notifications;
CREATE POLICY "artisan_notifications_owner_update" ON artisan_notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = artisan_notifications.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 8. artisan_absences — Owner only ────────────────────────────────────────
ALTER TABLE artisan_absences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artisan_absences_owner" ON artisan_absences;
CREATE POLICY "artisan_absences_owner" ON artisan_absences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = artisan_absences.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 9. artisan_photos — Public read, owner write ────────────────────────────
ALTER TABLE artisan_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "artisan_photos_public_read" ON artisan_photos;
CREATE POLICY "artisan_photos_public_read" ON artisan_photos FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "artisan_photos_owner_write" ON artisan_photos;
CREATE POLICY "artisan_photos_owner_write" ON artisan_photos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = artisan_photos.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 10. syndic_artisans — Cabinet access ────────────────────────────────────
ALTER TABLE syndic_artisans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_artisans_cabinet" ON syndic_artisans;
CREATE POLICY "syndic_artisans_cabinet" ON syndic_artisans FOR ALL
  USING (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_artisans.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );


-- ── 11. syndic_immeubles — Cabinet access ───────────────────────────────────
ALTER TABLE syndic_immeubles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_immeubles_cabinet" ON syndic_immeubles;
CREATE POLICY "syndic_immeubles_cabinet" ON syndic_immeubles FOR ALL
  USING (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_immeubles.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );


-- ── 12. syndic_team_members — Cabinet admin or self ─────────────────────────
ALTER TABLE syndic_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_team_cabinet_read" ON syndic_team_members;
CREATE POLICY "syndic_team_cabinet_read" ON syndic_team_members FOR SELECT
  USING (
    cabinet_id = auth.uid()
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "syndic_team_cabinet_write" ON syndic_team_members;
CREATE POLICY "syndic_team_cabinet_write" ON syndic_team_members FOR ALL
  USING (cabinet_id = auth.uid());


-- ── 13. syndic_messages — Participant access ────────────────────────────────
ALTER TABLE syndic_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_messages_participant" ON syndic_messages;
CREATE POLICY "syndic_messages_participant" ON syndic_messages FOR SELECT
  USING (
    cabinet_id = auth.uid()
    OR artisan_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_messages.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );


-- ── 14. syndic_planning_events — Cabinet access ─────────────────────────────
ALTER TABLE syndic_planning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_planning_cabinet" ON syndic_planning_events;
CREATE POLICY "syndic_planning_cabinet" ON syndic_planning_events FOR ALL
  USING (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_planning_events.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );


-- ── 15. syndic_notifications — Owner only ───────────────────────────────────
ALTER TABLE syndic_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_notifications_owner" ON syndic_notifications;
CREATE POLICY "syndic_notifications_owner" ON syndic_notifications FOR SELECT
  USING (syndic_id = auth.uid());

DROP POLICY IF EXISTS "syndic_notifications_owner_update" ON syndic_notifications;
CREATE POLICY "syndic_notifications_owner_update" ON syndic_notifications FOR UPDATE
  USING (syndic_id = auth.uid());


-- ── 16. syndic_emails_analysed — Owner only ─────────────────────────────────
ALTER TABLE syndic_emails_analysed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_emails_owner" ON syndic_emails_analysed;
CREATE POLICY "syndic_emails_owner" ON syndic_emails_analysed FOR ALL
  USING (syndic_id = auth.uid());


-- ── 17. syndic_oauth_tokens — Owner only (sensitive!) ───────────────────────
ALTER TABLE syndic_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "syndic_oauth_owner" ON syndic_oauth_tokens;
CREATE POLICY "syndic_oauth_owner" ON syndic_oauth_tokens FOR ALL
  USING (syndic_id = auth.uid());


-- ── 18. pt_fiscal_series — Artisan owner ────────────────────────────────────
ALTER TABLE pt_fiscal_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_fiscal_series_owner" ON pt_fiscal_series;
CREATE POLICY "pt_fiscal_series_owner" ON pt_fiscal_series FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = pt_fiscal_series.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 19. pt_fiscal_documents — Artisan owner ─────────────────────────────────
ALTER TABLE pt_fiscal_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pt_fiscal_documents_owner" ON pt_fiscal_documents;
CREATE POLICY "pt_fiscal_documents_owner" ON pt_fiscal_documents FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles_artisan pa
      WHERE pa.id = pt_fiscal_documents.artisan_id AND pa.user_id = auth.uid()
    )
  );


-- ── 20. idempotency_keys — Service role only (no direct client access) ──────
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
-- No policies = blocked for anon/authenticated. Only service_role can access.


-- ── 21. tracking_sessions — Participant access ──────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tracking_sessions' AND table_schema = 'public') THEN
    ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tracking_sessions_participant" ON tracking_sessions;
    CREATE POLICY "tracking_sessions_participant" ON tracking_sessions FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.id = tracking_sessions.booking_id
          AND (
            b.client_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM profiles_artisan pa
              WHERE pa.id = b.artisan_id AND pa.user_id = auth.uid()
            )
          )
        )
      );
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION: Run this query to confirm ALL tables have RLS enabled:
--
-- SELECT tablename,
--        rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY tablename;
--
-- All rows should show rowsecurity = true
-- ═══════════════════════════════════════════════════════════════════════════
