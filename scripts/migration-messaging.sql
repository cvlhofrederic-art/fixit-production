-- ================================================================
-- Migration: Messagerie client-artisan + paramètres artisan
-- ================================================================

-- 1. Table booking_messages
CREATE TABLE IF NOT EXISTS booking_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL,
  sender_id   UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'artisan', 'system')),
  sender_name TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_messages_booking ON booking_messages(booking_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_booking_messages_unread ON booking_messages(booking_id, sender_role, read_at);

-- RLS
ALTER TABLE booking_messages ENABLE ROW LEVEL SECURITY;

-- Politique : le client ou l'artisan du booking peuvent lire
CREATE POLICY "booking_messages_select" ON booking_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_messages.booking_id
      AND (
        b.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles_artisan pa
          WHERE pa.id = b.artisan_id AND pa.user_id = auth.uid()
        )
      )
    )
  );

-- Politique : seul le sender peut insérer
CREATE POLICY "booking_messages_insert" ON booking_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Permettre au service role d'insérer (pour auto-reply)
CREATE POLICY "booking_messages_service_insert" ON booking_messages
  FOR INSERT WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE booking_messages;

-- 2. Nouvelles colonnes profiles_artisan
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_accept BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_block_duration_minutes INTEGER DEFAULT 240;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_reply_message TEXT DEFAULT '';

-- 3. Nouvelle colonne bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
