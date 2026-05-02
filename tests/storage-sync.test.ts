// Tests unitaires pour la sync localStorage <-> user_storage.
// Ces tests verifient le contrat critique : aucune cle fixit_* ne doit
// etre perdue lors d'un changement d'appareil ou d'un nettoyage du
// navigateur. C'est la garantie "SaaS pro" reclamee par l'utilisateur.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @supabase/supabase-js avant l'import du module sous test.
const mockGetSession = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}))

// Mock fetch global pour intercepter les appels API.
const mockFetch = vi.fn()
;(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch

// Helpers
const FAKE_TOKEN = 'fake-jwt-token-for-tests'
const validSession = () => ({ data: { session: { access_token: FAKE_TOKEN } } })

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules() // reimport propre du module a chaque test (le singleton `installed`)
  mockGetSession.mockResolvedValue(validSession())
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
  if (typeof window !== 'undefined') {
    window.localStorage.clear()
  }
})

describe('storage-sync — hydratation', () => {
  it('hydrate restaure le localStorage depuis la DB', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({
        entries: {
          fixit_absences_abc: [{ date: '2026-01-15', motif: 'CP' }],
          fixit_modules_artisan_abc: ['planning', 'devis'],
        },
      }), { status: 200 })
    )

    const { hydrateStorageFromServer } = await import('@/lib/storage-sync')
    const result = await hydrateStorageFromServer()

    expect(result.count).toBe(2)
    expect(JSON.parse(window.localStorage.getItem('fixit_absences_abc')!))
      .toEqual([{ date: '2026-01-15', motif: 'CP' }])
    expect(JSON.parse(window.localStorage.getItem('fixit_modules_artisan_abc')!))
      .toEqual(['planning', 'devis'])
  })

  it('hydrate ne fait rien si pas de session', async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } })
    const { hydrateStorageFromServer } = await import('@/lib/storage-sync')
    const result = await hydrateStorageFromServer()
    expect(result.count).toBe(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('hydrate tolere une erreur reseau sans planter', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network error'))
    const { hydrateStorageFromServer } = await import('@/lib/storage-sync')
    const result = await hydrateStorageFromServer()
    expect(result.count).toBe(0)
  })
})

describe('storage-sync — push initial', () => {
  it('pushAllLocalToServer envoie toutes les cles fixit_* en batch', async () => {
    window.localStorage.setItem('fixit_absences_abc', JSON.stringify([{ date: '2026-01-15' }]))
    window.localStorage.setItem('fixit_modules_artisan_abc', JSON.stringify(['planning']))
    window.localStorage.setItem('autre_app_state', 'should not be synced')
    // Flag de migration : ignore par shouldSync
    window.localStorage.setItem('fixit_user_storage_migrated_v1', 'flag')

    const { pushAllLocalToServer } = await import('@/lib/storage-sync')
    await pushAllLocalToServer()

    const postCall = mockFetch.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall).toBeDefined()
    const body = JSON.parse(postCall![1].body as string)
    const keys = body.entries.map((e: { key: string }) => e.key)
    expect(keys).toContain('fixit_absences_abc')
    expect(keys).toContain('fixit_modules_artisan_abc')
    expect(keys).not.toContain('autre_app_state')
    expect(keys).not.toContain('fixit_user_storage_migrated_v1')
  })

  it('pushAllLocalToServer ignore les cles depassant la taille max', async () => {
    // jsdom plafonne le localStorage a 5 MB ; on mock localStorage pour
    // simuler une cle trop volumineuse sans heurter le quota du runtime.
    const hugeJson = JSON.stringify({ data: 'x'.repeat(5_500_000) })
    const fakeStore = new Map<string, string>([
      ['fixit_huge_data_abc', hugeJson],
      ['fixit_normal_abc', 'ok'],
    ])
    const proxy: Storage = {
      get length() { return fakeStore.size },
      key: (i: number) => Array.from(fakeStore.keys())[i] ?? null,
      getItem: (k: string) => fakeStore.get(k) ?? null,
      setItem: (k: string, v: string) => { fakeStore.set(k, v) },
      removeItem: (k: string) => { fakeStore.delete(k) },
      clear: () => { fakeStore.clear() },
    }
    Object.defineProperty(window, 'localStorage', { value: proxy, configurable: true })

    const { pushAllLocalToServer } = await import('@/lib/storage-sync')
    await pushAllLocalToServer()

    const postCall = mockFetch.mock.calls.find(c => c[1]?.method === 'POST')
    expect(postCall).toBeDefined()
    const body = JSON.parse(postCall![1].body as string)
    const keys = body.entries.map((e: { key: string }) => e.key)
    expect(keys).toContain('fixit_normal_abc')
    expect(keys).not.toContain('fixit_huge_data_abc')
  })
})

describe('storage-sync — interception localStorage', () => {
  it("installStorageSync mirror chaque setItem fixit_* vers l'API", async () => {
    const { installStorageSync } = await import('@/lib/storage-sync')
    installStorageSync()

    window.localStorage.setItem('fixit_test_key', JSON.stringify({ foo: 'bar' }))

    // Le debounce est de 500 ms
    await new Promise(r => setTimeout(r, 700))

    const postCalls = mockFetch.mock.calls.filter(c => c[1]?.method === 'POST')
    expect(postCalls.length).toBeGreaterThan(0)
    const body = JSON.parse(postCalls[0][1].body as string)
    expect(body.entries[0].key).toBe('fixit_test_key')
    expect(body.entries[0].value).toEqual({ foo: 'bar' })
  })

  it("installStorageSync n'envoie pas les cles non-fixit", async () => {
    const { installStorageSync } = await import('@/lib/storage-sync')
    installStorageSync()

    window.localStorage.setItem('autre_app', 'value')
    window.localStorage.setItem('sb-auth-token', 'token-secret')

    await new Promise(r => setTimeout(r, 700))

    const postCalls = mockFetch.mock.calls.filter(c => c[1]?.method === 'POST')
    expect(postCalls.length).toBe(0)
  })
})
