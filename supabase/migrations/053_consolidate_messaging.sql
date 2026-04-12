-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 053 — Consolidation scripts messagerie hors migrations
-- Date: 2026-04-12
-- Audit: DB-02 — Scripts SQL eparpilles integres dans le systeme de migration
--        DB-06 — FK manquante sur booking_messages.booking_id
--        DB-07 — SECURITY DEFINER sans search_path sur update_conversation_on_message
--        DB-08 — Policy booking_messages_service_insert trop permissive
--        DB-09 — Policies conversations_service / messages_service trop permissives
--
-- Integre et corrige:
--   scripts/migration-messaging.sql
--   scripts/migration-messagerie-v2.sql
--
-- IMPORTANT: Entierement idempotent. Safe en prod.
-- ══════════════════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-06 — Ajouter FK sur booking_messages.booking_id
-- ══════════════════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_booking_messages_booking'
      AND table_name = 'booking_messages'
  ) THEN
    ALTER TABLE booking_messages
      ADD CONSTRAINT fk_booking_messages_booking
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE;
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-08 — Supprimer la policy permissive booking_messages_service_insert
-- Le service_role bypasse nativement le RLS, cette policy est dangereuse
-- car elle permet a TOUT utilisateur authentifie d'inserer.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "booking_messages_service_insert" ON booking_messages;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-09 — Supprimer les policies USING(true) sur conversations
-- Migration 039 les supprime deja, mais cette migration les re-supprime
-- au cas ou les scripts originaux auraient ete re-executes apres 039.
-- ══════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "conversations_service" ON conversations;
DROP POLICY IF EXISTS "messages_service" ON conversation_messages;


-- ══════════════════════════════════════════════════════════════════════════════
-- FIX DB-07 — Recreer update_conversation_on_message avec search_path
-- Corrige la vulnerabilite de schema hijacking sur la fonction trigger
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = CASE
      WHEN NEW.type = 'ordre_mission' THEN 'Ordre de mission'
      WHEN NEW.type = 'photo' THEN 'Photo'
      WHEN NEW.type = 'voice' THEN 'Message vocal'
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
$$;

-- Trigger deja cree dans le script original, on s'assure qu'il existe
DROP TRIGGER IF EXISTS trg_conversation_message_insert ON conversation_messages;
CREATE TRIGGER trg_conversation_message_insert
  AFTER INSERT ON conversation_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();
