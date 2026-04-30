-- ════════════════════════════════════════════════════════════════════════════
-- 070 — REVOKE EXECUTE sur les fonctions SECURITY DEFINER ouvertes au PUBLIC
-- ════════════════════════════════════════════════════════════════════════════
-- Contexte : Supabase Security Advisor remontait 18 warnings (9 fonctions × 2
-- lints "Public/Signed-In Users Can Execute SECURITY DEFINER Function"). Ces
-- fonctions tournent avec les privilèges de leur owner (souvent superuser/postgres),
-- donc les laisser exécutables par tout le monde = chemin d'escalade de privilèges
-- ou de bypass RLS.
--
-- Stratégie : pour chaque fonction, on REVOKE FROM public, authenticated puis
-- on GRANT explicitement à l'audience qui en a réellement besoin.
--
-- Audit côté code (résultats agent Explore) :
--   • delete_user_data, export_user_data : RGPD, jamais appelées depuis l'app.
--     → service_role uniquement.
--   • haversine_distance : utilisée seulement par search_artisans_nearby().
--     → service_role uniquement (le caller est lui-même SECURITY DEFINER).
--   • increment_listing_vues : appelée depuis app/api/marketplace-btp/[id]/route.ts
--     (server-side avec supabaseAdmin). → service_role uniquement.
--   • pt_fiscal_next_seq, pt_fiscal_previous_hash : déjà OK (REVOKE public en 043).
--     On re-pose pour idempotence + retire authenticated qui n'a pas besoin direct.
--   • sync_user_role_to_app_metadata : trigger, pas appelée RPC. → no GRANT needed.
--   • update_conversation_on_message : trigger, pareil.
--   • update_team_updated_at : trigger, pareil.
--
-- Idempotent.

-- ─── Fonctions GDPR / fiscales / privilèges → service_role only ─────────────
REVOKE EXECUTE ON FUNCTION public.delete_user_data(p_user_id uuid)         FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.delete_user_data(p_user_id uuid)         TO service_role;

REVOKE EXECUTE ON FUNCTION public.export_user_data(p_user_id uuid)         FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.export_user_data(p_user_id uuid)         TO service_role;

REVOKE EXECUTE ON FUNCTION public.haversine_distance(double precision, double precision, double precision, double precision) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.haversine_distance(double precision, double precision, double precision, double precision) TO service_role;

REVOKE EXECUTE ON FUNCTION public.increment_listing_vues(listing_id uuid)  FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.increment_listing_vues(listing_id uuid)  TO service_role;

REVOKE EXECUTE ON FUNCTION public.pt_fiscal_next_seq(p_series_id uuid)     FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.pt_fiscal_next_seq(p_series_id uuid)     TO service_role;

REVOKE EXECUTE ON FUNCTION public.pt_fiscal_previous_hash(p_series_id uuid) FROM PUBLIC, authenticated, anon;
GRANT  EXECUTE ON FUNCTION public.pt_fiscal_previous_hash(p_series_id uuid) TO service_role;

-- ─── Fonctions trigger uniquement (jamais appelées en RPC) ─────────────────
-- Les triggers exécutent sous l'owner de la fonction, le GRANT EXECUTE n'a pas
-- d'effet sur leur déclenchement. On REVOKE par hygiène pour empêcher les RPC
-- accidentels.
REVOKE EXECUTE ON FUNCTION public.sync_user_role_to_app_metadata()         FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_conversation_on_message()         FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.update_team_updated_at()                 FROM PUBLIC, authenticated, anon;
