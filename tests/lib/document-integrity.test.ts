import { describe, it, expect, beforeAll } from 'vitest'
import {
  canonicalize,
  computeContentHash,
  computeChainSignature,
  type CanonicalDocPayload,
} from '@/lib/document-integrity'

// FR-V1 — Vérifie le déterminisme du payload canonique + correctness du hash
// SHA-256 + correctness du HMAC-SHA256.

beforeAll(() => {
  // Web Crypto API disponible nativement dans Node 19+ ; rien à mock.
  expect(typeof crypto?.subtle?.digest).toBe('function')
})

const baseDoc: CanonicalDocPayload = {
  numero: 'DEV-2026-001',
  artisan_user_id: '550e8400-e29b-41d4-a716-446655440000',
  client_name: 'Mme Dupont',
  total_ht_cents: 100000,
  total_tax_cents: 20000,
  total_ttc_cents: 120000,
  items: [
    { name: 'Item A', qty: 2, price_ht: 50000 },
    { name: 'Item B', qty: 1, price_ht: 0 },
  ],
  signed_at: '2026-05-05T12:00:00.000Z',
}

describe('canonicalize', () => {
  it('produces stable string regardless of key insertion order', () => {
    const a = canonicalize({ ...baseDoc })
    // Reconstruct with shuffled key order
    const shuffled: CanonicalDocPayload = {
      signed_at: baseDoc.signed_at,
      total_ttc_cents: baseDoc.total_ttc_cents,
      numero: baseDoc.numero,
      items: baseDoc.items,
      client_name: baseDoc.client_name,
      total_tax_cents: baseDoc.total_tax_cents,
      total_ht_cents: baseDoc.total_ht_cents,
      artisan_user_id: baseDoc.artisan_user_id,
    }
    const b = canonicalize(shuffled)
    expect(a).toBe(b)
  })

  it('differs when a value changes', () => {
    const a = canonicalize(baseDoc)
    const b = canonicalize({ ...baseDoc, total_ttc_cents: 999999 })
    expect(a).not.toBe(b)
  })
})

describe('computeContentHash', () => {
  it('returns 64-char hex string', async () => {
    const h = await computeContentHash(baseDoc)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for same input', async () => {
    const h1 = await computeContentHash(baseDoc)
    const h2 = await computeContentHash(baseDoc)
    expect(h1).toBe(h2)
  })

  it('differs for different inputs', async () => {
    const h1 = await computeContentHash(baseDoc)
    const h2 = await computeContentHash({ ...baseDoc, numero: 'DEV-2026-002' })
    expect(h1).not.toBe(h2)
  })
})

describe('computeChainSignature', () => {
  const SECRET = 'a'.repeat(64) // 64 chars > 32 min

  it('returns 64-char hex string', async () => {
    const sig = await computeChainSignature('hash1', 'hash0', SECRET)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for same inputs', async () => {
    const a = await computeChainSignature('h1', 'h0', SECRET)
    const b = await computeChainSignature('h1', 'h0', SECRET)
    expect(a).toBe(b)
  })

  it('differs when content_hash changes', async () => {
    const a = await computeChainSignature('h1', 'h0', SECRET)
    const b = await computeChainSignature('h2', 'h0', SECRET)
    expect(a).not.toBe(b)
  })

  it('differs when previous_hash changes', async () => {
    const a = await computeChainSignature('h1', 'h0', SECRET)
    const b = await computeChainSignature('h1', 'h-prev', SECRET)
    expect(a).not.toBe(b)
  })

  it('handles null previous_hash (first doc in chain)', async () => {
    const sig = await computeChainSignature('h1', null, SECRET)
    expect(sig).toMatch(/^[0-9a-f]{64}$/)
  })

  it('differs when secret changes (key separation)', async () => {
    const a = await computeChainSignature('h1', 'h0', SECRET)
    const b = await computeChainSignature('h1', 'h0', 'b'.repeat(64))
    expect(a).not.toBe(b)
  })
})
