import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────
const mockUpsert = vi.fn()
// Ownership query mock : par défaut, retourne le profil artisan correspondant
// au user.id (le test peut overrider via mockOwnershipResult).
const mockOwnershipResult = vi.fn()
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'profiles_artisan') {
    return {
      select: () => ({
        eq: () => mockOwnershipResult(),
      }),
    }
  }
  return {
    upsert: (...args: unknown[]) => ({
      select: () => ({
        single: () => mockUpsert(...args),
      }),
    }),
  }
})

vi.mock('@/lib/supabase-server', () => ({
  supabaseAdmin: { from: mockFrom },
}))

const mockGetAuthUser = vi.fn()
vi.mock('@/lib/auth-helpers', () => ({
  getAuthUser: (req: unknown) => mockGetAuthUser(req),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  rateLimitResponse: () =>
    new Response(JSON.stringify({ error: 'Too many requests' }), { status: 429 }),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}))

vi.mock('@/lib/devis-totals', () => ({
  computeDocumentTotalHtCents: vi.fn().mockReturnValue(12345),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

// ── Helpers ───────────────────────────────────────────────────────────────
const ARTISAN_USER_ID = '00000000-0000-4000-8000-000000000001'
const ARTISAN_ID = '00000000-0000-4000-8000-000000000002'

function makeRequest(body: unknown, withAuth = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (withAuth) headers.Authorization = 'Bearer fake-token'
  return new Request('http://localhost:3000/api/devis/sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

const validDoc = {
  docNumber: 'DEV-2026-001',
  docType: 'devis',
  clientName: 'Client Test',
  clientEmail: 'client@test.fr',
  status: 'brouillon',
  lines: [{ description: 'Travaux', quantity: 1, unit_price_cents: 12345 }],
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe('POST /api/devis/sync', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetAuthUser.mockReset()
    mockCheckRateLimit.mockReset()
    mockUpsert.mockReset()
    mockFrom.mockClear()
    // Par défaut : ownership check OK (user possède bien artisanId)
    mockOwnershipResult.mockReset()
    mockOwnershipResult.mockResolvedValue({ data: [{ id: ARTISAN_ID }], error: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
  })

  it('returns 401 without auth header', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }, false) as never)
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate-limited', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(false)
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(429)
  })

  it('returns 400 when docType invalid', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'invalid', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 403 when artisanId does not belong to authenticated user', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // Ownership check retourne uniquement d'autres artisans (pas ARTISAN_ID)
    mockOwnershipResult.mockResolvedValueOnce({
      data: [{ id: '11111111-1111-4000-8000-000000000099' }],
      error: null,
    })
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Forbidden/i)
  })

  it('returns 400 when artisanId not UUID', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: 'not-a-uuid', doc: validDoc }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 when docNumber missing', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/devis/sync/route')
    const docNoNumber = { ...validDoc, docNumber: '' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: docNoNumber }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 200 + id on devis happy path with status mapping', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: { id: 'row-uuid-1' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toMatchObject({ id: 'row-uuid-1', table: 'devis', numero: 'DEV-2026-001' })

    // Verify upsert was called with mapped status (brouillon -> draft for devis)
    expect(mockFrom).toHaveBeenCalledWith('devis')
    const [payload, opts] = mockUpsert.mock.calls[0]
    expect(payload.status).toBe('draft')
    expect(payload.artisan_user_id).toBe(ARTISAN_USER_ID)
    expect(payload.numero).toBe('DEV-2026-001')
    expect(opts).toMatchObject({ onConflict: 'numero,artisan_user_id' })
  })

  it('routes to factures table when docType = facture', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: { id: 'row-uuid-2' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const facDoc = { ...validDoc, docNumber: 'FAC-2026-001', status: 'paye' }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: facDoc }) as never)
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('factures')
    const [payload] = mockUpsert.mock.calls[0]
    expect(payload.status).toBe('paid') // mapping facture
  })

  it('returns 500 + Sentry capture on Supabase error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: null, error: { message: 'permission denied for table devis' } })

    const Sentry = await import('@sentry/nextjs')
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Sync failed')
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it('falls back legacy when raw_data column missing', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert
      .mockResolvedValueOnce({ data: null, error: { message: 'column "raw_data" does not exist' } })
      .mockResolvedValueOnce({ data: { id: 'row-uuid-3' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(2)
    // Second call should not have raw_data
    const [legacyPayload] = mockUpsert.mock.calls[1]
    expect(legacyPayload).not.toHaveProperty('raw_data')
  })

  it('returns 400 on invalid JSON body', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/devis/sync/route')
    const req = new Request('http://localhost:3000/api/devis/sync', {
      method: 'POST',
      body: 'not json{{',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    })
    const res = await POST(req as never)
    expect(res.status).toBe(400)
  })
})
