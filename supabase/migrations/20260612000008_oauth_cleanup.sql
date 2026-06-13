-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 20260612000008 — Nettoyage chiffrement OAuth (Alfredo / Gmail)
-- Date : 2026-06-13 — Audit Phase 2/9 Data Layer (OAUT-1 / OAUT-2)
-- Constats :
--   - OAUT-1 : access_token_enc / refresh_token_enc créées en BYTEA par
--     20260512_encrypt_oauth_tokens.sql. Le code v2 (lib/oauth/tokens.ts,
--     AES-256-GCM applicatif) y ÉCRIT des chaînes base64 — l'écriture passe —
--     mais PostgREST RELIT un bytea au format hex ('\x6261…') : sans la compat
--     normalizeStoredPayload() côté code, le déchiffrement échouerait. Le type
--     cible est text : conversion ci-dessous.
--   - OAUT-2 : colonnes legacy access_token / refresh_token (clair) et
--     access_token_encrypted / refresh_token_encrypted (pgcrypto v1, mort-né),
--     plus les fonctions get/set_encrypted_oauth_token — structurellement
--     mortes (set_config inutilisable via PostgREST, et elles référencent
--     t.token_expiry, colonne INEXISTANTE en live). Purge complète ici —
--     l'en-tête de lib/oauth/tokens.ts promettait cette purge.
--
-- Données : l'audit live du 2026-06-12 (Phase 2) a vérifié
--     SELECT count(*) FROM public.syndic_oauth_tokens;   --> 0 ligne
--   (aucun token n'a jamais été persisté : l'ancien flux RPC était mort).
--   RE-VÉRIFIER ce count juste avant push (REPAIR-RUNBOOK.md, étape 2d).
--   Même si des lignes v2 sont apparues entre-temps, la conversion
--   convert_from(<col>, 'UTF8') préserve exactement les payloads base64
--   écrits par le code (octets UTF-8 de la chaîne → la même chaîne en text).
--
-- IMPORTANT : entièrement idempotente (garde information_schema sur le type
-- des colonnes, DROP ... IF EXISTS partout).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. OAUT-1 — colonnes *_enc : bytea → text ─────────────────────────────────
-- Garde DO $$ : si la colonne est déjà en text (rejeu, ou env recréé depuis un
-- schéma corrigé), l'ALTER est sauté.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'syndic_oauth_tokens'
      AND column_name = 'access_token_enc' AND data_type = 'bytea'
  ) THEN
    ALTER TABLE public.syndic_oauth_tokens
      ALTER COLUMN access_token_enc TYPE text
      USING convert_from(access_token_enc, 'UTF8');
    RAISE NOTICE 'OAUT-1 : access_token_enc convertie bytea -> text';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'syndic_oauth_tokens'
      AND column_name = 'refresh_token_enc' AND data_type = 'bytea'
  ) THEN
    ALTER TABLE public.syndic_oauth_tokens
      ALTER COLUMN refresh_token_enc TYPE text
      USING convert_from(refresh_token_enc, 'UTF8');
    RAISE NOTICE 'OAUT-1 : refresh_token_enc convertie bytea -> text';
  END IF;
END $$;

-- Commentaires : remplacent ceux de 20260512 (qui décrivaient le flux
-- pgp_sym_encrypt/RPC, mort).
COMMENT ON COLUMN public.syndic_oauth_tokens.access_token_enc IS
  'Access token OAuth chiffré côté application — AES-256-GCM (lib/oauth/tokens.ts), base64(IV 12 octets || ciphertext+tag). encryption_version = 2.';
COMMENT ON COLUMN public.syndic_oauth_tokens.refresh_token_enc IS
  'Refresh token OAuth chiffré côté application — AES-256-GCM (lib/oauth/tokens.ts), base64(IV 12 octets || ciphertext+tag). encryption_version = 2.';
COMMENT ON COLUMN public.syndic_oauth_tokens.encryption_version IS
  '2 = AES-256-GCM applicatif (lib/oauth/tokens.ts). 1/null = flux pgcrypto v1 mort — traité comme « sans token », re-connexion OAuth requise.';

-- ── 2. OAUT-2 — purge des colonnes legacy (0 ligne en prod, cf. en-tête) ──────
ALTER TABLE public.syndic_oauth_tokens
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token,
  DROP COLUMN IF EXISTS access_token_encrypted,
  DROP COLUMN IF EXISTS refresh_token_encrypted;

-- ── 3. OAUT-2 — fonctions RPC v1 mortes (référencent t.token_expiry, colonne
-- inexistante en live ; jamais appelables via PostgREST faute de set_config) ──
DROP FUNCTION IF EXISTS public.get_decrypted_oauth_token(uuid);
DROP FUNCTION IF EXISTS public.set_encrypted_oauth_token(uuid, text, text, timestamptz, smallint);
