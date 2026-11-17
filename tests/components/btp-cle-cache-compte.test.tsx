// tests/components/btp-cle-cache-compte.test.tsx — une seule clé de cache par compte pour les listes BTP
// (constat donnees-btp-15 de l'audit du 11/11/2026).
//
// Avant : Situations, Retenues, Sous-traitance, DPGF, Gantt et leur liste déroulante de chantiers rangeaient leurs
// listes sous l'identifiant de la fiche société, alors que Chantiers, Équipes, Pointage et le préchargement du tableau
// de bord utilisent l'identifiant du compte. Un chantier qu'on venait de créer n'apparaissait pas dans la liste
// déroulante d'une situation pendant 5 minutes, et quatre préchargements remplissaient une clé que personne ne lisait.
// Maintenant : ces écrans reçoivent aussi l'identifiant du compte (authUserId) et rangent leurs listes sous celui-ci ;
// l'identifiant de la fiche reste celui des clés du navigateur (rien n'y change).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok' } } })), onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe() {} } } })) } },
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr', useTranslation: () => ({ t: (cle: string) => cle }) }))

import { prefetchBTPTables, useBTPData } from '@/lib/hooks/use-btp-data'
import { ChantierSelect } from '@/components/dashboard/btp/ChantierSelect'
import { SituationsTravaux } from '@/components/dashboard/btp/SituationsTravaux'

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

let chantiersEnBase: Array<Record<string, unknown>>
const lectures = () => vi.mocked(fetch).mock.calls
  .filter(([, init]) => !init?.method || init.method === 'GET')
  .map(([url]) => new URL(String(url), 'https://vitfix.io').searchParams.get('table'))

beforeEach(() => {
  chantiersEnBase = [{ id: 'c-1', titre: 'Villa Dupré', client: 'Mme Dupré', statut: 'En cours' }]
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (init?.method === 'POST') {
      const corps = JSON.parse(String(init.body))
      const ligne = { id: `c-${chantiersEnBase.length + 1}`, ...corps.data }
      chantiersEnBase = [...chantiersEnBase, ligne]
      return json({ row: ligne }, 201)
    }
    const table = new URL(String(url), 'https://vitfix.io').searchParams.get('table') ?? ''
    return json({ [table]: table === 'chantiers' ? chantiersEnBase : [] })
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('liste déroulante des chantiers (Situations, Retenues, Sous-traitance)', () => {
  it('un chantier créé dans Chantiers y apparaît tout de suite, sans attendre 5 minutes', async () => {
    const premier = render(<ChantierSelect userId="fiche-1" authUserId="compte-1" value="" onChange={() => {}} />)
    await screen.findByRole('option', { name: /Villa Dupré/ })
    premier.unmount()

    // Écran Chantiers : il range ses chantiers sous l'identifiant du compte.
    const chantiers = renderHook(() => useBTPData({ table: 'chantiers', artisanId: 'fiche-1', userId: 'compte-1', autoImport: false }))
    await waitFor(() => expect(chantiers.result.current.loading).toBe(false))
    await act(async () => { await chantiers.result.current.add({ titre: 'Extension Paradis', client: 'M. Paradis' }) })
    chantiers.unmount()

    render(<ChantierSelect userId="fiche-1" authUserId="compte-1" value="" onChange={() => {}} />)
    expect(await screen.findByRole('option', { name: /Extension Paradis/ })).toBeInTheDocument()
  })
})

describe('Situations de travaux', () => {
  it('la liste préchargée par le tableau de bord (identifiant du compte) sert sans nouvelle requête', async () => {
    await prefetchBTPTables(['situations'], 'compte-2')
    expect(lectures()).toEqual(['situations'])

    render(<SituationsTravaux userId="fiche-2" authUserId="compte-2" orgRole="pro_societe" />)
    await screen.findByText('proDash.btp.situations.title')
    // Laisse au hook le temps de lancer une éventuelle lecture.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(lectures()).toEqual(['situations'])
  })
})
