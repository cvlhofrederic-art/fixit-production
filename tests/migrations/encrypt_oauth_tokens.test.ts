import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

describe('Migration encrypt_oauth_tokens.sql', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260512_encrypt_oauth_tokens.sql'),
    'utf-8',
  )

  it('active pgcrypto', () => {
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/)
  })

  it('ajoute les 3 colonnes encrypted', () => {
    expect(sql).toMatch(/ADD COLUMN access_token_enc bytea/)
    expect(sql).toMatch(/ADD COLUMN refresh_token_enc bytea/)
    expect(sql).toMatch(/ADD COLUMN encryption_version smallint/)
  })

  it('définit les 2 fonctions RPC SECURITY DEFINER avec search_path public', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION set_encrypted_oauth_token[\s\S]*?SECURITY DEFINER SET search_path = public/)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION get_decrypted_oauth_token[\s\S]*?SECURITY DEFINER SET search_path = public/)
  })

  it('REVOKE EXECUTE sur anon/authenticated, GRANT à service_role uniquement', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION set_encrypted_oauth_token[\s\S]*?FROM PUBLIC, anon, authenticated/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION set_encrypted_oauth_token[\s\S]*?TO service_role/)
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION get_decrypted_oauth_token[\s\S]*?TO service_role/)
  })

  it('vérifie la longueur minimale de la clé d\'encryption (>= 32 chars)', () => {
    expect(sql).toMatch(/length\(v_key\) < 32/)
  })

  it('ne drop PAS les colonnes plain (phase 4 différée)', () => {
    expect(sql).not.toMatch(/DROP COLUMN access_token\b/)
    expect(sql).not.toMatch(/DROP COLUMN refresh_token\b/)
  })

  it('utilise pgp_sym_encrypt et pgp_sym_decrypt', () => {
    expect(sql).toMatch(/pgp_sym_encrypt/)
    expect(sql).toMatch(/pgp_sym_decrypt/)
  })
})
