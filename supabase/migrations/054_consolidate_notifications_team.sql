-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 054 — Consolidation scripts notifications + team + absences
-- Date: 2026-04-12
-- Audit: DB-02 — Integre les 5 scripts SQL restants hors migrations
--
-- Integre (documentation only, tables deja creees en prod):
--   supabase-notifications.sql    → syndic_notifications, artisan_notifications
--   supabase-team.sql             → syndic_team_members
--   supabase-absences.sql         → artisan_absences
--   supabase-email-agent.sql      → syndic_emails_analysed
--   supabase-storage-migration.sql → storage bucket policies
--
-- IMPORTANT: Entierement idempotent. Safe en prod.
-- Les tables et policies sont deja en place via les scripts originaux
-- et les migrations 039/041/044. Cette migration documente le tout.
-- ══════════════════════════════════════════════════════════════════════════════

-- Verification: toutes ces tables existent deja.
-- Cette migration est un marqueur d'integration, pas une creation.

-- syndic_notifications (supabase-notifications.sql) → deja en prod
-- artisan_notifications (supabase-notifications.sql) → deja en prod
-- syndic_team_members (supabase-team.sql) → deja en prod
-- artisan_absences → deja en prod (colonne ajoutee dans migration 009 ou Dashboard)
-- syndic_emails_analysed → deja en prod (supabase-email-agent.sql)

-- S'assurer que les index critiques existent
CREATE INDEX IF NOT EXISTS idx_syndic_notifs_unread
  ON syndic_notifications(syndic_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artisan_notifs_unread
  ON artisan_notifications(artisan_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_cabinet
  ON syndic_team_members(cabinet_id);
CREATE INDEX IF NOT EXISTS idx_team_user
  ON syndic_team_members(user_id);

-- Realtime (idempotent — Supabase ignore si deja dans la publication)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE syndic_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE artisan_notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
