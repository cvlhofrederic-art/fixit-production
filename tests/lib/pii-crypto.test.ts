import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

// 32 random bytes, base64-encoded. Deterministic so the test is reproducible.
const TEST_KEY_B64 = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='

beforeEach(() => {
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
  process.env.PII_ENCRYPTION_KEY = TEST_KEY_B64
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('lib/pii-crypto', () => {
  it('roundtrips a plaintext string', async () => {
    const { encryptPII, decryptPII } = await import('@/lib/pii-crypto')
    const ciphertext = await encryptPII('hello world')
    expect(typeof ciphertext).toBe('string')
    expect(ciphertext.length).toBeGreaterThan(0)
    const restored = await decryptPII(ciphertext)
    expect(restored).toBe('hello world')
  })

  it('produces a different ciphertext on each call (random nonce)', async () => {
    const { encryptPII } = await import('@/lib/pii-crypto')
    const a = await encryptPII('FR12345678901234')
    const b = await encryptPII('FR12345678901234')
    expect(a).not.toBe(b)
  })

  it('throws when PII_ENCRYPTION_KEY is missing', async () => {
    delete process.env.PII_ENCRYPTION_KEY
    const { encryptPII } = await import('@/lib/pii-crypto')
    await expect(encryptPII('x')).rejects.toThrow(/PII_ENCRYPTION_KEY/)
  })

  it('throws when PII_ENCRYPTION_KEY is the wrong length', async () => {
    process.env.PII_ENCRYPTION_KEY = Buffer.from('short').toString('base64')
    const { encryptPII } = await import('@/lib/pii-crypto')
    await expect(encryptPII('x')).rejects.toThrow(/32 bytes/)
  })

  it('throws on tampered ciphertext (auth tag mismatch)', async () => {
    const { encryptPII, decryptPII } = await import('@/lib/pii-crypto')
    const ciphertext = await encryptPII('SIRET-12345678901234')
    // Flip a byte by re-encoding through atob/btoa
    const decoded = Array.from(atob(ciphertext))
    decoded[15] = String.fromCharCode((decoded[15].charCodeAt(0) + 1) & 0xff)
    const tampered = btoa(decoded.join(''))
    await expect(decryptPII(tampered)).rejects.toBeDefined()
  })

  it('throws on payload shorter than nonce', async () => {
    const { decryptPII } = await import('@/lib/pii-crypto')
    await expect(decryptPII('short==')).rejects.toThrow()
  })

  it('throws on empty input to decrypt', async () => {
    const { decryptPII } = await import('@/lib/pii-crypto')
    await expect(decryptPII('')).rejects.toThrow()
  })

  it('roundtrips JSON via encryptJSON / decryptJSON', async () => {
    const { encryptJSON, decryptJSON } = await import('@/lib/pii-crypto')
    const payload = { denomination: 'ACME', siret: '12345678901234', date: '2026-05-07' }
    const ciphertext = await encryptJSON(payload)
    const restored = await decryptJSON<typeof payload>(ciphertext)
    expect(restored).toEqual(payload)
  })

  it('rejects non-string input to encryptPII', async () => {
    const { encryptPII } = await import('@/lib/pii-crypto')
    // @ts-expect-error - intentional type misuse for the test
    await expect(encryptPII(123)).rejects.toThrow(/string/)
  })

  it('handles empty string roundtrip', async () => {
    const { encryptPII, decryptPII } = await import('@/lib/pii-crypto')
    const ciphertext = await encryptPII('')
    const restored = await decryptPII(ciphertext)
    expect(restored).toBe('')
  })
})
