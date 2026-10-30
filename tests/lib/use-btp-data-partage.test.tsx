// tests/lib/use-btp-data-partage.test.tsx — lot 8 Sentry du 28/10/2026 : une seule requête /api/btp par table en
// vol, partagée entre prefetchBTPTables (chargement du dashboard) et les sections qui montent juste après.
// Relecture de la PR #581 : après une écriture (ajout, modification, suppression), refresh ne réutilise pas un GET
// parti avant elle, et la réponse périmée de ce GET ne remplit ni la liste ni le cache.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))

import { prefetchBTPTables, useBTPData } from '@/lib/hooks/use-btp-data'

let resoudre: Array<() => void>

beforeEach(() => {
  resoudre = []
  vi.spyOn(globalThis, 'fetch').mockImplementation((url) => new Promise((ok) => {
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    resoudre.push(() => ok(new Response(JSON.stringify({ [table]: [{ id: `${table}-1`, nom: 'A' }] }), { status: 200 })))
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

const appels = () => vi.mocked(fetch).mock.calls.map(([u]) => new URL(String(u), 'https://vitfix.io').searchParams.get('table'))

describe('use-btp-data — requêtes en vol partagées', () => {
  it('prefetch puis montage d’une section sur la même table : une seule requête', async () => {
    const userId = `u-${Date.now()}`
    const prechargement = prefetchBTPTables(['chantiers', 'membres'], userId)
    const { result } = renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'a1', userId, autoImport: false }))

    await waitFor(() => expect(resoudre.length).toBe(2))
    expect(appels()).toEqual(['chantiers', 'membres'])

    resoudre.forEach((r) => r())
    await prechargement
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(appels()).toEqual(['chantiers', 'membres'])
  })

  it('deux sections sur la même table en même temps : une seule requête', async () => {
    const userId = `v-${Date.now()}`
    const a = renderHook(() => useBTPData({ table: 'situations', artisanId: 'a1', userId, autoImport: false }))
    const b = renderHook(() => useBTPData({ table: 'situations', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(resoudre.length).toBe(1))
    resoudre[0]()
    await waitFor(() => expect(a.result.current.loading).toBe(false))
    await waitFor(() => expect(b.result.current.loading).toBe(false))
    expect(appels()).toEqual(['situations'])
    expect(b.result.current.items).toEqual(a.result.current.items)
  })
})

describe('use-btp-data — écriture pendant un GET en vol', () => {
  type GetRetenu = { repondre: (lignes: Array<Record<string, unknown>>) => void }
  let gets: GetRetenu[]

  beforeEach(() => {
    gets = []
    // GET retenus jusqu'à ce que le test réponde ; écritures (POST /api/btp) confirmées tout de suite.
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (init?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 }))
      const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
      return new Promise((ok) => {
        gets.push({ repondre: (lignes) => ok(new Response(JSON.stringify({ [table]: lignes }), { status: 200 })) })
      })
    })
  })

  const ids = (lignes: Array<{ id: string }>) => lignes.map((l) => l.id)
  const usePointages = (userId: string) => useBTPData<{ id: string }>({ table: 'pointages', artisanId: 'a1', userId, autoImport: false })

  /** Liste chargée (p-1, p-2), puis un GET part (retour sur l'onglet, autre section) et p-1 est supprimé pendant ce temps. */
  async function suppressionPendantUnGet(userId: string) {
    const vue = renderHook(() => usePointages(userId))
    await waitFor(() => expect(gets).toHaveLength(1))
    gets[0].repondre([{ id: 'p-1' }, { id: 'p-2' }])
    await waitFor(() => expect(ids(vue.result.current.items)).toEqual(['p-1', 'p-2']))

    const chargement = vue.result.current.refresh()
    await waitFor(() => expect(gets).toHaveLength(2))
    const suppression = vue.result.current.remove('p-1')
    // Le refresh de la suppression lance son propre GET au lieu de réutiliser celui parti avant elle.
    await waitFor(() => expect(gets).toHaveLength(3))
    return { vue, chargement, suppression }
  }

  it('réponse périmée arrivée après la fraîche : ni la liste ni le cache ne reprennent l’élément supprimé', async () => {
    const userId = `w-${Date.now()}`
    const { vue, chargement, suppression } = await suppressionPendantUnGet(userId)

    gets[2].repondre([{ id: 'p-2' }])
    expect(await suppression).toBe(true)
    await waitFor(() => expect(ids(vue.result.current.items)).toEqual(['p-2']))

    // Le GET parti avant la suppression répond en dernier.
    await act(async () => {
      gets[1].repondre([{ id: 'p-1' }, { id: 'p-2' }])
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(ids(vue.result.current.items)).toEqual(['p-2'])
    // Cache : une section qui monte maintenant part de p-2 seul, sans requête (cache frais).
    const autre = renderHook(() => usePointages(userId))
    expect(ids(autre.result.current.items)).toEqual(['p-2'])

    // Les appelants de la réponse périmée rechargent la génération courante (GET déjà terminé : nouvelle requête).
    expect(gets).toHaveLength(4)
    gets[3].repondre([{ id: 'p-2' }])
    await chargement
    await waitFor(() => expect(ids(vue.result.current.items)).toEqual(['p-2']))
    expect(gets).toHaveLength(4)
  })

  it('réponse périmée arrivée avant la fraîche : elle est écartée, sans requête de plus', async () => {
    const userId = `y-${Date.now()}`
    const { vue, chargement, suppression } = await suppressionPendantUnGet(userId)

    // Le GET parti avant la suppression répond le premier : écarté, ses appelants attendent le GET de la suppression.
    await act(async () => {
      gets[1].repondre([{ id: 'p-1' }, { id: 'p-2' }])
      await new Promise((r) => setTimeout(r, 20))
    })
    expect(gets).toHaveLength(3)
    gets[2].repondre([{ id: 'p-2' }])
    expect(await suppression).toBe(true)
    await chargement
    await waitFor(() => expect(ids(vue.result.current.items)).toEqual(['p-2']))
    expect(gets).toHaveLength(3)
    const autre = renderHook(() => usePointages(userId))
    expect(ids(autre.result.current.items)).toEqual(['p-2'])
  })

  it('sans écriture entre eux, deux chargements concurrents partagent toujours un seul GET, avant comme après une écriture', async () => {
    const userId = `z-${Date.now()}`
    const a = renderHook(() => useBTPData({ table: 'membres', artisanId: 'a1', userId, autoImport: false }))
    const b = renderHook(() => useBTPData({ table: 'membres', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(gets).toHaveLength(1))
    gets[0].repondre([{ id: 'm-1' }])
    await waitFor(() => expect(b.result.current.loading).toBe(false))

    const ajout = a.result.current.add({ nom: 'Nouveau' })
    await waitFor(() => expect(gets).toHaveLength(2))
    const rechargement = b.result.current.refresh()
    gets[1].repondre([{ id: 'm-1' }, { id: 'm-2' }])
    await Promise.all([ajout, rechargement])
    expect(gets).toHaveLength(2)
    await waitFor(() => expect(b.result.current.items).toHaveLength(2))
  })
})
