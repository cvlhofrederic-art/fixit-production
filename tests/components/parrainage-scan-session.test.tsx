// tests/components/parrainage-scan-session.test.tsx
//
// Deux écrans du tableau de bord pro, partagés artisan / société BTP, appelaient sans jeton des routes qui l'exigent
// (getAuthUser ne lit que l'en-tête Authorization) — audit des fondations BTP du 11/11/2026, constat api-peripherie-8 :
//   - Parrainage : /api/referral/stats, /api/referral/history et /api/referral/generate-code répondaient 401, aucun
//     lien de parrainage ne s'affichait ;
//   - scan d'un ticket de caisse (depuis l'assistant) : /api/receipt-scan répondait 401.
// Société BTP : la session est envoyée. Artisan : comportement inchangé (règle artisan / BTP), défaut signalé.

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'

vi.mock('@/lib/i18n/context', () => ({ useLocale: () => 'fr' }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-de-session' } } })) } },
}))

import ParrainageSection from '@/components/dashboard/ParrainageSection'
import ReceiptScanner from '@/components/common/ReceiptScanner'
import { OrgRoleProvider } from '@/lib/hooks/useOrgRoleContext'

const FICHE = '33333333-3333-4333-8333-333333333333'
const SOCIETE = { id: FICHE, user_id: '11111111-1111-4111-8111-111111111111', company_name: 'Bâtiment du Banc SARL' }

type AppelReseau = { url: string; autorisation: string | undefined }
let appels: AppelReseau[] = []

beforeEach(() => {
  appels = []
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    appels.push({ url: String(url), autorisation: entetes.Authorization })
    // Statistiques sans code : l'écran demande la création du code, puis relit les statistiques.
    const corps = String(url).includes('/api/referral/stats')
      ? { referral_code: null, referral_link: null, credit_mois_gratuits: 0, total_parrainages_reussis: 0, stats: { total: 0, inscrits: 0, enVerification: 0, valides: 0 } }
      : String(url).includes('/api/receipt-scan')
        ? { result: { store: 'Magasin', date: '2026-11-16', lines: [], totalTTC: 0, confidence: 'basse' } }
        : { history: [], code: 'CODE-TEST', link: 'https://vitfix.io/rejoindre?ref=CODE-TEST' }
    return new Response(JSON.stringify(corps), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

const appelsVers = (debut: string) => appels.filter(a => a.url.startsWith(debut))

describe('Parrainage', () => {
  it('société BTP : statistiques, historique et création du code partent avec le jeton de la session', async () => {
    await act(async () => { render(<ParrainageSection artisan={SOCIETE as never} orgRole="pro_societe" />) })
    await vi.waitFor(() => expect(appelsVers('/api/referral/stats')).toHaveLength(2))
    const parrainage = appelsVers('/api/referral/')
    expect(parrainage.map(a => a.url)).toEqual([
      '/api/referral/stats', '/api/referral/history', '/api/referral/generate-code', '/api/referral/stats',
    ])
    expect(parrainage.every(a => a.autorisation === 'Bearer jeton-de-session')).toBe(true)
  })

  it('artisan : comportement inchangé, les appels partent sans jeton', async () => {
    await act(async () => { render(<ParrainageSection artisan={SOCIETE as never} orgRole="artisan" />) })
    await vi.waitFor(() => expect(appelsVers('/api/referral/stats').length).toBeGreaterThan(0))
    expect(appelsVers('/api/referral/').every(a => a.autorisation === undefined)).toBe(true)
  })
})

describe('Scan d’un ticket de caisse', () => {
  const scanner = (orgRole: 'pro_societe' | 'artisan') => render(
    <OrgRoleProvider orgRole={orgRole}>
      <ReceiptScanner onInject={vi.fn()} onClose={vi.fn()} />
    </OrgRoleProvider>,
  )
  const deposerUnTicket = async (conteneur: HTMLElement) => {
    const champ = conteneur.querySelector('input[type="file"]') as HTMLInputElement
    const ticket = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'ticket.jpg', { type: 'image/jpeg' })
    await act(async () => { fireEvent.change(champ, { target: { files: [ticket] } }) })
    await vi.waitFor(() => expect(appelsVers('/api/receipt-scan')).toHaveLength(1))
  }

  it('société BTP : l’envoi du ticket part avec le jeton de la session', async () => {
    const { container } = scanner('pro_societe')
    await deposerUnTicket(container)
    expect(appelsVers('/api/receipt-scan')[0].autorisation).toBe('Bearer jeton-de-session')
  })

  it('artisan : comportement inchangé, l’envoi part sans jeton', async () => {
    const { container } = scanner('artisan')
    await deposerUnTicket(container)
    expect(appelsVers('/api/receipt-scan')[0].autorisation).toBeUndefined()
  })

  it('hors du tableau de bord (sans rôle connu) : comportement inchangé, sans jeton', async () => {
    const { container } = render(<ReceiptScanner onInject={vi.fn()} onClose={vi.fn()} />)
    await deposerUnTicket(container)
    expect(appelsVers('/api/receipt-scan')[0].autorisation).toBeUndefined()
  })
})
