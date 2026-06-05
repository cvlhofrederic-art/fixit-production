import { describe, it, expect, vi, beforeEach } from 'vitest'

// FR-V1 — Tests POST /api/document-cancel
// Vérifie : auth, validation Zod, ownership (via natural key), guard transition,
// soft cancel UPDATE, déjà annulé idempotent.

const mockUpdate = vi.fn()
const mockSelectByNumero = vi.fn()
const mockFrom = vi.fn().mockImplementation(() => ({
  // SELECT chain : .select(...).eq('numero', X).eq('artisan_user_id', Y).maybeSingle()
  select: () => ({
    eq: () => ({
      eq: () => ({
        maybeSingle: () => mockSelectByNumero(),
      }),
    }),
  }),
  // UPDATE chain : .update(...).eq('id', X).eq('artisan_user_id', Y)
  update: (payload: unknown) => ({
    eq: () => ({
      eq: () => mockUpdate(payload),
    }),
  }),
}))

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
  addBreadcrumb: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const ARTISAN_USER_ID = '00000000-0000-4000-8000-000000000001'

function makeRequest(body: unknown, withAuth = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (withAuth) headers.Authorization = 'Bearer fake-token'
  return new Request('http://localhost:3000/api/document-cancel', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

describe('POST /api/document-cancel', () => {
  beforeEach(() => {
    vi.resetModules()
    mockGetAuthUser.mockReset()
    mockCheckRateLimit.mockReset()
    mockUpdate.mockReset()
    mockSelectByNumero.mockReset()
    mockFrom.mockClear()
  })

  it('returns 401 without auth', async () => {
    mockGetAuthUser.mockResolvedValue(null)
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Erreur de saisie client' }, false) as never)
    expect(res.status).toBe(401)
  })

  it('returns 429 when rate-limited', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(false)
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Erreur de saisie client' }) as never)
    expect(res.status).toBe(429)
  })

  it('returns 400 on invalid Zod payload (reason too short)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'oops' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid docType', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'avoir', numero: 'AV-2026-001', reason: 'Test bypass' }) as never)
    expect(res.status).toBe(400)
  })

  it('returns 404 when doc not found', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockSelectByNumero.mockResolvedValue({ data: null, error: null })
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-NONEXISTENT', reason: 'Cancel inexistant' }) as never)
    expect(res.status).toBe(404)
  })

  it('returns 409 when doc already cancelled', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockSelectByNumero.mockResolvedValue({
      data: {
        id: 'doc-uuid', status: 'cancelled', artisan_user_id: ARTISAN_USER_ID,
        numero: 'DEV-2026-001', cancelled_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Tentative double cancel' }) as never)
    expect(res.status).toBe(409)
  })

  it('returns 409 when transition not allowed (cancelled → cancelled blocked even by guard)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // Status terminal but cancelled_at not set (edge case) → canTransition refuses
    mockSelectByNumero.mockResolvedValue({
      data: {
        id: 'doc-uuid', status: 'expired', artisan_user_id: ARTISAN_USER_ID,
        numero: 'DEV-2026-001', cancelled_at: null,
      },
      error: null,
    })
    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Annulation devis expiré' }) as never)
    expect(res.status).toBe(409)
  })

  it('returns 200 + updates fields on happy path (sent → cancelled)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockSelectByNumero.mockResolvedValue({
      data: {
        id: 'doc-uuid', status: 'sent', artisan_user_id: ARTISAN_USER_ID,
        numero: 'DEV-2026-001', cancelled_at: null,
      },
      error: null,
    })
    mockUpdate.mockResolvedValue({ error: null })

    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Erreur de client, à refaire' }) as never)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json).toMatchObject({ id: 'doc-uuid', table: 'devis', numero: 'DEV-2026-001' })
    expect(json.cancelled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Vérifie que le payload UPDATE contient les bons champs
    const [payload] = mockUpdate.mock.calls[0]
    expect(payload).toMatchObject({
      status: 'cancelled',
      cancelled_reason: 'Erreur de client, à refaire',
      cancelled_by_user_id: ARTISAN_USER_ID,
    })
    expect(payload.cancelled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('returns 200 on facture cancellation paid → cancelled', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockSelectByNumero.mockResolvedValue({
      data: {
        id: 'fact-uuid', status: 'paid', artisan_user_id: ARTISAN_USER_ID,
        numero: 'FACT-2026-005', cancelled_at: null,
      },
      error: null,
    })
    mockUpdate.mockResolvedValue({ error: null })

    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'facture', numero: 'FACT-2026-005', reason: 'Avoir émis suite à correction' }) as never)
    expect(res.status).toBe(200)
  })

  it('returns 500 on UPDATE error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockSelectByNumero.mockResolvedValue({
      data: {
        id: 'doc-uuid', status: 'sent', artisan_user_id: ARTISAN_USER_ID,
        numero: 'DEV-2026-001', cancelled_at: null,
      },
      error: null,
    })
    mockUpdate.mockResolvedValue({ error: { message: 'connection failed' } })

    const { POST } = await import('@/app/api/document-cancel/route')
    const res = await POST(makeRequest({ docType: 'devis', numero: 'DEV-2026-001', reason: 'Test 500 error' }) as never)
    expect(res.status).toBe(500)
  })
})
