-- ══════════════════════════════════════════════════════════════════════════════
-- Migration — Encryption tokens OAuth Gmail (Plan B Chunk 7)
-- Date: 2026-05-12
-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 1 : Ajouter colonnes chiffrées en parallèle des plain.
-- Phase 2 : Backfill — OBSOLÈTE : jamais exécuté (0 token persisté par ce flux),
--           script de backfill supprimé le 2026-06-13 (audit P2, OAUT-3).
-- Phase 3 : Code applicatif utilise les colonnes chiffrées (refactor en suivant).
-- Phase 4 : Drop des colonnes plain (Plan D, après 7 jours de stabilité prod).
--
-- ⚠️ 2026-06-13 (audit P2) : ce flux RPC pgcrypto (v1) est MORT — PostgREST
-- n'expose pas set_config, et les fonctions ci-dessous référencent
-- t.token_expiry, colonne inexistante en live. Remplacé par le chiffrement
-- applicatif AES-256-GCM (lib/oauth/tokens.ts, encryption_version = 2).
-- Colonnes legacy + fonctions purgées par 20260612000008_oauth_cleanup.sql
-- (qui convertit aussi *_enc bytea -> text).
--
-- Algorithme : pgcrypto pgp_sym_encrypt (AES-256 symétrique).
-- Clé : passée par RPC via SET LOCAL app.oauth_encryption_key (jamais stockée en PG).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE syndic_oauth_tokens
  ADD COLUMN access_token_enc bytea,
  ADD COLUMN refresh_token_enc bytea,
  ADD COLUMN encryption_version smallint NOT NULL DEFAULT 1;

COMMENT ON COLUMN syndic_oauth_tokens.access_token_enc IS
  'Token OAuth Gmail chiffré pgp_sym_encrypt(AES-256). Lecture via RPC.';
COMMENT ON COLUMN syndic_oauth_tokens.refresh_token_enc IS
  'Refresh token OAuth Gmail chiffré pgp_sym_encrypt(AES-256).';
COMMENT ON COLUMN syndic_oauth_tokens.encryption_version IS
  '1 = AES-256 pgp_sym, clé courante. Permet rotation future.';

-- ── Fonctions RPC pour encrypt/decrypt côté serveur ──────────────────────────
-- La clé est passée par l'appelant via SET LOCAL avant le RPC.
-- Postgres ne stocke jamais la clé.

CREATE OR REPLACE FUNCTION set_encrypted_oauth_token(
  p_syndic_id uuid,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz,
  p_encryption_version smallint DEFAULT 1
) RETURNS void AS $$
DECLARE
  v_key text := current_setting('app.oauth_encryption_key', true);
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'app.oauth_encryption_key must be set via SET LOCAL (>=32 chars)';
  END IF;

  INSERT INTO syndic_oauth_tokens (
    syndic_id,
    access_token_enc,
    refresh_token_enc,
    token_expiry,
    encryption_version
  ) VALUES (
    p_syndic_id,
    pgp_sym_encrypt(p_access_token, v_key),
    pgp_sym_encrypt(p_refresh_token, v_key),
    p_expires_at,
    p_encryption_version
  )
  ON CONFLICT (syndic_id) DO UPDATE
    SET access_token_enc = EXCLUDED.access_token_enc,
        refresh_token_enc = EXCLUDED.refresh_token_enc,
        token_expiry = EXCLUDED.token_expiry,
        encryption_version = EXCLUDED.encryption_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_decrypted_oauth_token(p_syndic_id uuid)
RETURNS TABLE (
  access_token text,
  refresh_token text,
  expires_at timestamptz
) AS $$
DECLARE
  v_key text := current_setting('app.oauth_encryption_key', true);
BEGIN
  IF v_key IS NULL OR length(v_key) < 32 THEN
    RAISE EXCEPTION 'app.oauth_encryption_key must be set via SET LOCAL (>=32 chars)';
  END IF;

  RETURN QUERY
    SELECT
      pgp_sym_decrypt(t.access_token_enc, v_key) AS access_token,
      pgp_sym_decrypt(t.refresh_token_enc, v_key) AS refresh_token,
      t.token_expiry AS expires_at
    FROM syndic_oauth_tokens t
    WHERE t.syndic_id = p_syndic_id
      AND t.access_token_enc IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION set_encrypted_oauth_token(uuid, text, text, timestamptz, smallint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_decrypted_oauth_token(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_encrypted_oauth_token(uuid, text, text, timestamptz, smallint) TO service_role;
GRANT EXECUTE ON FUNCTION get_decrypted_oauth_token(uuid) TO service_role;
