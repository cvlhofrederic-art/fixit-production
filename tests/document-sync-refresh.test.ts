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

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
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
