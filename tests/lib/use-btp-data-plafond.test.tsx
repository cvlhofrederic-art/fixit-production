// tests/lib/use-btp-data-plafond.test.tsx — liste BTP incomplète annoncée à l'écran (constat donnees-btp-10, 15/11/2026).
//
// GET /api/btp signale dans `plafondsAtteints` une liste coupée à son nombre maximal de lignes (500 pointages,
// 200 chantiers…). Le hook prévient alors l'utilisateur, une seule fois par liste et par session, quand une section
// qui l'affiche est à l'écran — y compris si la liste a été chargée d'avance par le tableau de bord.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

import { toast } from 'sonner'
import { prefetchBTPTables, signalerPlafondsAtteints, useBTPData } from '@/lib/hooks/use-btp-data'

/** Réponses du faux serveur par table : lignes et plafond signalé (absent : liste complète). */
let reponses: Record<string, { lignes: Array<{ id: string }>; plafond?: number }>

beforeEach(() => {
  reponses = {}
  vi.mocked(toast.warning).mockClear()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    const r = reponses[table] ?? { lignes: [] }
    const corps: Record<string, unknown> = { [table]: r.lignes }
    if (r.plafond) corps.plafondsAtteints = { [table]: r.plafond }
    return new Response(JSON.stringify(corps), { status: 200 })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const avertissements = () => vi.mocked(toast.warning).mock.calls.map(([message]) => String(message))

describe('useBTPData — liste incomplète', () => {
  it('pointages coupés à 500 : un avertissement clair, une seule fois même si une autre section les affiche', async () => {
    reponses.pointages = { lignes: [{ id: 'p-1' }], plafond: 500 }
    const userId = 'u-plafond-pointages'

    const a = renderHook(() => useBTPData({ table: 'pointages', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(a.result.current.loading).toBe(false))
    await waitFor(() => expect(avertissements()).toHaveLength(1))
    expect(avertissements()[0]).toMatch(/seuls les 500 pointages les plus récents sont affichés/)
    expect(avertissements()[0]).toMatch(/totaux/)

    const b = renderHook(() => useBTPData({ table: 'pointages', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(b.result.current.items).toHaveLength(1))
    expect(avertissements()).toHaveLength(1)
  })

  it('liste chargée d’avance par le tableau de bord : prévenu à l’affichage de la section, pas avant', async () => {
    reponses.situations = { lignes: [{ id: 's-1' }], plafond: 200 }
    const userId = 'u-plafond-situations'

    await prefetchBTPTables(['situations'], userId)
    expect(avertissements()).toHaveLength(0)

    renderHook(() => useBTPData({ table: 'situations', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(avertissements()).toHaveLength(1))
    expect(avertissements()[0]).toMatch(/seules les 200 situations de travaux les plus récentes sont affichées/)
  })

  it('liste complète : aucun avertissement', async () => {
    reponses.chantiers = { lignes: [{ id: 'c-1' }] }
    const userId = 'u-plafond-complet'

    const { result } = renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'a1', userId, autoImport: false }))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)
    expect(avertissements()).toHaveLength(0)
  })
})

describe('signalerPlafondsAtteints — écrans qui lisent /api/btp sans le hook', () => {
  it('prévient pour chaque liste coupée de la réponse, une seule fois par liste', () => {
    signalerPlafondsAtteints({ depenses: [], plafondsAtteints: { depenses: 500, rentabilite: 100 } })
    signalerPlafondsAtteints({ depenses: [], plafondsAtteints: { depenses: 500 } })

    expect(avertissements()).toHaveLength(2)
    expect(avertissements()[0]).toMatch(/seules les 500 dépenses les plus récentes sont affichées/)
    expect(avertissements()[1]).toMatch(/Rentabilité incomplète.*100 chantiers/)
  })

  it('réponse sans plafond, vide ou en erreur : rien', () => {
    signalerPlafondsAtteints({ membres: [] })
    signalerPlafondsAtteints(null)
    signalerPlafondsAtteints({ plafondsAtteints: 'n’importe quoi' })
    expect(avertissements()).toHaveLength(0)
  })
})
