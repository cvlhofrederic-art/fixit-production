import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────
const mockUpsert = vi.fn()
// Ownership query mocks (3 paths) :
//  - mockOwnershipDirect : profiles_artisan WHERE user_id = X (path A solo/gérant)
//  - mockMembershipResult : pro_team_members WHERE user_id = X (path B équipe)
//  - mockCompanyProfiles : profiles_artisan WHERE user_id IN (...) (path B résolu)
const mockOwnershipDirect = vi.fn()
const mockMembershipResult = vi.fn()
const mockCompanyProfiles = vi.fn()
// FR-V1 : status lookup avant upsert pour valider transition.
//   .from('devis').select('status').eq('numero',...).eq('artisan_user_id',...).maybeSingle()
const mockStatusLookup = vi.fn()
const mockFrom = vi.fn().mockImplementation((table: string) => {
  if (table === 'profiles_artisan') {
    return {
      select: () => ({
        eq: () => mockOwnershipDirect(),     // .eq('user_id', X)
        in: () => mockCompanyProfiles(),     // .in('user_id', companyIds)
      }),
    }
  }
  if (table === 'pro_team_members') {
    return {
      select: () => ({
        eq: () => ({
          eq: () => mockMembershipResult(),  // .eq('user_id').eq('is_active')
        }),
      }),
    }
  }
  // 'devis' ou 'factures' : supporte SELECT (status lookup) + UPSERT.
  // Le status lookup accepte deux chaînes d'identité :
  //   - id path     : .select().eq('id', x).maybeSingle()                    (1 eq)
  //   - numero path : .select().eq('numero',x).eq('artisan',y).maybeSingle() (2 eq)
  return {
    select: () => {
      const leaf = { maybeSingle: () => mockStatusLookup() }
      return { eq: () => ({ ...leaf, eq: () => leaf }) }
    },
    upsert: (...args: unknown[]) => ({
      select: () => ({
        single: () => mockUpsert(...args),
      }),
    }),
  }
})

// Backward-compat alias pour les tests existants qui n'ont pas connaissance
// du path team — c'est l'ownership direct (profil artisan solo/gérant).
const mockOwnershipResult = mockOwnershipDirect

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
  // `buildDocumentLines` est la source unique des lignes effectives —
  // appelée par route.ts:138 pour construire `items` (TVA, hash, payload DB).
  // Mock minimaliste : renvoie un tableau vide, suffisant pour les
  // assertions de transition / autorisation / mapping de status.
  buildDocumentLines: vi.fn().mockReturnValue([]),
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
    // Par défaut : ownership direct OK (user possède bien artisanId)
    mockOwnershipDirect.mockReset()
    mockOwnershipDirect.mockResolvedValue({ data: [{ id: ARTISAN_ID }], error: null })
    // Par défaut : pas de membership équipe (path A suffit)
    mockMembershipResult.mockReset()
    mockMembershipResult.mockResolvedValue({ data: [], error: null })
    mockCompanyProfiles.mockReset()
    mockCompanyProfiles.mockResolvedValue({ data: [], error: null })
    // FR-V1 default : aucun doc existant → status lookup retourne null
    mockStatusLookup.mockReset()
    mockStatusLookup.mockResolvedValue({ data: null, error: null, content_hash: null })
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon'
    // Hash chain skip par défaut (pas de DOC_HASH_SECRET en test)
    delete process.env.DOC_HASH_SECRET
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

  it('returns 403 when artisanId does not belong to authenticated user (no direct, no team)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // Path A : direct profil retourne d'autres artisans (pas ARTISAN_ID)
    mockOwnershipResult.mockResolvedValueOnce({
      data: [{ id: '11111111-1111-4000-8000-000000000099' }],
      error: null,
    })
    // Path B : aucun membership équipe non plus
    mockMembershipResult.mockResolvedValueOnce({ data: [], error: null })
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/Forbidden/i)
  })

  // ── IDOR : le chemin `docId` (upsert onConflict='id', supabaseAdmin, hors RLS) ──
  it('returns 403 when the document id (par UUID) appartient à un AUTRE artisan (IDOR guard)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // L'ownership de l'artisanId est OK (mockOwnershipDirect par défaut), MAIS le
    // document ciblé par son UUID existe déjà en base et appartient à un autre user.
    mockStatusLookup.mockResolvedValue({
      data: { status: 'sent', content_hash: null, artisan_user_id: '99999999-9999-4999-8999-999999999999' },
      error: null,
    })
    const { POST } = await import('@/app/api/devis/sync/route')
    const stolen = { ...validDoc, id: '12345678-1234-4123-8123-1234567890ab' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: stolen }) as never)
    expect(res.status).toBe(403)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('autorise le propriétaire à mettre à jour SON document (même artisan_user_id, pas 403)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({
      data: { status: 'draft', content_hash: null, artisan_user_id: ARTISAN_USER_ID },
      error: null,
    })
    mockUpsert.mockResolvedValue({ data: { id: '12345678-1234-4123-8123-1234567890ab' }, error: null })
    const { POST } = await import('@/app/api/devis/sync/route')
    const own = { ...validDoc, id: '12345678-1234-4123-8123-1234567890ab' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: own }) as never)
    expect(res.status).not.toBe(403)
  })

  it('returns 200 when user is a team member of the artisanId company (path B)', async () => {
    // Membre BTP (COMPTABLE/SECRETAIRE) — son user.id n'apparaît PAS dans
    // profiles_artisan mais bien dans pro_team_members.company_id
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const COMPANY_USER_ID = '99999999-9999-4000-8000-000000000001'
    // Path A : pas de profil artisan direct
    mockOwnershipResult.mockResolvedValueOnce({ data: [], error: null })
    // Path B : membership active dans la société COMPANY_USER_ID
    mockMembershipResult.mockResolvedValueOnce({
      data: [{ company_id: COMPANY_USER_ID }],
      error: null,
    })
    // Résolution : profil artisan de la company contient ARTISAN_ID
    mockCompanyProfiles.mockResolvedValueOnce({
      data: [{ id: ARTISAN_ID }],
      error: null,
    })
    mockUpsert.mockResolvedValueOnce({ data: { id: 'doc-uuid' }, error: null })
    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(200)
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

  // ══════════════════════════════════════════════════════════════════════
  // FR-V1 — Transition guards (art. 242 nonies CGI)
  // ══════════════════════════════════════════════════════════════════════
  it('returns 409 on invalid devis transition signed → draft', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({ data: { status: 'signed' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const docDraft = { ...validDoc, status: 'brouillon' } // → 'draft'
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: docDraft }) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/Invalid status transition/i)
    expect(json.current).toBe('signed')
    expect(json.incoming).toBe('draft')
  })

  it('returns 409 on invalid facture transition paid → pending', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({ data: { status: 'paid' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    // 'envoye' → 'pending' (méthode pro : 'brouillon' mappe désormais sur 'draft',
    // donc on teste l'émission paid → pending, transition arrière interdite).
    const docFact = { ...validDoc, docNumber: 'FACT-2026-001', status: 'envoye' } // → 'pending'
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: docFact }) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.current).toBe('paid')
    expect(json.incoming).toBe('pending')
  })

  // ── Filet de sécurité : collision de NUMÉRO entre deux documents DIFFÉRENTS ──
  // Cause racine du bug « doc qui disparaît » : un device sans numérotation
  // serveur retire un FACT-2026-001 déjà PAYÉ en base (autre id) → le sync voit
  // un paid→pending interdit (409) → l'ancien comportement DROPPAIT le nouveau
  // doc. Désormais on distingue : si la ligne existante porte un id DIFFÉRENT de
  // l'id stable entrant, c'est une collision de numéro → body { numero_collision }.
  it('returns 409 { numero_collision } when an existing row shares the numéro but has a DIFFERENT id', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // Ligne existante en base : FACT-2026-001 déjà payée, appartenant au même
    // artisan MAIS portant un id différent de celui du doc entrant.
    mockStatusLookup.mockResolvedValue({
      data: {
        id: '99999999-9999-4999-8999-999999999999',
        status: 'paid',
        content_hash: null,
        artisan_user_id: ARTISAN_USER_ID,
      },
      error: null,
    })

    const { POST } = await import('@/app/api/devis/sync/route')
    const incoming = {
      id: '11111111-1111-4111-8111-111111111111', // id stable DIFFÉRENT
      docType: 'facture',
      docNumber: 'FACT-2026-001',
      clientName: 'x',
      status: 'envoye', // → pending (transition arrière interdite vs paid)
    }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: incoming }) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toBe('numero_collision')
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('keeps the normal conflict body when the SAME id document hits an invalid transition', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const SAME_ID = '11111111-1111-4111-8111-111111111111'
    // Ligne existante = LE MÊME document (id identique) déjà payé.
    mockStatusLookup.mockResolvedValue({
      data: { id: SAME_ID, status: 'paid', content_hash: null, artisan_user_id: ARTISAN_USER_ID },
      error: null,
    })

    const { POST } = await import('@/app/api/devis/sync/route')
    const incoming = {
      id: SAME_ID,
      docType: 'facture',
      docNumber: 'FACT-2026-001',
      clientName: 'x',
      status: 'envoye', // → pending : vrai conflit de transition du même doc
    }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: incoming }) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/Invalid status transition/i)
    expect(json.current).toBe('paid')
    expect(json.incoming).toBe('pending')
  })

  it('legacy (id NON-UUID → identité par numéro) ne déclenche PAS numero_collision sur sa propre ligne', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // Ligne existante = la version DB du doc legacy (id serveur), retrouvée par numéro.
    mockStatusLookup.mockResolvedValue({
      data: { id: '99999999-9999-4999-8999-999999999999', status: 'paid', content_hash: null, artisan_user_id: ARTISAN_USER_ID },
      error: null,
    })
    const { POST } = await import('@/app/api/devis/sync/route')
    const incoming = {
      id: '1779539827817', // id LEGACY horodaté (non-UUID) → docId = null côté route
      docType: 'facture',
      docNumber: 'FACT-2026-001',
      clientName: 'x',
      status: 'envoye',
    }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: incoming }) as never)
    expect(res.status).toBe(409)
    const json = await res.json()
    // docId null (legacy) → PAS une collision de numéro : conflit de transition normal,
    // jamais une renumérotation à tort de sa propre ligne déjà synchronisée.
    expect(json.error).not.toBe('numero_collision')
    expect(json.error).toMatch(/Invalid status transition/i)
  })

  it('allows valid devis transition draft → sent', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({ data: { status: 'draft' }, error: null })
    mockUpsert.mockResolvedValue({ data: { id: 'row-uuid-trans' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const docSent = { ...validDoc, status: 'envoye' } // → 'sent'
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: docSent }) as never)
    expect(res.status).toBe(200)
    const [payload] = mockUpsert.mock.calls[0]
    expect(payload.status).toBe('sent')
  })

  it('allows same-status idempotent upsert (sent → sent)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({ data: { status: 'sent', content_hash: 'abc' }, error: null })
    mockUpsert.mockResolvedValue({ data: { id: 'row-uuid-idem' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const docSent = { ...validDoc, status: 'envoye' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: docSent }) as never)
    expect(res.status).toBe(200)
  })

  // FR-V1.1 — fix audit code-reviewer #2 : pas de catch silencieux sur SELECT error
  it('returns 500 when status lookup encounters a real DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockStatusLookup.mockResolvedValue({
      data: null,
      error: { message: 'connection terminated unexpectedly' },
    })

    const { POST } = await import('@/app/api/devis/sync/route')
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: validDoc }) as never)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('Status lookup failed')
    // Sentry doit être notifié pour qu'on puisse débugger
    const Sentry = await import('@sentry/nextjs')
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  // ══════════════════════════════════════════════════════════════════════
  // Méthode pro 2026 — identité stable `id` + brouillons sans numéro
  // ══════════════════════════════════════════════════════════════════════
  it('draft devis with stable id and no docNumber → 200, onConflict=id, numero null, status draft', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: { id: 'row-draft-1' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const draftDoc = {
      id: '00000000-0000-4000-8000-0000000000aa',
      docType: 'devis',
      docNumber: '',            // brouillon : pas de numéro légal
      clientName: 'Client Draft',
      status: 'brouillon',
    }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: draftDoc }) as never)
    expect(res.status).toBe(200)
    const [payload, opts] = mockUpsert.mock.calls[0]
    expect(opts).toMatchObject({ onConflict: 'id' })
    expect(payload.id).toBe('00000000-0000-4000-8000-0000000000aa')
    expect(payload.numero).toBeNull()
    expect(payload.status).toBe('draft')
  })

  it('facture brouillon maps to draft (not pending) and carries no numero', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: { id: 'row-fac-draft' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const facDraft = {
      id: '00000000-0000-4000-8000-0000000000bb',
      docType: 'facture',
      docNumber: '',
      clientName: 'Client Acompte',
      status: 'brouillon',
    }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: facDraft }) as never)
    expect(res.status).toBe(200)
    expect(mockFrom).toHaveBeenCalledWith('factures')
    const [payload, opts] = mockUpsert.mock.calls[0]
    expect(payload.status).toBe('draft')      // ← plus 'pending' : vrai brouillon, non hashé
    expect(payload.numero).toBeNull()
    expect(opts).toMatchObject({ onConflict: 'id' })
  })

  it('returns 400 when neither id nor docNumber provided (no identity)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    const { POST } = await import('@/app/api/devis/sync/route')
    const noIdentity = { docType: 'devis', docNumber: '', clientName: 'x', status: 'brouillon' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: noIdentity }) as never)
    expect(res.status).toBe(400)
  })

  it('legacy emitted doc (numero, no id) keeps numero-based onConflict', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    mockUpsert.mockResolvedValue({ data: { id: 'row-legacy' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const legacyDoc = { docType: 'devis', docNumber: 'DEV-2026-009', clientName: 'x', status: 'envoye' }
    const res = await POST(makeRequest({ docType: 'devis', artisanId: ARTISAN_ID, doc: legacyDoc }) as never)
    expect(res.status).toBe(200)
    const [payload, opts] = mockUpsert.mock.calls[0]
    expect(opts).toMatchObject({ onConflict: 'numero,artisan_user_id' })
    expect(payload.numero).toBe('DEV-2026-009')
    expect(payload).not.toHaveProperty('id')   // pas d'id client → pas injecté dans le payload
  })

  it('emits facture by id: draft→pending transition with numéro assigned', async () => {
    mockGetAuthUser.mockResolvedValue({ id: ARTISAN_USER_ID })
    mockCheckRateLimit.mockResolvedValue(true)
    // ligne existante (brouillon) retrouvée par id
    mockStatusLookup.mockResolvedValue({ data: { status: 'draft', content_hash: null }, error: null })
    mockUpsert.mockResolvedValue({ data: { id: 'row-emit' }, error: null })

    const { POST } = await import('@/app/api/devis/sync/route')
    const emitDoc = {
      id: '00000000-0000-4000-8000-0000000000cc',
      docType: 'facture',
      docNumber: 'FACT-2026-017',  // numéro attribué à l'émission
      clientName: 'x',
      status: 'envoye',            // → pending
    }
    const res = await POST(makeRequest({ docType: 'facture', artisanId: ARTISAN_ID, doc: emitDoc }) as never)
    expect(res.status).toBe(200)
    const [payload, opts] = mockUpsert.mock.calls[0]
    expect(payload.status).toBe('pending')
    expect(payload.numero).toBe('FACT-2026-017')
    expect(payload.id).toBe('00000000-0000-4000-8000-0000000000cc')
    expect(opts).toMatchObject({ onConflict: 'id' })
  })
})
