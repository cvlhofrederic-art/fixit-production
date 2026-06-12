// Tests du chiffrement applicatif des tokens OAuth (lib/oauth/tokens.ts).
// Refonte audit P2 (TSQ-02/FNC-02) : l'ancien flux RPC set_config +
// get/set_encrypted_oauth_token (mort en prod) est remplacé par AES-256-GCM
// via Web Crypto — colonnes access_token_enc/refresh_token_enc, version 2.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ENCRYPTION_VERSION,
  getEncryptionKey,
  encryptToken,
  decryptToken,
  setEncryptedToken,
  getDecryptedToken,
} from '@/lib/oauth/tokens'
import { logger } from '@/lib/logger'

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const TEST_KEY = 'test-key-32-chars-long-padding!!'
const OTHER_KEY = 'another-key-32-chars-long-pad-!!'
const IV_LENGTH = 12

type SetClient = Parameters<typeof setEncryptedToken>[0]
type GetClient = Parameters<typeof getDecryptedToken>[0]

// Client mocké côté écriture : capture le payload upsert.
function makeUpsertClient(result: { error: { message: string } | null } = { error: null }) {
  const upsert = vi.fn().mockResolvedValue(result)
  const from = vi.fn(() => ({ upsert }))
  return { client: { from } as unknown as SetClient, from, upsert }
}

// Client mocké côté lecture : select → eq → maybeSingle.
function makeSelectClient(row: unknown, error: { message: string } | null = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { client: { from } as unknown as GetClient, from, select, eq, maybeSingle }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', TEST_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('lib/oauth/tokens — clé de chiffrement', () => {
  it('expose ENCRYPTION_VERSION = 2 (chiffrement applicatif)', () => {
    expect(ENCRYPTION_VERSION).toBe(2)
  })

  it('lit la clé depuis OAUTH_TOKENS_ENCRYPTION_KEY', () => {
    expect(getEncryptionKey()).toBe(TEST_KEY)
  })

  it('clé absente → throw', () => {
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', '')
    expect(() => getEncryptionKey()).toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
  })

  it('clé < 32 chars → throw', () => {
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', 'too-short')
    expect(() => getEncryptionKey()).toThrow(/at least 32/)
  })

  it('encryptToken rejette si la clé est absente', async () => {
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', '')
    await expect(encryptToken('secret')).rejects.toThrow(/OAUTH_TOKENS_ENCRYPTION_KEY/)
  })

  it('encryptToken rejette si la clé est trop courte', async () => {
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', 'too-short')
    await expect(encryptToken('secret')).rejects.toThrow(/at least 32/)
  })
})

describe('lib/oauth/tokens — encryptToken / decryptToken', () => {
  it('round-trip : chiffre puis déchiffre à l\'identique (ASCII + Unicode)', async () => {
    for (const plaintext of ['ya29.a0AfH6SMB-token', 'jeton-éüñ-日本語-🔐', '']) {
      const encrypted = await encryptToken(plaintext)
      expect(encrypted).not.toBe(plaintext)
      await expect(decryptToken(encrypted)).resolves.toBe(plaintext)
    }
  })

  it('le payload est du base64 : IV 12 octets préfixé au ciphertext', async () => {
    const encrypted = await encryptToken('abc')
    const bytes = Buffer.from(encrypted, 'base64')
    // 12 (IV) + 3 (plaintext) + 16 (tag GCM)
    expect(bytes.length).toBe(IV_LENGTH + 3 + 16)
  })

  it('IV unique entre deux chiffrements du même plaintext', async () => {
    const enc1 = await encryptToken('same-plaintext')
    const enc2 = await encryptToken('same-plaintext')
    expect(enc1).not.toBe(enc2)
    const iv1 = Buffer.from(enc1, 'base64').subarray(0, IV_LENGTH)
    const iv2 = Buffer.from(enc2, 'base64').subarray(0, IV_LENGTH)
    expect(iv1.equals(iv2)).toBe(false)
  })

  it('déchiffrement avec une autre clé → rejette (tag GCM invalide)', async () => {
    const encrypted = await encryptToken('secret')
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', OTHER_KEY)
    await expect(decryptToken(encrypted)).rejects.toThrow()
  })

  it('payload tronqué (IV manquant) → rejette explicitement', async () => {
    await expect(decryptToken(Buffer.from('court').toString('base64'))).rejects.toThrow(
      /payload trop court/,
    )
  })
})

describe('lib/oauth/tokens — setEncryptedToken', () => {
  const PARAMS = {
    syndic_id: 's1',
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_at: '2026-06-12T12:00:00.000Z',
  }

  it('upsert UNIQUEMENT les colonnes chiffrées + version 2 (onConflict syndic_id)', async () => {
    const { client, from, upsert } = makeUpsertClient()
    await setEncryptedToken(client, PARAMS)

    expect(from).toHaveBeenCalledWith('syndic_oauth_tokens')
    expect(upsert).toHaveBeenCalledTimes(1)
    const [row, opts] = upsert.mock.calls[0]
    expect(opts).toEqual({ onConflict: 'syndic_id' })
    expect(row).toMatchObject({
      syndic_id: 's1',
      provider: 'gmail',
      expires_at: PARAMS.expires_at,
      encryption_version: 2,
    })
    // Colonnes chiffrées présentes et différentes du clair
    expect(typeof row.access_token_enc).toBe('string')
    expect(typeof row.refresh_token_enc).toBe('string')
    expect(row.access_token_enc).not.toBe(PARAMS.access_token)
    expect(row.refresh_token_enc).not.toBe(PARAMS.refresh_token)
    // Colonnes legacy JAMAIS écrites (ni clair, ni pgcrypto v1)
    expect(row).not.toHaveProperty('access_token')
    expect(row).not.toHaveProperty('refresh_token')
    expect(row).not.toHaveProperty('access_token_encrypted')
    expect(row).not.toHaveProperty('refresh_token_encrypted')
    expect(row).not.toHaveProperty('token_expiry')
  })

  it('round-trip complet : ce que setEncryptedToken écrit, getDecryptedToken le relit', async () => {
    const { client, upsert } = makeUpsertClient()
    await setEncryptedToken(client, PARAMS)
    const written = upsert.mock.calls[0][0]

    const read = makeSelectClient({
      access_token_enc: written.access_token_enc,
      refresh_token_enc: written.refresh_token_enc,
      expires_at: written.expires_at,
      encryption_version: written.encryption_version,
    })
    const result = await getDecryptedToken(read.client, 's1')
    expect(result).toEqual({
      access_token: PARAMS.access_token,
      refresh_token: PARAMS.refresh_token,
      expires_at: PARAMS.expires_at,
    })
  })

  it('erreur upsert → throw setEncryptedToken failed', async () => {
    const { client } = makeUpsertClient({ error: { message: 'db down' } })
    await expect(setEncryptedToken(client, PARAMS)).rejects.toThrow(
      /setEncryptedToken failed: db down/,
    )
  })
})

describe('lib/oauth/tokens — getDecryptedToken', () => {
  it('requête scopée : colonnes enc + syndic_id', async () => {
    const { client, from, select, eq } = makeSelectClient(null)
    await getDecryptedToken(client, 's1')
    expect(from).toHaveBeenCalledWith('syndic_oauth_tokens')
    expect(select).toHaveBeenCalledWith(
      'access_token_enc, refresh_token_enc, expires_at, encryption_version',
    )
    expect(eq).toHaveBeenCalledWith('syndic_id', 's1')
  })

  it('aucune ligne → null, sans warn (jamais connecté = cas normal)', async () => {
    const { client } = makeSelectClient(null)
    await expect(getDecryptedToken(client, 'unknown')).resolves.toBeNull()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('erreur DB → throw (l\'appelant doit compter l\'échec)', async () => {
    const { client } = makeSelectClient(null, { message: 'db down' })
    await expect(getDecryptedToken(client, 's1')).rejects.toThrow(
      /getDecryptedToken failed: db down/,
    )
  })

  it('ligne legacy encryption_version=1 → null + warn (re-connexion OAuth requise)', async () => {
    const { client } = makeSelectClient({
      access_token_enc: 'quelconque',
      refresh_token_enc: 'quelconque',
      expires_at: '2026-06-12T12:00:00.000Z',
      encryption_version: 1,
    })
    await expect(getDecryptedToken(client, 's1')).resolves.toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('re-connexion OAuth requise'),
      expect.objectContaining({ syndic_id: 's1', encryption_version: 1 }),
    )
  })

  it('ligne legacy encryption_version=null → null + warn', async () => {
    const { client } = makeSelectClient({
      access_token_enc: null,
      refresh_token_enc: null,
      expires_at: null,
      encryption_version: null,
    })
    await expect(getDecryptedToken(client, 's1')).resolves.toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('re-connexion OAuth requise'),
      expect.objectContaining({ syndic_id: 's1', encryption_version: null }),
    )
  })

  it('version 2 mais colonnes enc vides → null + warn', async () => {
    const { client } = makeSelectClient({
      access_token_enc: null,
      refresh_token_enc: null,
      expires_at: '2026-06-12T12:00:00.000Z',
      encryption_version: 2,
    })
    await expect(getDecryptedToken(client, 's1')).resolves.toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })

  it('payload indéchiffrable (clé changée) → null + warn, jamais de throw', async () => {
    const accessEnc = await encryptToken('access')
    const refreshEnc = await encryptToken('refresh')
    vi.stubEnv('OAUTH_TOKENS_ENCRYPTION_KEY', OTHER_KEY)
    const { client } = makeSelectClient({
      access_token_enc: accessEnc,
      refresh_token_enc: refreshEnc,
      expires_at: '2026-06-12T12:00:00.000Z',
      encryption_version: 2,
    })
    await expect(getDecryptedToken(client, 's1')).resolves.toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Déchiffrement impossible'),
      expect.objectContaining({ syndic_id: 's1' }),
    )
  })
})
