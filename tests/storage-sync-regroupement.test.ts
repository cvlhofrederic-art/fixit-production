// tests/storage-sync-regroupement.test.ts — lot 8 Sentry du 28/10/2026 : moins de requêtes /api/user-storage.
//   - l'hydratation depuis le serveur n'est jamais renvoyée en POST ;
//   - une valeur identique à la dernière synchronisée n'est pas renvoyée ;
//   - les clés modifiées d'un même enchaînement partent en un seul POST (jusqu'à 50 clés / 4 Mo).
// jsdom ne permet pas de remplacer localStorage.setItem (propriété nommée du Storage) : le cœur du miroir
// (enregistrerEcritureMiroir, appelé par le setItem intercepté dans les navigateurs) est appelé directement.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const mockGetSession = vi.fn()
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: mockGetSession } } }))

const originalFetch = globalThis.fetch
const mockFetch = vi.fn()
const FAKE_TOKEN = 'jeton-de-test'

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockGetSession.mockResolvedValue({ data: { session: { access_token: FAKE_TOKEN } } })
  mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true }), { status: 200 }))
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch
  window.localStorage.clear()
})

afterEach(() => {
  mockGetSession.mockResolvedValue({ data: { session: null } })
  ;(globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch
})

const attendreFlush = () => new Promise((r) => setTimeout(r, 1700))
const appelsPost = () => mockFetch.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
const corps = (appel: unknown[]) => JSON.parse((appel[1] as RequestInit).body as string) as { entries: Array<{ key: string; value: unknown }> }

describe('storage-sync — hydratation sans renvoi', () => {
  it('les valeurs reçues du serveur ne repartent pas en POST ; une valeur identique non plus ; une autre, oui', async () => {
    mockFetch.mockImplementation(async (_url: unknown, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return new Response(JSON.stringify({ entries: { fixit_clients_x: [{ id: 1 }], fixit_prefs: 'sombre' } }), { status: 200 })
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    const { installStorageSync, hydrateStorageFromServer, enregistrerEcritureMiroir } = await import('@/lib/storage-sync')
    installStorageSync()
    const resultat = await hydrateStorageFromServer()
    expect(resultat.count).toBe(2)
    expect(window.localStorage.getItem('fixit_prefs')).toBe('sombre')

    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)

    // Réécriture de la même valeur par l'application : rien à envoyer.
    enregistrerEcritureMiroir('fixit_prefs', 'sombre')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)

    // Valeur différente : envoyée.
    enregistrerEcritureMiroir('fixit_prefs', 'clair')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    expect(corps(appelsPost()[0]).entries).toEqual([{ key: 'fixit_prefs', value: 'clair' }])
  })
})

describe('storage-sync — un seul POST par enchaînement', () => {
  it('25 clés écrites au montage partent dans un seul POST, avec le Bearer', async () => {
    const { enregistrerEcritureMiroir } = await import('@/lib/storage-sync')
    for (let i = 0; i < 25; i++) enregistrerEcritureMiroir(`fixit_cle_${i}`, JSON.stringify({ i }))
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    expect(corps(appelsPost()[0]).entries).toHaveLength(25)
    expect(((appelsPost()[0][1] as RequestInit).headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it('au-delà de 50 clés, ou de 4 Mo, le flush se découpe en plusieurs POST', async () => {
    const { enregistrerEcritureMiroir } = await import('@/lib/storage-sync')
    for (let i = 0; i < 60; i++) enregistrerEcritureMiroir(`fixit_cle_${i}`, String(i))
    await attendreFlush()
    expect(appelsPost().map((a) => corps(a).entries.length)).toEqual([50, 10])

    mockFetch.mockClear()
    enregistrerEcritureMiroir('fixit_gros_1', JSON.stringify({ d: 'x'.repeat(3_000_000) }))
    enregistrerEcritureMiroir('fixit_gros_2', JSON.stringify({ d: 'y'.repeat(3_000_000) }))
    await attendreFlush()
    expect(appelsPost().map((a) => corps(a).entries.length)).toEqual([1, 1])
  })

  it('une valeur envoyée avec succès puis réécrite à l’identique n’est pas renvoyée ; après suppression, si', async () => {
    const { enregistrerEcritureMiroir, enregistrerSuppressionMiroir } = await import('@/lib/storage-sync')
    enregistrerEcritureMiroir('fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    enregistrerEcritureMiroir('fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(1)
    enregistrerSuppressionMiroir('fixit_a')
    enregistrerEcritureMiroir('fixit_a', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(2)
    expect(corps(appelsPost()[1]).entries).toEqual([{ key: 'fixit_a', value: 1 }])
  })

  it('les clés hors fixit_ et les drapeaux transitoires ne sont jamais envoyés', async () => {
    const { enregistrerEcritureMiroir } = await import('@/lib/storage-sync')
    enregistrerEcritureMiroir('sb-auth-token', 'secret')
    enregistrerEcritureMiroir('fixit_clean_v6_x', '1')
    enregistrerEcritureMiroir('fixit_user_storage_migrated_v1', '1')
    await attendreFlush()
    expect(appelsPost()).toHaveLength(0)
  })
})
