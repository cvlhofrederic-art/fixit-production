// tests/api/oauth-tokens-encryption.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()

describe('OAuth tokens encryption integration (anti-régression)', () => {
  it('callback route utilise setEncryptedToken', () => {
    const src = readFileSync(join(ROOT, 'app/api/email-agent/callback/route.ts'), 'utf-8')
    expect(src).toMatch(/from\s+['"]@\/lib\/oauth\/tokens['"]/)
    expect(src).toMatch(/setEncryptedToken/)
  })

  it('poll route utilise getDecryptedToken', () => {
    const src = readFileSync(join(ROOT, 'app/api/email-agent/poll/route.ts'), 'utf-8')
    expect(src).toMatch(/getDecryptedToken/)
  })

  it('send-response route utilise getDecryptedToken', () => {
    const src = readFileSync(join(ROOT, 'app/api/email-agent/send-response/route.ts'), 'utf-8')
    expect(src).toMatch(/getDecryptedToken/)
  })

  it('le wrapper lib/oauth/tokens.ts existe et exporte les bonnes fonctions', () => {
    const src = readFileSync(join(ROOT, 'lib/oauth/tokens.ts'), 'utf-8')
    expect(src).toMatch(/export\s+(async\s+)?function\s+setEncryptedToken/)
    expect(src).toMatch(/export\s+(async\s+)?function\s+getDecryptedToken/)
    expect(src).toMatch(/export\s+function\s+getEncryptionKey/)
    expect(src).toMatch(/export\s+const\s+ENCRYPTION_VERSION/)
  })

  it('la migration définit les 2 fonctions RPC', () => {
    const sql = readFileSync(join(ROOT, 'supabase/migrations/20260512_encrypt_oauth_tokens.sql'), 'utf-8')
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION set_encrypted_oauth_token/)
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION get_decrypted_oauth_token/)
    expect(sql).toMatch(/SECURITY DEFINER SET search_path = public/)
  })
})
