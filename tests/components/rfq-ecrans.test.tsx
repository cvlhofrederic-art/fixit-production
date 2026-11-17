// tests/components/rfq-ecrans.test.tsx
//
// Devis Fournisseurs (audit des fondations BTP du 11/11/2026, constat api-peripherie-10) — les deux écrans :
//   - société BTP (RFQSection) : Accepter / Refuser une offre écrivait dans la table des offres depuis le navigateur,
//     où le compte n'a que la lecture ; l'écran annonçait « Offre acceptée ! » sans que l'offre change. La décision
//     passe par PATCH /api/rfq, avec la session ; un refus du serveur est dit.
//   - fournisseur (/rfq/repondre/[jeton]) : un lien expiré le dit ; une offre déjà répondue (prix reçu) n'est plus
//     proposée ; le prix total et le délai sont obligatoires dans le formulaire (le navigateur bloque l'envoi d'un
//     champ vide, qui partait et échouait par « Erreur lors de l'envoi » en effaçant le formulaire).

import React from 'react'
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-de-session' } } })) },
    from: h.from,
  },
}))
vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'a3f1c2d4e5b6978812ab34cd56ef7890a1b2c3d4e5f60718293a4b5c6d7e8f90' }), // gitleaks:allow — jeton factice (fixture de test, pas un secret)
}))

import RFQSection from '@/components/dashboard/RFQSection'
import { LanguageProvider } from '@/lib/i18n/context'
import SupplierResponsePage from '@/app/(commun)/rfq/repondre/[token]/page'

const DEMANDE = '44444444-4444-4444-8444-444444444444'
const OFFRE = '55555555-5555-4555-8555-555555555555'

type AppelReseau = { url: string; methode: string; autorisation: string | undefined; corps: unknown }
let appels: AppelReseau[] = []
let repondre: (url: string, methode: string) => { statut: number; corps: unknown }

beforeEach(() => {
  appels = []
  h.from.mockReset()
  vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
    const entetes = (options?.headers ?? {}) as Record<string, string>
    const methode = options?.method ?? 'GET'
    appels.push({ url: String(url), methode, autorisation: entetes.Authorization, corps: options?.body ? JSON.parse(String(options.body)) : undefined })
    const { statut, corps } = repondre(String(url), methode)
    return new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('Devis Fournisseurs — décision de la société sur une offre', () => {
  const DEMANDE_AVEC_OFFRE = {
    id: DEMANDE, title: 'Plaques de plâtre BA13', status: 'answered', country: 'FR', created_at: '2026-11-16T09:00:00Z',
    rfq_items: [], offers: [{ id: OFFRE, supplier_name: 'Fournisseur A', total_price: 1250.5, delivery_days: 5, status: 'pending', created_at: '2026-11-16T10:00:00Z' }],
  }
  const ouvrirLaDemande = async () => {
    // Interface en français : l'écran suit la langue de l'interface (portugais par défaut sans fournisseur).
    await act(async () => { render(<LanguageProvider initialLocale="fr"><RFQSection artisan={{ id: 'fiche', country: 'FR' }} orgRole="pro_societe" /></LanguageProvider>) })
    await act(async () => { fireEvent.click(await screen.findByText('Plaques de plâtre BA13')) })
  }

  it('Accepter passe par le serveur, avec la session ; l’écran ne modifie plus la table depuis le navigateur', async () => {
    repondre = (url, methode) => (methode === 'PATCH' ? { statut: 200, corps: { success: true } } : { statut: 200, corps: { rfqs: [DEMANDE_AVEC_OFFRE] } })
    await ouvrirLaDemande()
    await act(async () => { fireEvent.click(screen.getByText('Accepter')) })
    await vi.waitFor(() => expect(appels.filter(a => a.methode === 'PATCH')).toHaveLength(1))
    expect(appels.find(a => a.methode === 'PATCH')).toEqual({
      url: '/api/rfq', methode: 'PATCH', autorisation: 'Bearer jeton-de-session', corps: { offer_id: OFFRE, status: 'accepted' },
    })
    expect(await screen.findByText('Offre acceptée !')).toBeInTheDocument()
    expect(h.from).not.toHaveBeenCalled()
  })

  it('Refuser passe par le serveur ; un refus du serveur est dit, pas annoncé comme réussi', async () => {
    repondre = (url, methode) => (methode === 'PATCH' ? { statut: 409, corps: { error: 'refus' } } : { statut: 200, corps: { rfqs: [DEMANDE_AVEC_OFFRE] } })
    await ouvrirLaDemande()
    await act(async () => { fireEvent.click(screen.getByText('Refuser')) })
    await vi.waitFor(() => expect(appels.find(a => a.methode === 'PATCH')?.corps).toEqual({ offer_id: OFFRE, status: 'rejected' }))
    expect(await screen.findByText('Erreur')).toBeInTheDocument()
    expect(screen.queryByText('Offre refusée')).toBeNull()
    expect(h.from).not.toHaveBeenCalled()
  })
})

describe('Devis Fournisseurs — page de réponse du fournisseur', () => {
  const OFFRE_EN_ATTENTE = {
    id: OFFRE, token: 'jeton', supplier_name: 'Fournisseur A', status: 'pending', total_price: null,
    rfqs: { title: 'Plaques de plâtre BA13', country: 'FR', rfq_items: [] },
  }

  it('lien expiré : le message de la route est affiché', async () => {
    repondre = () => ({ statut: 410, corps: { error: 'Ce lien a expiré : il était valable 7 jours.' } })
    await act(async () => { render(<SupplierResponsePage />) })
    expect(await screen.findByText('Ce lien a expiré : il était valable 7 jours.')).toBeInTheDocument()
  })

  it('offre déjà répondue (prix reçu) : « déjà traitée », le formulaire n’est plus proposé', async () => {
    repondre = () => ({ statut: 200, corps: { offer: { ...OFFRE_EN_ATTENTE, total_price: 1250.5 } } })
    await act(async () => { render(<SupplierResponsePage />) })
    expect(await screen.findByText('Cette demande est déjà traitée.')).toBeInTheDocument()
    expect(screen.queryByText('Envoyer mon offre →')).toBeNull()
  })

  it('prix total et délai sont obligatoires : le formulaire n’est pas valide tant qu’ils sont vides', async () => {
    repondre = () => ({ statut: 200, corps: { offer: OFFRE_EN_ATTENTE } })
    const { container } = render(<SupplierResponsePage />)
    await screen.findByText('Envoyer mon offre →')
    const formulaire = container.querySelector('form') as HTMLFormElement
    const [prix, delai] = Array.from(formulaire.querySelectorAll('input[type="number"]')) as HTMLInputElement[]
    expect([prix.required, delai.required]).toEqual([true, true])
    expect(formulaire.checkValidity()).toBe(false)
    await act(async () => {
      fireEvent.change(prix, { target: { value: '1250.5' } })
      fireEvent.change(delai, { target: { value: '5' } })
    })
    expect(formulaire.checkValidity()).toBe(true)
  })

  it('prix et délai remplis : la réponse part avec ces valeurs', async () => {
    repondre = (url, methode) => (methode === 'POST' ? { statut: 200, corps: { success: true } } : { statut: 200, corps: { offer: OFFRE_EN_ATTENTE } })
    const { container } = render(<SupplierResponsePage />)
    await screen.findByText('Envoyer mon offre →')
    const [prix, delai] = Array.from(container.querySelectorAll('form input[type="number"]')) as HTMLInputElement[]
    await act(async () => {
      fireEvent.change(prix, { target: { value: '1250.5' } })
      fireEvent.change(delai, { target: { value: '5' } })
    })
    await act(async () => { fireEvent.click(screen.getByText('Envoyer mon offre →')) })
    await vi.waitFor(() => expect(appels.filter(a => a.methode === 'POST')).toHaveLength(1))
    expect(appels.find(a => a.methode === 'POST')?.corps).toMatchObject({ total_price: 1250.5, delivery_days: 5 })
  })
})
