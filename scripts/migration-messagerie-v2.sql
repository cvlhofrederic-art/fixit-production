-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : Messagerie artisan v2 — conversations + messages unifiés
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Ajouter user_type sur profiles_artisan si pas déjà présent
-- (les artisans sont toujours 'artisan', on l'utilise pour les contacts)
-- On stocke le contact_type directement dans conversations

-- 2. Table conversations (1 conversation = 1 paire artisan ↔ contact)
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_type     TEXT NOT NULL CHECK (contact_type IN ('particulier', 'pro')) DEFAULT 'particulier',
  contact_name     TEXT NOT NULL DEFAULT '',
  contact_avatar   TEXT DEFAULT '',
  last_message_at  TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT DEFAULT '',
  unread_count     INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(artisan_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_artisan
  ON conversations(artisan_id, contact_type, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_contact
  ON conversations(contact_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_unread
  ON conversations(artisan_id, contact_type, unread_count) WHERE unread_count > 0;

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    artisan_id = auth.uid() OR contact_id = auth.uid()
  );

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (
    artisan_id = auth.uid() OR contact_id = auth.uid()
  );

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (
    artisan_id = auth.uid() OR contact_id = auth.uid()
  );

-- Service role bypass pour les API
CREATE POLICY "conversations_service" ON conversations
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Table messages (texte + ordres de mission)
CREATE TABLE IF NOT EXISTS conversation_messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID NOT NULL REFERENCES auth.users(id),
  type             TEXT NOT NULL CHECK (type IN ('text', 'ordre_mission', 'photo', 'voice', 'system')) DEFAULT 'text',
  content          TEXT DEFAULT '',
  ordre_mission    JSONB,
  -- ordre_mission: { titre, adresse, date_souhaitee, description, urgence, statut, mission_id }
  -- statut: 'en_attente' | 'accepte' | 'refuse' | 'en_cours' | 'termine'
  metadata         JSONB DEFAULT '{}',
  read             BOOLEAN DEFAULT false,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation
  ON conversation_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_unread
  ON conversation_messages(conversation_id, read, sender_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_conv_messages_ordre
  ON conversation_messages(conversation_id) WHERE type = 'ordre_mission';

-- RLS
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select" ON conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
      AND (c.artisan_id = auth.uid() OR c.contact_id = auth.uid())
    )
  );

CREATE POLICY "messages_insert" ON conversation_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "messages_update" ON conversation_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
      AND (c.artisan_id = auth.uid() OR c.contact_id = auth.uid())
    )
  );

-- Service role bypass
CREATE POLICY "messages_service" ON conversation_messages
  FOR ALL USING (true) WITH CHECK (true);

-- 4. Activer Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;

-- 5. Fonction pour mettre à jour last_message automatiquement
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE
      WHEN NEW.type = 'ordre_mission' THEN '📋 Ordre de mission'
      WHEN NEW.type = 'photo' THEN '📷 Photo'
      WHEN NEW.type = 'voice' THEN '🎤 Message vocal'
      ELSE LEFT(NEW.content, 80)
    END,
    unread_count = CASE
      WHEN NEW.sender_id != conversations.artisan_id
      THEN unread_count + 1
      ELSE unread_count
    END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_conversation_message_insert
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
