-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : fix_security_audit.sql
-- Date       : 2026-03-01
-- Description: Comprehensive security hardening — RLS policies, token
--              encryption columns, soft delete, missing indexes, exec_sql removal
--
-- IMPORTANT  : This migration is fully idempotent (IF EXISTS / IF NOT EXISTS).
--              Safe to run multiple times.
--
-- Execute in: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 1 — RLS on syndic_signalements: replace USING(true) with cabinet_id check
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. SELECT — only owner cabinet or team members
DROP POLICY IF EXISTS "syndic_signalements_read" ON syndic_signalements;
CREATE POLICY "syndic_signalements_read" ON syndic_signalements FOR SELECT
  USING (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_signalements.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- 1b. INSERT — anyone can create a signalement (residents, tenants, technicians)
--     but the row must carry the correct cabinet_id or be null (to be assigned later)
DROP POLICY IF EXISTS "syndic_signalements_insert" ON syndic_signalements;
CREATE POLICY "syndic_signalements_insert" ON syndic_signalements FOR INSERT
  WITH CHECK (true);
-- NOTE: INSERT stays permissive because signalements are submitted by external
-- users (coproprio, locataire, technicien) who are not necessarily authenticated
-- Supabase users. The API routes (service_role) handle validation.

-- 1c. UPDATE — only owner cabinet or team members
DROP POLICY IF EXISTS "syndic_signalements_update" ON syndic_signalements;
CREATE POLICY "syndic_signalements_update" ON syndic_signalements FOR UPDATE
  USING (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_signalements.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- 1d. DELETE — only owner cabinet
DROP POLICY IF EXISTS "syndic_signalements_delete" ON syndic_signalements;
CREATE POLICY "syndic_signalements_delete" ON syndic_signalements FOR DELETE
  USING (cabinet_id = auth.uid());

-- 1e. syndic_signalement_messages — restrict to cabinet that owns the parent signalement
DROP POLICY IF EXISTS "syndic_signalement_messages_all" ON syndic_signalement_messages;
CREATE POLICY "syndic_signalement_messages_select" ON syndic_signalement_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM syndic_signalements s
      WHERE s.id = syndic_signalement_messages.signalement_id
      AND (
        s.cabinet_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM syndic_team_members
          WHERE syndic_team_members.cabinet_id = s.cabinet_id
            AND syndic_team_members.user_id = auth.uid()
            AND syndic_team_members.is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "syndic_signalement_messages_insert" ON syndic_signalement_messages;
CREATE POLICY "syndic_signalement_messages_insert" ON syndic_signalement_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM syndic_signalements s
      WHERE s.id = syndic_signalement_messages.signalement_id
      AND (
        s.cabinet_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM syndic_team_members
          WHERE syndic_team_members.cabinet_id = s.cabinet_id
            AND syndic_team_members.user_id = auth.uid()
            AND syndic_team_members.is_active = true
        )
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 2 — RLS on conversations / conversation_messages
--         Replace USING(true) "service" policies with participant-based filtering
-- ════════════════════════════════════════════════════════════════════════════

-- 2a. Drop the overly-permissive service bypass policies
DROP POLICY IF EXISTS "conversations_service" ON conversations;
DROP POLICY IF EXISTS "messages_service" ON conversation_messages;

-- 2b. conversations — keep existing participant-based policies
--     (conversations_select, conversations_insert, conversations_update already
--      filter by artisan_id = auth.uid() OR contact_id = auth.uid())
--     We just removed the dangerous "service" bypass above.

-- 2c. conversation_messages — keep existing participant-based policies
--     (messages_select, messages_insert, messages_update already filter correctly)
--     We just removed the dangerous "service" bypass above.

-- NOTE: The service_role key used in API routes automatically bypasses RLS.
-- The FOR ALL USING(true) policies were redundant and dangerous because they
-- also applied to anon/authenticated roles, not just service_role.


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 3 — OAuth token encryption support
-- ════════════════════════════════════════════════════════════════════════════

-- 3a. Enable pgcrypto extension for encryption functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 3b. Add encrypted storage columns to syndic_oauth_tokens
-- These will hold AES-encrypted versions of the tokens.
-- Application code must encrypt before INSERT and decrypt after SELECT
-- using a server-side encryption key (e.g., ENCRYPTION_KEY env var).
ALTER TABLE syndic_oauth_tokens
  ADD COLUMN IF NOT EXISTS access_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted BYTEA,
  ADD COLUMN IF NOT EXISTS oauth_nonce TEXT,
  ADD COLUMN IF NOT EXISTS oauth_nonce_expires_at TIMESTAMPTZ;

-- 3c. Add comments documenting the encryption requirement
COMMENT ON COLUMN syndic_oauth_tokens.access_token IS
  'DEPRECATED — plain text. Migrate to access_token_encrypted (AES via pgcrypto). '
  'Application must call pgp_sym_encrypt(token, key) on write and pgp_sym_decrypt on read.';

COMMENT ON COLUMN syndic_oauth_tokens.refresh_token IS
  'DEPRECATED — plain text. Migrate to refresh_token_encrypted (AES via pgcrypto). '
  'Application must call pgp_sym_encrypt(token, key) on write and pgp_sym_decrypt on read.';

COMMENT ON COLUMN syndic_oauth_tokens.access_token_encrypted IS
  'AES-encrypted access token. Use pgp_sym_encrypt/pgp_sym_decrypt with server-side ENCRYPTION_KEY.';

COMMENT ON COLUMN syndic_oauth_tokens.refresh_token_encrypted IS
  'AES-encrypted refresh token. Use pgp_sym_encrypt/pgp_sym_decrypt with server-side ENCRYPTION_KEY.';

-- 3d. Helper functions for token encryption/decryption
-- Usage: SELECT encrypt_token('my_secret_token', 'my_encryption_key');
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT pgp_sym_encrypt(token, encryption_key);
$$;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted BYTEA, encryption_key TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE STRICT
AS $$
  SELECT pgp_sym_decrypt(encrypted, encryption_key);
$$;

COMMENT ON FUNCTION encrypt_token IS
  'Encrypt a plaintext token using PGP symmetric encryption (AES). '
  'Key should come from server-side env var ENCRYPTION_KEY, never from client.';

COMMENT ON FUNCTION decrypt_token IS
  'Decrypt an encrypted token using PGP symmetric encryption (AES). '
  'Key should come from server-side env var ENCRYPTION_KEY, never from client.';


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 4 — Soft delete columns on critical tables
-- ════════════════════════════════════════════════════════════════════════════

-- 4a. bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4b. conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4c. conversation_messages
ALTER TABLE conversation_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4d. syndic_signalements
ALTER TABLE syndic_signalements
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4e. syndic_missions
ALTER TABLE syndic_missions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4f. syndic_signalement_messages
ALTER TABLE syndic_signalement_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4g. booking_messages
ALTER TABLE booking_messages
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4h. syndic_emails_analysed
ALTER TABLE syndic_emails_analysed
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 4i. Indexes on deleted_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at
  ON bookings(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON conversations(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conv_messages_deleted_at
  ON conversation_messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_deleted_at
  ON syndic_signalements(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syndic_missions_deleted_at
  ON syndic_missions(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syndic_signalement_msgs_deleted_at
  ON syndic_signalement_messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_booking_messages_deleted_at
  ON booking_messages(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_syndic_emails_deleted_at
  ON syndic_emails_analysed(deleted_at) WHERE deleted_at IS NOT NULL;

-- 4j. Update RLS policies to exclude soft-deleted rows
--     We recreate the SELECT policies with AND deleted_at IS NULL

-- syndic_signalements (already recreated in FIX 1, update to add soft delete filter)
DROP POLICY IF EXISTS "syndic_signalements_read" ON syndic_signalements;
CREATE POLICY "syndic_signalements_read" ON syndic_signalements FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      cabinet_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM syndic_team_members
        WHERE syndic_team_members.cabinet_id = syndic_signalements.cabinet_id
          AND syndic_team_members.user_id = auth.uid()
          AND syndic_team_members.is_active = true
      )
    )
  );

-- syndic_signalement_messages
DROP POLICY IF EXISTS "syndic_signalement_messages_select" ON syndic_signalement_messages;
CREATE POLICY "syndic_signalement_messages_select" ON syndic_signalement_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM syndic_signalements s
      WHERE s.id = syndic_signalement_messages.signalement_id
      AND s.deleted_at IS NULL
      AND (
        s.cabinet_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM syndic_team_members
          WHERE syndic_team_members.cabinet_id = s.cabinet_id
            AND syndic_team_members.user_id = auth.uid()
            AND syndic_team_members.is_active = true
        )
      )
    )
  );

-- conversations — update existing select policy with soft delete filter
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations FOR SELECT
  USING (
    deleted_at IS NULL
    AND (artisan_id = auth.uid() OR contact_id = auth.uid())
  );

-- conversation_messages — update existing select policy with soft delete filter
DROP POLICY IF EXISTS "messages_select" ON conversation_messages;
CREATE POLICY "messages_select" ON conversation_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_messages.conversation_id
      AND c.deleted_at IS NULL
      AND (c.artisan_id = auth.uid() OR c.contact_id = auth.uid())
    )
  );

-- syndic_missions — update existing access policy with soft delete filter
DROP POLICY IF EXISTS "syndic_missions_access" ON syndic_missions;
CREATE POLICY "syndic_missions_access" ON syndic_missions FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      cabinet_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM syndic_team_members
        WHERE syndic_team_members.cabinet_id = syndic_missions.cabinet_id
          AND syndic_team_members.user_id = auth.uid()
          AND syndic_team_members.is_active = true
      )
    )
  );

-- syndic_missions — recreate insert policy (untouched, just ensuring it exists)
DROP POLICY IF EXISTS "syndic_missions_insert" ON syndic_missions;
CREATE POLICY "syndic_missions_insert" ON syndic_missions FOR INSERT
  WITH CHECK (
    cabinet_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM syndic_team_members
      WHERE syndic_team_members.cabinet_id = syndic_missions.cabinet_id
        AND syndic_team_members.user_id = auth.uid()
        AND syndic_team_members.is_active = true
    )
  );

-- syndic_missions — update policy (also needs soft delete filter)
DROP POLICY IF EXISTS "syndic_missions_update" ON syndic_missions;
CREATE POLICY "syndic_missions_update" ON syndic_missions FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      cabinet_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM syndic_team_members
        WHERE syndic_team_members.cabinet_id = syndic_missions.cabinet_id
          AND syndic_team_members.user_id = auth.uid()
          AND syndic_team_members.is_active = true
      )
    )
  );

-- booking_messages — update select policy with soft delete filter
DROP POLICY IF EXISTS "booking_messages_select" ON booking_messages;
CREATE POLICY "booking_messages_select" ON booking_messages FOR SELECT
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_messages.booking_id
      AND b.deleted_at IS NULL
      AND (
        b.client_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles_artisan pa
          WHERE pa.id = b.artisan_id AND pa.user_id = auth.uid()
        )
      )
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 5 — Missing indexes on bookings and other critical tables
-- ════════════════════════════════════════════════════════════════════════════

-- 5a. bookings — core query indexes
CREATE INDEX IF NOT EXISTS idx_bookings_artisan_id   ON bookings(artisan_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id    ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date         ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at   ON bookings(created_at);

-- 5b. bookings — composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bookings_artisan_date
  ON bookings(artisan_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_artisan_status
  ON bookings(artisan_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_date
  ON bookings(client_id, booking_date DESC);

-- 5c. syndic_missions — additional useful indexes
CREATE INDEX IF NOT EXISTS idx_syndic_missions_statut
  ON syndic_missions(statut);
CREATE INDEX IF NOT EXISTS idx_syndic_missions_signalement
  ON syndic_missions(signalement_id);
CREATE INDEX IF NOT EXISTS idx_syndic_missions_date_intervention
  ON syndic_missions(date_intervention);

-- 5d. syndic_signalements — additional useful indexes
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_statut
  ON syndic_signalements(statut);
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_priorite
  ON syndic_signalements(priorite);
CREATE INDEX IF NOT EXISTS idx_syndic_signalements_created_at
  ON syndic_signalements(created_at DESC);

-- 5e. syndic_oauth_tokens — index for poll lookups
CREATE INDEX IF NOT EXISTS idx_syndic_oauth_tokens_syndic
  ON syndic_oauth_tokens(syndic_id);

-- 5f. booking_messages — ensure sender_id is indexed
CREATE INDEX IF NOT EXISTS idx_booking_messages_sender
  ON booking_messages(sender_id);


-- ════════════════════════════════════════════════════════════════════════════
-- FIX 6 — Remove dangerous exec_sql RPC function
-- ════════════════════════════════════════════════════════════════════════════

-- exec_sql allows arbitrary SQL execution via RPC. This is a critical security
-- risk as it can be called by any authenticated user. The admin/setup and
-- migration scripts that used it should be migrated to use supabaseAdmin
-- (service_role) direct queries or Supabase Dashboard SQL editor instead.
DROP FUNCTION IF EXISTS exec_sql(text);

-- Also drop any overloaded variants
DROP FUNCTION IF EXISTS exec_sql(sql text);


-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (uncomment to run manually for validation)
-- ════════════════════════════════════════════════════════════════════════════

-- Check that no USING(true) policies remain on critical tables:
-- SELECT schemaname, tablename, policyname, qual
-- FROM pg_policies
-- WHERE tablename IN (
--   'syndic_signalements', 'syndic_signalement_messages',
--   'conversations', 'conversation_messages',
--   'syndic_missions', 'bookings', 'booking_messages'
-- )
-- ORDER BY tablename, policyname;

-- Verify soft delete columns exist:
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE column_name IN ('deleted_at', 'deleted_by')
--   AND table_schema = 'public'
-- ORDER BY table_name;

-- Verify exec_sql is gone:
-- SELECT proname FROM pg_proc WHERE proname = 'exec_sql';

-- Verify encrypted columns exist:
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'syndic_oauth_tokens'
--   AND column_name LIKE '%encrypted';
