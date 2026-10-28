// tests/lib/use-btp-data-partage.test.tsx — lot 8 Sentry du 28/10/2026 : une seule requête /api/btp par table en
// vol, partagée entre prefetchBTPTables (chargement du dashboard) et les sections qui montent juste après.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

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
