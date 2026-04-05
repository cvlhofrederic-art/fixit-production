-- Performance indexes identified during Phase 10 benchmarking audit
-- These indexes optimize high-traffic queries and RLS policy evaluation

-- Syndic signalements: dashboard filtering by status and chronological listing
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_cabinet_statut
  ON syndic_signalements(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_cabinet_created
  ON syndic_signalements(cabinet_id, created_at DESC);

-- Syndic missions: dashboard filtering and listing
CREATE INDEX IF NOT EXISTS idx_syndic_missions_cabinet_statut
  ON syndic_missions(cabinet_id, statut);
CREATE INDEX IF NOT EXISTS idx_syndic_missions_cabinet_created
  ON syndic_missions(cabinet_id, created_at DESC);

-- Syndic immeubles: dashboard listing
CREATE INDEX IF NOT EXISTS idx_syndic_immeubles_cabinet_created
  ON syndic_immeubles(cabinet_id, created_at DESC);

-- Syndic signalement messages: threaded message ordering
CREATE INDEX IF NOT EXISTS idx_syndic_signalement_messages_thread
  ON syndic_signalement_messages(signalement_id, created_at DESC);

-- Syndic team members: RLS policy optimization (used in 15+ policies)
CREATE INDEX IF NOT EXISTS idx_syndic_team_members_lookup
  ON syndic_team_members(cabinet_id, user_id, is_active);

-- Bookings: artisan dashboard filtering
-- NOTE: idx_bookings_artisan_date already exists in 039_fix_security_audit.sql
--       as (artisan_id, booking_date) without DESC. Skipping to avoid confusion.
CREATE INDEX IF NOT EXISTS idx_bookings_status_artisan
  ON bookings(status, artisan_id);

-- Profiles: common lookup patterns
CREATE INDEX IF NOT EXISTS idx_profiles_artisan_user_id
  ON profiles_artisan(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_client_user_id
  ON profiles_client(user_id);
