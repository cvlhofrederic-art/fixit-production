-- ════════════════════════════════════════════════════════════════════════════
-- 069 — RLS cleanup : remplace les policies "always true" par des checks d'ownership
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : Supabase Security Advisor remontait 11 warnings "RLS Policy Always
-- True". L'audit pg_policies a confirmé que `artisan_absences`, `artisan_photos`
-- et `booking_messages` (writes) ont des policies entièrement ouvertes alors que
-- leurs accès sont sensibles (un user authentifié peut INSERT/UPDATE/DELETE pour
-- le compte d'un autre via l'anon key qui circule dans le bundle frontend).
--
-- Approche : la défense d'aujourd'hui = validation API (Bearer token + supabaseAdmin
-- service_role qui bypass la RLS). Cette migration ajoute la défense en profondeur :
-- même en bypass de l'API, l'anon key ne peut plus rien faire de cross-tenant.
--
-- Tables NON touchées (par design) :
--   • marches_insert / marches_messages_insert / evaluations_insert / syndic_signalements_insert
--     → soumissions externes via API avec access_token, le check d'ownership se fait
--       au niveau API. Le service_role bypass de toute façon, donc le `with check (true)`
--       ne pose pas de risque tant que les API n'utilisent pas l'anon key.
--
-- Idempotent (DROP IF EXISTS + CREATE).

-- ─── artisan_absences ──────────────────────────────────────────────────────
-- Avant : SELECT/INSERT/DELETE complètement ouverts. Risque cross-tenant.
DROP POLICY IF EXISTS abs_sel ON public.artisan_absences;
DROP POLICY IF EXISTS abs_ins ON public.artisan_absences;
DROP POLICY IF EXISTS abs_del ON public.artisan_absences;

CREATE POLICY artisan_absences_owner_select ON public.artisan_absences
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

CREATE POLICY artisan_absences_owner_insert ON public.artisan_absences
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

CREATE POLICY artisan_absences_owner_update ON public.artisan_absences
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

CREATE POLICY artisan_absences_owner_delete ON public.artisan_absences
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

-- ─── artisan_photos ────────────────────────────────────────────────────────
-- SELECT public conservé (portfolio public). Writes : ownership requis.
DROP POLICY IF EXISTS artisan_photos_insert ON public.artisan_photos;
DROP POLICY IF EXISTS artisan_photos_update ON public.artisan_photos;
DROP POLICY IF EXISTS artisan_photos_delete ON public.artisan_photos;
-- artisan_photos_select intact (using true = lecture publique du portfolio)

CREATE POLICY artisan_photos_owner_insert ON public.artisan_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

CREATE POLICY artisan_photos_owner_update ON public.artisan_photos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

CREATE POLICY artisan_photos_owner_delete ON public.artisan_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles_artisan p WHERE p.id = artisan_id AND p.user_id = auth.uid())
  );

-- ─── booking_messages ──────────────────────────────────────────────────────
-- SELECT déjà OK (booking_messages_select check ownership client OR artisan).
-- INSERT/UPDATE actuellement open → on applique la même logique que SELECT.
DROP POLICY IF EXISTS booking_messages_insert ON public.booking_messages;
DROP POLICY IF EXISTS booking_messages_update ON public.booking_messages;

CREATE POLICY booking_messages_owner_insert ON public.booking_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_messages.booking_id
        AND b.deleted_at IS NULL
        AND (
          b.client_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles_artisan pa WHERE pa.id = b.artisan_id AND pa.user_id = auth.uid())
        )
    )
  );

CREATE POLICY booking_messages_owner_update ON public.booking_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_messages.booking_id
        AND b.deleted_at IS NULL
        AND (
          b.client_id = auth.uid()
          OR EXISTS (SELECT 1 FROM public.profiles_artisan pa WHERE pa.id = b.artisan_id AND pa.user_id = auth.uid())
        )
    )
  );
