import { describe, it, expect, vi, beforeEach } from 'vitest'

const selectMock = vi.fn()
const updateMock = vi.fn()

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        or: () => ({
          or: () => ({
            limit: () => selectMock(),
          }),
        }),
      }),
      update: (payload: unknown) => ({
        eq: (col: string, val: string) => updateMock({ payload, col, val }),
      }),
    }),
  },
}))

const getAuthUserMock = vi.fn()
const isSuperAdminMock = vi.fn()
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (...args: unknown[]) => getAuthUserMock(...args),
  isSuperAdmin: (...args: unknown[]) => isSuperAdminMock(...args),
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIP: () => '1.2.3.4',
  rateLimitResponse: () => new Response(JSON.stringify({ error: 'rate' }), { status: 429 }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const piiDualWriteAdditionsMock = vi.fn()
vi.mock('@/lib/services/kyc/pii-dual-write', () => ({
  piiDualWriteAdditions: (...args: unknown[]) => piiDualWriteAdditionsMock(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  updateMock.mockResolvedValue({ error: null })
})

function makeRequest(url = 'https://test.local/api/admin/pii-backfill'): Request {
  return new Request(url, { method: 'POST' })
}

describe('POST /api/admin/pii-backfill', () => {
  it('returns 401 when caller is not super-admin', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'u1' })
    isSuperAdminMock.mockReturnValueOnce(false)
    const { POST } = await import('@/app/api/admin/pii-backfill/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(401)
  })

  it('dry-run by default — does not call update', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    selectMock.mockResolvedValueOnce({
      data: [{ id: 'p1', siret: '12345678901234', kbis_extracted: null }],
      error: null,
    })
    piiDualWriteAdditionsMock.mockResolvedValueOnce({
      siret_encrypted: 'CIPHER',
      pii_encryption_version: 1,
    })
    const { POST } = await import('@/app/api/admin/pii-backfill/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dry_run).toBe(true)
    expect(body.encrypted).toBe(1)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('actual run with dry_run=false issues an UPDATE per row with encrypted columns', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    selectMock.mockResolvedValueOnce({
      data: [
        { id: 'p1', siret: '12345678901234', kbis_extracted: null },
        { id: 'p2', siret: null, kbis_extracted: null },
      ],
      error: null,
    })
    piiDualWriteAdditionsMock.mockResolvedValueOnce({
      siret_encrypted: 'CIPHER',
      pii_encryption_version: 1,
    })

    const { POST } = await import('@/app/api/admin/pii-backfill/route')
    const res = await POST(makeRequest('https://test.local/api/admin/pii-backfill?dry_run=false') as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.dry_run).toBe(false)
    expect(body.encrypted).toBe(1)
    expect(body.skipped).toBe(1) // p2 has neither siret nor kbis
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        col: 'id',
        val: 'p1',
        payload: expect.objectContaining({ siret_encrypted: 'CIPHER', pii_encryption_version: 1 }),
      })
    )
  })

  it('captures crypto errors per-row without aborting the batch', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    selectMock.mockResolvedValueOnce({
      data: [
        { id: 'p1', siret: '12345678901234', kbis_extracted: null },
        { id: 'p2', siret: '99999999999999', kbis_extracted: null },
      ],
      error: null,
    })
    piiDualWriteAdditionsMock
      .mockImplementationOnce(() => Promise.reject(new Error('PII_ENCRYPTION_KEY missing')))
      .mockImplementationOnce(() => Promise.resolve({ siret_encrypted: 'CIPHER', pii_encryption_version: 1 }))

    const { POST } = await import('@/app/api/admin/pii-backfill/route')
    const res = await POST(makeRequest('https://test.local/api/admin/pii-backfill?dry_run=false') as never)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.errors).toBe(1)
    expect(body.encrypted).toBe(1)
  })

  it('returns 500 when the SELECT itself fails', async () => {
    getAuthUserMock.mockResolvedValueOnce({ id: 'admin' })
    isSuperAdminMock.mockReturnValueOnce(true)
    selectMock.mockResolvedValueOnce({ data: null, error: { code: '42P01', message: 'relation does not exist' } })
    const { POST } = await import('@/app/api/admin/pii-backfill/route')
    const res = await POST(makeRequest() as never)
    expect(res.status).toBe(500)
  })
})
