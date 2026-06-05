-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Autoriser l'agent 'tempo' dans syndic_ai_conversations
-- Date: 2026-05-21
-- ══════════════════════════════════════════════════════════════════════════════
-- Le CHECK constraint d'origine (20260511_agents_ia_foundation.sql) ne listait
-- que fixy/max/lea/alfredo. Tempo a été ajouté côté code (lib/syndic/agent-types.ts
-- + composants) mais pas côté DB, ce qui empêche la persistance des conversations
-- Tempo dans la nouvelle sidebar partagée.

ALTER TABLE syndic_ai_conversations
  DROP CONSTRAINT IF EXISTS syndic_ai_conversations_agent_id_check;

ALTER TABLE syndic_ai_conversations
  ADD CONSTRAINT syndic_ai_conversations_agent_id_check
  CHECK (agent_id IN ('fixy','max','lea','alfredo','tempo'));
