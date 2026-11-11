// tests/components/marches-appels-authentifies.test.tsx
//
// Les deux écrans qui lisent les modes personnels de /api/marches envoient le jeton de la session
// (la route ne répond plus sans : tests/api/marches-acces.test.ts) :
//   - espace client, « Bourse aux Marchés » : ses offres publiées (?publisher_user_id=…) ;
//   - tableau de bord artisan / BTP, « Bourse aux Marchés » : ses candidatures (?my_bids=true&artisan_id=…).
// Sans l'en-tête, ces listes resteraient vides en silence.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'

const h = vi.hoisted(() => ({ jeton: 'jeton-de-session' as string | null }))

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} }
  return {
    supabase: {
      auth: { getSession: vi.fn(async () => ({ data: { session: h.jeton ? { access_token: h.jeton } : null } })) },
      channel: () => canal,
      removeChannel: () => {},
    },
  }
})
vi.mock('@/lib/realtime-reconnect', () => ({ subscribeWithReconnect: (canal: unknown) => canal }))
// Vues chargées à la demande : seul le chargement des données compte ici.
vi.mock('next/dynamic', () => ({ default: () => function VueFactice() { return null } }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

import ClientMarchesSection from '@/components/client-dashboard/pages/ClientMarchesSection'
import BourseAuxMarchesSection from '@/components/marches/BourseAuxMarchesSection'

const COMPTE = '11111111-1111-4111-8111-111111111111'
const FICHE = '33333333-3333-4333-8333-333333333333'

type AppelReseau = { url: string; autorisation: string | undefined }
let appels: AppelReseau[] = []

beforeEach(() => {
  appels = []
  h.jeton = 'jeton-de-session'
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    appels.push({ url: String(url), autorisation: entetes.Authorization })
    return new Response(JSON.stringify({ marches: [], candidatures: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const appelVers = (fragment: string) => appels.find(a => a.url.includes(fragment))

describe('Espace client — mes appels d’offres publiés', () => {
  it('la lecture part avec le jeton de la session', async () => {
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelVers('publisher_user_id=')).toBeDefined())
    expect(appelVers('publisher_user_id=')).toEqual({
      url: `/api/marches?publisher_user_id=${COMPTE}`,
      autorisation: 'Bearer jeton-de-session',
    })
  })

  it('une liste vide ne relance pas la lecture (un seul appel, pas de boucle)', async () => {
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelVers('publisher_user_id=')).toBeDefined())
    // Laisse aux effets le temps de se rejouer : avant correction, chaque réponse vide relançait un appel.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)) })
    expect(appels.filter(a => a.url.includes('publisher_user_id='))).toHaveLength(1)
  })

  it('sans session, l’appel part quand même (la route répond 401 au lieu d’un échec muet)', async () => {
    h.jeton = null
    await act(async () => { render(<ClientMarchesSection userId={COMPTE} locale="fr" />) })
    await vi.waitFor(() => expect(appelVers('publisher_user_id=')).toBeDefined())
    expect(appelVers('publisher_user_id=')?.autorisation).toBeUndefined()
  })
})

describe('Tableau de bord artisan / BTP — mes candidatures', () => {
  for (const orgRole of ['pro_societe', 'artisan'] as const) {
    it(`${orgRole} : la lecture des candidatures part avec le jeton de la session`, async () => {
      const artisan = { id: FICHE, user_id: COMPTE, company_name: 'Bâtiment du Banc SARL', categories: [] }
      await act(async () => { render(<BourseAuxMarchesSection artisan={artisan} orgRole={orgRole} navigateTo={vi.fn()} />) })
      await vi.waitFor(() => expect(appelVers('my_bids=true')).toBeDefined())
      expect(appelVers('my_bids=true')).toEqual({
        url: `/api/marches?my_bids=true&artisan_id=${FICHE}`,
        autorisation: 'Bearer jeton-de-session',
      })
      // La liste publique des marchés, elle, n'a pas besoin de jeton.
      expect(appels.some(a => a.url.startsWith('/api/marches?') && a.url.includes('pays=FR') && !a.url.includes('my_bids'))).toBe(true)
    })
  }
})
