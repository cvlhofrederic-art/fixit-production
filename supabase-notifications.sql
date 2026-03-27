-- ══════════════════════════════════════════════════════════════════════
-- Vitfix Pro — Notifications in-app + Storage mission-reports
-- À exécuter dans l'éditeur SQL de Supabase
-- ══════════════════════════════════════════════════════════════════════

-- 1. Notifications pour le syndic (Realtime)
CREATE TABLE IF NOT EXISTS syndic_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'mission',
  -- types: 'rapport_intervention' | 'new_mission' | 'mission_completed' | 'alert' | 'document'
  title       TEXT NOT NULL,
  body        TEXT DEFAULT '',
  read        BOOLEAN DEFAULT FALSE,
  data_json   JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE syndic_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "syndic_own_notifs" ON syndic_notifications
  FOR ALL USING (syndic_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_syndic_notifs_unread
  ON syndic_notifications(syndic_id, read, created_at DESC);

-- 2. Notifications pour l'artisan (Realtime)
CREATE TABLE IF NOT EXISTS artisan_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'new_mission',
  -- types: 'new_mission' | 'mission_update' | 'planning_change' | 'message'
  title       TEXT NOT NULL,
  body        TEXT DEFAULT '',
  read        BOOLEAN DEFAULT FALSE,
  data_json   JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE artisan_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "artisan_own_notifs" ON artisan_notifications
  FOR ALL USING (artisan_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_artisan_notifs_unread
  ON artisan_notifications(artisan_id, read, created_at DESC);

-- 3. Activer Realtime sur les deux tables
-- (Dans Supabase : Table Editor > syndic_notifications > Enable Realtime)
-- OU via SQL :
ALTER PUBLICATION supabase_realtime ADD TABLE syndic_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE artisan_notifications;
