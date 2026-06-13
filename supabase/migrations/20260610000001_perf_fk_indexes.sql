-- =============================================================================
-- Migration perf : index FK manquants (tables actives) + suppression doublons
-- Date : 2026-06-10
-- Source : Supabase advisors (performance) — lints unindexed_foreign_keys
--          et duplicate_index.
-- Périmètre : tables ACTIVES uniquement (Client / Artisan / BTP Pro).
--             20 lints FK sur tables dormantes (syndic_*) volontairement exclus.
-- Doublons : définitions vérifiées identiques via pg_indexes avant DROP.
-- =============================================================================

-- 1) Index couvrants pour les FK non indexées (18) -----------------------------

CREATE INDEX IF NOT EXISTS idx_bookings_service_id ON public.bookings(service_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_sender_id ON public.conversation_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_devis_cancelled_by_user_id ON public.devis(cancelled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_equipe_membres_btp_membre_id ON public.equipe_membres_btp(membre_id);
CREATE INDEX IF NOT EXISTS idx_equipes_btp_chantier_id ON public.equipes_btp(chantier_id);
CREATE INDEX IF NOT EXISTS idx_factures_cancelled_by_user_id ON public.factures(cancelled_by_user_id);
CREATE INDEX IF NOT EXISTS idx_marches_parent_marche_id ON public.marches(parent_marche_id);
CREATE INDEX IF NOT EXISTS idx_marches_publisher_user_id ON public.marches(publisher_user_id);
CREATE INDEX IF NOT EXISTS idx_photos_artisan_id ON public.photos(artisan_id);
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_referral_parrain_id ON public.profiles_artisan(referral_parrain_id);
-- Collision de nom détectée à la vérification : un index nommé
-- idx_profiles_client_user_id existait DÉJÀ mais sur la colonne `id` (nom
-- trompeur, doublon exact de profiles_client_pkey). On le supprime (sans
-- risque : la pkey couvre `id`) avant de créer le vrai index sur user_id.
DROP INDEX IF EXISTS public.idx_profiles_client_user_id;
CREATE INDEX IF NOT EXISTS idx_profiles_client_user_id ON public.profiles_client(user_id);
CREATE INDEX IF NOT EXISTS idx_ref_taux_updated_by ON public.ref_taux(updated_by);
CREATE INDEX IF NOT EXISTS idx_ref_taux_audit_modifie_par ON public.ref_taux_audit(modifie_par);
CREATE INDEX IF NOT EXISTS idx_ref_taux_audit_ref_taux_id ON public.ref_taux_audit(ref_taux_id);
CREATE INDEX IF NOT EXISTS idx_reviews_artisan_id ON public.reviews(artisan_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON public.reviews(booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client_id ON public.reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_services_category_id ON public.services(category_id);

-- 2) Suppression des index dupliqués (définitions strictement identiques) ------
-- bookings : idx_bookings_client == idx_bookings_client_id (btree client_id)
--   → on conserve idx_bookings_client_id (convention idx_<table>_<colonne>)
DROP INDEX IF EXISTS public.idx_bookings_client;

-- profiles_artisan : idx_profiles_artisan_user == idx_profiles_artisan_user_id (btree user_id)
--   → on conserve idx_profiles_artisan_user_id
DROP INDEX IF EXISTS public.idx_profiles_artisan_user;
