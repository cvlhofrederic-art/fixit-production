// tests/document-sync-refresh.test.ts — Vérifie le flow refresh+retry+contextual
// toasts du client-side sync (plan magical-mapping-karp Phase 2).
//
// Cas couverts :
//  - session absente → SyncResult kind=no-session, pas de fetch
//  - 401 → 1× refresh + 1× retry, puis kind=auth si encore 401
//  - 5xx → retry exponentiel (3 tentatives au total)
//  - 200 → ok:true
//  - 409 → kind=conflict (pas de retry)

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const getSession = vi.fn()
const refreshSession = vi.fn()
const getUser = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSession(...args),
      refreshSession: (...args: unknown[]) => refreshSession(...args),
      getUser: (...args: unknown[]) => getUser(...args),
    },
    from: vi.fn(),
  },
}))

// Renumérotation : mock de fetchNextDocNumber (séquence serveur) pour le test du
// filet anti-collision côté client (syncDocumentSafe doit renuméroter et resync).
const mockFetchNextDocNumber = vi.fn()
vi.mock('@/lib/doc-number', () => ({
  fetchNextDocNumber: (...args: unknown[]) => mockFetchNextDocNumber(...args),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const NOW_SEC = Math.floor(Date.now() / 1000)

function freshSession(token = 'token-A') {
  return { session: { access_token: token, expires_at: NOW_SEC + 3600 } }
}

function nearExpirySession(token = 'token-expiring') {
  return { session: { access_token: token, expires_at: NOW_SEC + 30 } } // < 60s → refresh
}

describe('syncDocumentToSupabase — refresh + retry', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    getSession.mockReset()
    refreshSession.mockReset()
  })

  it('retourne no-session si pas de session', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } })
    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'no-session' }))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refresh préventif si expires_at < 60s', async () => {
    getSession.mockResolvedValueOnce({ data: nearExpirySession('old-token') })
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'new-token' } },
      error: null,
    })
    mockFetch.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ id: 'row-1', numero: 'D-001' }),
    })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
    // Vérifie qu'on a utilisé le nouveau token
    const headers = (mockFetch.mock.calls[0]![1] as { headers: Record<string, string> }).headers
    expect(headers.Authorization).toBe('Bearer new-token')
  })

  it('retry 1× après 401 puis refresh', async () => {
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockResolvedValueOnce({ status: 401, text: async () => 'expired' })
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token-B' } },
      error: null,
    })
    mockFetch.mockResolvedValueOnce({
      status: 200,
      text: async () => JSON.stringify({ id: 'row-1' }),
    })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(refreshSession).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(true)
  })

  it('renvoie kind=auth si 401 même après refresh', async () => {
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockResolvedValueOnce({ status: 401, text: async () => 'expired' })
    refreshSession.mockResolvedValueOnce({
      data: { session: { access_token: 'token-B' } },
      error: null,
    })
    mockFetch.mockResolvedValueOnce({ status: 401, text: async () => 'still expired' })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'auth', status: 401 }))
  })

  it('renvoie kind=conflict sur 409 sans retry', async () => {
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockResolvedValueOnce({
      status: 409,
      text: async () => JSON.stringify({ error: 'Invalid transition' }),
    })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'conflict', status: 409 }))
  })

  it('renvoie kind=forbidden sur 403', async () => {
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockResolvedValueOnce({ status: 403, text: async () => 'forbidden' })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'forbidden', status: 403 }))
  })

  it('retry exponentiel sur 5xx (3 tentatives au total)', async () => {
    vi.useFakeTimers()
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch
      .mockResolvedValueOnce({ status: 500, text: async () => 'oops' })
      .mockResolvedValueOnce({ status: 503, text: async () => 'still oops' })
      .mockResolvedValueOnce({ status: 200, text: async () => '{}' })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const promise = syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    await vi.runAllTimersAsync()
    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result.ok).toBe(true)
    vi.useRealTimers()
  })

  it('renvoie kind=server si 5xx persiste après 3 tentatives', async () => {
    vi.useFakeTimers()
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockResolvedValue({ status: 500, text: async () => 'down' })

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const promise = syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    await vi.runAllTimersAsync()
    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'server', status: 500 }))
    vi.useRealTimers()
  })

  it('renvoie kind=network si fetch throw', async () => {
    getSession.mockResolvedValueOnce({ data: freshSession('token-A') })
    mockFetch.mockRejectedValueOnce(new Error('offline'))

    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docNumber: 'D-001', docType: 'devis' }, 'artisan-1')

    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'network', status: 0 }))
  })

  it('rejette docNumber manquant en kind=validation', async () => {
    const { syncDocumentToSupabase } = await import('../lib/document-sync')
    const result = await syncDocumentToSupabase({ docType: 'devis' }, 'artisan-1')
    expect(result).toEqual(expect.objectContaining({ ok: false, kind: 'validation' }))
    expect(mockFetch).not.toHaveBeenCalled()
  })
})

// ── Filet anti-collision : 409 { numero_collision } → renumérote + resync 1× ──
// Cause racine du bug « doc qui disparaît » : un device neuf retombait sur le
// fallback localStorage et émettait FACT-2026-001 alors qu'un FACT-2026-001
// PAYÉ existait déjà en base (autre doc) → 409 → l'ancien code DROPPAIT le doc.
// syncDocumentSafe doit désormais : tirer un nouveau numéro (fetchNextDocNumber),
// réécrire docNumber/numero en localStorage ET en mémoire, retenter UNE fois.
describe('syncDocumentSafe — renumérotation sur collision de numéro', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    getSession.mockReset()
    refreshSession.mockReset()
    mockFetchNextDocNumber.mockReset()
    localStorage.clear()
    getSession.mockResolvedValue({ data: freshSession('token-A') })
  })

  function collisionResponse() {
    return { status: 409, text: async () => JSON.stringify({ error: 'numero_collision' }) }
  }

  it('renumérote le doc et resync une fois après numero_collision (doc NON perdu)', async () => {
    const ARTISAN = 'artisan-collide'
    const doc: Record<string, unknown> = {
      id: '11111111-1111-4111-8111-111111111111',
      docType: 'facture',
      docNumber: 'FACT-2026-001',
      status: 'envoye',
    }
    // Le doc est déjà persisté en localStorage (comme après saveAndSend).
    localStorage.setItem(`fixit_documents_${ARTISAN}`, JSON.stringify([{ ...doc }]))

    // 1er sync → collision ; 2e sync (après renumérotation) → 200.
    mockFetch
      .mockResolvedValueOnce(collisionResponse())
      .mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify({ id: 'row-1', numero: 'FACT-2026-007' }) })
    mockFetchNextDocNumber.mockResolvedValue('FACT-2026-007')

    const { syncDocumentSafe } = await import('../lib/document-sync')
    await syncDocumentSafe(doc, ARTISAN)

    // fetchNextDocNumber appelé avec le bon type + artisanId
    expect(mockFetchNextDocNumber).toHaveBeenCalledWith('facture', ARTISAN)
    // Deux POST : l'échec puis le retry avec le nouveau numéro
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const secondBody = JSON.parse((mockFetch.mock.calls[1]![1] as { body: string }).body)
    expect(secondBody.doc.docNumber).toBe('FACT-2026-007')

    // Le doc en mémoire est renuméroté (pas perdu)
    expect(doc.docNumber).toBe('FACT-2026-007')

    // localStorage réécrit avec le nouveau numéro
    const stored = JSON.parse(localStorage.getItem(`fixit_documents_${ARTISAN}`) || '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].docNumber).toBe('FACT-2026-007')

    // Pas de toast de perte sur le chemin résolu (le doc est sauvé)
    const { toast } = await import('sonner')
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('toaste seulement si le retry après renumérotation échoue encore', async () => {
    const ARTISAN = 'artisan-collide-2'
    const doc: Record<string, unknown> = {
      id: '22222222-2222-4222-8222-222222222222',
      docType: 'facture',
      docNumber: 'FACT-2026-001',
      status: 'envoye',
    }
    localStorage.setItem(`fixit_documents_${ARTISAN}`, JSON.stringify([{ ...doc }]))

    // collision puis 500 persistant (retry exponentiel épuisé) sur le 2e numéro
    mockFetch
      .mockResolvedValueOnce(collisionResponse())
      .mockResolvedValue({ status: 500, text: async () => 'down' })
    mockFetchNextDocNumber.mockResolvedValue('FACT-2026-007')

    vi.useFakeTimers()
    const { syncDocumentSafe } = await import('../lib/document-sync')
    const p = syncDocumentSafe(doc, ARTISAN)
    await vi.runAllTimersAsync()
    await p
    vi.useRealTimers()

    // La renumérotation a bien eu lieu (doc renuméroté, jamais silencieusement perdu)
    expect(doc.docNumber).toBe('FACT-2026-007')
    // Mais comme le retry échoue, on surface un toast
    const { toast } = await import('sonner')
    expect(toast.error).toHaveBeenCalled()
  })
})
