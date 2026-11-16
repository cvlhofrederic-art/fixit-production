// tests/components/marketplace-mes-annonces-session.test.tsx
//
// Marketplace BTP (écran partagé artisan / société BTP), onglet « Mes annonces » : la lecture de ses annonces
// (GET /api/marketplace-btp?user_id=…) exige le jeton de la session (route corrigée le 11/04/2026). L'écran
// l'appelait sans jeton : la liste restait vide, et avec elle la modification, la pause et les demandes reçues.
// Audit des fondations BTP du 11/11/2026, constat api-peripherie-8.
// Société BTP : la session est envoyée. Artisan : comportement inchangé (règle artisan / BTP), défaut signalé.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-de-session' } } })) } },
}))

import MarketplaceProBTPSection from '@/components/dashboard/MarketplaceProBTPSection'

const COMPTE = '11111111-1111-4111-8111-111111111111'
const FICHE = '33333333-3333-4333-8333-333333333333'
const SOCIETE = { id: FICHE, user_id: COMPTE, company_name: 'Bâtiment du Banc SARL' }

type AppelReseau = { url: string; autorisation: string | undefined }
let appels: AppelReseau[] = []

beforeEach(() => {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    appels.push({ url: String(url), autorisation: entetes.Authorization })
    return new Response(JSON.stringify({ listings: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const mesAnnonces = () => appels.filter(a => a.url === `/api/marketplace-btp?user_id=${COMPTE}`)

describe('Marketplace BTP — mes annonces', () => {
  it('société BTP : la lecture de mes annonces part avec le jeton de la session', async () => {
    await act(async () => { render(<MarketplaceProBTPSection artisan={SOCIETE as never} orgRole="pro_societe" />) })
    await vi.waitFor(() => expect(mesAnnonces()).toHaveLength(1))
    expect(mesAnnonces()[0].autorisation).toBe('Bearer jeton-de-session')
    // La liste publique, elle, part toujours sans jeton.
    expect(appels.filter(a => !a.url.includes('user_id=')).every(a => a.autorisation === undefined)).toBe(true)
  })

  it('artisan : comportement inchangé, la lecture part sans jeton', async () => {
    await act(async () => { render(<MarketplaceProBTPSection artisan={SOCIETE as never} orgRole="artisan" />) })
    await vi.waitFor(() => expect(mesAnnonces()).toHaveLength(1))
    expect(mesAnnonces()[0].autorisation).toBeUndefined()
  })
})
