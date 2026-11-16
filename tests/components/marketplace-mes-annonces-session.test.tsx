// tests/components/marketplace-mes-annonces-session.test.tsx
//
// Marketplace BTP (écran partagé artisan / société BTP), onglet « Mes annonces » : la lecture de ses annonces
// (GET /api/marketplace-btp?user_id=…) exige le jeton de la session (route corrigée le 11/04/2026). L'écran
// l'appelait sans jeton : la liste restait vide, et avec elle la modification, la pause et les demandes reçues.
// Audit des fondations BTP du 11/11/2026, constat api-peripherie-8.
// Société BTP : la session est envoyée. Artisan : comportement inchangé (règle artisan / BTP), défaut signalé.
// Relecture adverse du 16/11/2026 : un refus du serveur (session expirée, limite de débit, panne) laissait la liste
// vide sans rien dire ; pour la société BTP, il est désormais dit.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'

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
/** Statut rendu par la lecture de « Mes annonces » (les autres appels répondent 200). */
let statutMesAnnonces = 200

beforeEach(() => {
  appels = []
  statutMesAnnonces = 200
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    appels.push({ url: String(url), autorisation: entetes.Authorization })
    const refus = String(url).includes('user_id=') && statutMesAnnonces !== 200
    return new Response(JSON.stringify(refus ? { error: 'Non autorisé' } : { listings: [] }), {
      status: refus ? statutMesAnnonces : 200,
      headers: { 'Content-Type': 'application/json' },
    })
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

  it('société BTP : un refus du serveur (session expirée, limite de débit, panne) est dit', async () => {
    for (const statut of [401, 429, 500]) {
      statutMesAnnonces = statut
      const { unmount } = await act(async () => render(<MarketplaceProBTPSection artisan={SOCIETE as never} orgRole="pro_societe" />))
      expect(await screen.findByText('Impossible de charger vos annonces'), `statut ${statut}`).toBeInTheDocument()
      unmount()
    }
  })

  it('artisan : comportement inchangé, un refus du serveur ne déclenche aucun message', async () => {
    statutMesAnnonces = 401
    await act(async () => { render(<MarketplaceProBTPSection artisan={SOCIETE as never} orgRole="artisan" />) })
    await vi.waitFor(() => expect(mesAnnonces()).toHaveLength(1))
    // Laisse la réponse être lue avant de vérifier l'absence de message.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.queryByText('Impossible de charger vos annonces')).not.toBeInTheDocument()
  })
})
