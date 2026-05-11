-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Fondations Agents IA Syndic (Plan A, Chunk 0)
-- Date: 2026-05-11
-- Spec: docs/superpowers/specs/2026-05-11-agents-ia-syndic-category-design.md
-- ══════════════════════════════════════════════════════════════════════════════
-- Crée les 4 tables nécessaires aux conversations persistées avec les agents
-- IA Syndic (Fixy, Max, Léa, Alfredo) :
--   - syndic_ai_conversations : un thread de conversation par utilisateur/agent
--   - syndic_ai_messages : messages individuels (user/assistant/system/tool)
--   - syndic_ai_audit : journal des actions exécutées par les agents (RGPD)
--   - syndic_alfredo_learning : différentiels brouillon/version envoyée
--
-- RLS strict : un syndic ne voit que ses propres rows (filtre auth.uid()).
-- Suppression cascade au delete account (RGPD Art. 17).

-- ── 1. Conversations ─────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL CHECK (agent_id IN ('fixy','max','lea','alfredo')),
  locale text NOT NULL CHECK (locale IN ('fr','pt')),
  title text NOT NULL DEFAULT 'Nouvelle conversation',
  immeuble_id uuid REFERENCES syndic_immeubles(id) ON DELETE SET NULL,
  message_count int NOT NULL DEFAULT 0,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX idx_syndic_ai_conv_user_agent
  ON syndic_ai_conversations(syndic_id, agent_id, updated_at DESC)
  WHERE archived_at IS NULL;

-- ── 2. Messages ──────────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES syndic_ai_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','system','tool')),
  content text NOT NULL,
  tool_calls jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_msg_conv ON syndic_ai_messages(conversation_id, created_at);

-- ── 3. Audit log RGPD ────────────────────────────────────────────────────────
CREATE TABLE syndic_ai_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  conversation_id uuid REFERENCES syndic_ai_conversations(id) ON DELETE SET NULL,
  action text NOT NULL,
  status text NOT NULL CHECK (status IN ('success','denied_rbac','cancelled','error')),
  tool_payload jsonb,
  error_message text,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_syndic_ai_audit_user ON syndic_ai_audit(syndic_id, created_at DESC);

-- ── 4. Apprentissage Alfredo (utilisé Plan C) ────────────────────────────────
CREATE TABLE syndic_alfredo_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  syndic_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_id uuid,  -- FK vers syndic_emails_analysed ajoutée en Plan C
  draft_proposed text NOT NULL,
  user_final_version text NOT NULL,
  diff_score float,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alfredo_learning_user ON syndic_alfredo_learning(syndic_id, created_at DESC);

-- ── 5. Row Level Security ────────────────────────────────────────────────────
ALTER TABLE syndic_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_ai_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE syndic_alfredo_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY syndic_own_conversations ON syndic_ai_conversations
  FOR ALL USING (syndic_id = auth.uid());

CREATE POLICY syndic_own_messages ON syndic_ai_messages
  FOR ALL USING (conversation_id IN (
    SELECT id FROM syndic_ai_conversations WHERE syndic_id = auth.uid()
  ));

CREATE POLICY syndic_own_audit ON syndic_ai_audit
  FOR SELECT USING (syndic_id = auth.uid());

CREATE POLICY syndic_own_alfredo_learning ON syndic_alfredo_learning
  FOR ALL USING (syndic_id = auth.uid());

-- ── 6. Triggers de maintenance ───────────────────────────────────────────────
-- Mise à jour automatique de updated_at et message_count
CREATE OR REPLACE FUNCTION update_conv_metadata() RETURNS trigger AS $$
BEGIN
  UPDATE syndic_ai_conversations
    SET updated_at = now(),
        message_count = message_count + 1,
        last_message_preview = LEFT(NEW.content, 120)
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_update_conv_on_message
  AFTER INSERT ON syndic_ai_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conv_metadata();
