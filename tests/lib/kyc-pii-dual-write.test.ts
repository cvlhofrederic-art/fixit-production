import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const encryptPIIMock = vi.fn()
const encryptJSONMock = vi.fn()

vi.mock('@/lib/pii-crypto', () => ({
  encryptPII: (...args: unknown[]) => encryptPIIMock(...args),
  encryptJSON: (...args: unknown[]) => encryptJSONMock(...args),
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
  encryptPIIMock.mockResolvedValue('CIPHERTEXT-PLAIN')
  encryptJSONMock.mockResolvedValue('CIPHERTEXT-JSON')
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('piiDualWriteAdditions', () => {
  it('returns siret_encrypted + version on FR happy path', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const out = await piiDualWriteAdditions({
      market: 'FR',
      declaredIdentifiant: '12345678901234',
      kbisExtracted: null,
    })
    expect(out).toEqual({
      siret_encrypted: 'CIPHERTEXT-PLAIN',
      pii_encryption_version: 1,
    })
    expect(encryptPIIMock).toHaveBeenCalledWith('12345678901234')
  })

  it('returns nif_encrypted + version on PT happy path', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const out = await piiDualWriteAdditions({
      market: 'PT',
      declaredIdentifiant: '123456789',
      kbisExtracted: null,
    })
    expect(out).toEqual({
      nif_encrypted: 'CIPHERTEXT-PLAIN',
      pii_encryption_version: 1,
    })
  })

  it('encrypts kbis_extracted on FR market', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const kbis = { denomination: 'ACME', siret: '12345678901234' }
    const out = await piiDualWriteAdditions({
      market: 'FR',
      declaredIdentifiant: '12345678901234',
      kbisExtracted: kbis,
    })
    expect(out).toMatchObject({
      siret_encrypted: 'CIPHERTEXT-PLAIN',
      kbis_extracted_encrypted: 'CIPHERTEXT-JSON',
      pii_encryption_version: 1,
    })
    expect(encryptJSONMock).toHaveBeenCalledWith(kbis)
  })

  it('does NOT encrypt kbis_extracted on PT market (no column)', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const out = await piiDualWriteAdditions({
      market: 'PT',
      declaredIdentifiant: '123456789',
      kbisExtracted: { denominacao: 'ACME', nif: '123456789' },
    })
    expect(out).toEqual({
      nif_encrypted: 'CIPHERTEXT-PLAIN',
      pii_encryption_version: 1,
    })
    expect(encryptJSONMock).not.toHaveBeenCalled()
  })

  it('returns an empty object when no inputs are provided (no version bump)', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const out = await piiDualWriteAdditions({
      market: 'FR',
      declaredIdentifiant: null,
      kbisExtracted: null,
    })
    expect(out).toEqual({})
  })

  it('treats whitespace-only identifiant as null', async () => {
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    const out = await piiDualWriteAdditions({
      market: 'FR',
      declaredIdentifiant: '   ',
      kbisExtracted: null,
    })
    expect(out).toEqual({})
  })

  it('propagates an encryptPII rejection', async () => {
    encryptPIIMock.mockRejectedValueOnce(new Error('PII_ENCRYPTION_KEY missing'))
    const { piiDualWriteAdditions } = await import('@/lib/services/kyc/pii-dual-write')
    await expect(
      piiDualWriteAdditions({
        market: 'FR',
        declaredIdentifiant: '12345678901234',
        kbisExtracted: null,
      })
    ).rejects.toThrow(/PII_ENCRYPTION_KEY/)
  })
})
