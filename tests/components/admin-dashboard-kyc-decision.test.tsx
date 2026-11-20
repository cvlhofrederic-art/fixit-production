// tests/components/admin-dashboard-kyc-decision.test.tsx
//
// Panneau admin, onglet « KYC » (constat inscription-profil-10 de l'audit du 11/11/2026) : un clic sur « Approuver »
// ou « Confirmer le rejet » qui échouait côté serveur ne montrait rien (aucune branche d'erreur), et le dossier restait
// en attente sans explication. Désormais : message d'erreur, fenêtre du motif de rejet gardée ouverte (motif non
// perdu), et avertissement quand la décision est enregistrée mais que l'e-mail n'a pas pu partir.

import React from 'react'
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  reponseDecision: null as null | (() => Promise<Response>),
}))

vi.mock('sonner', () => ({ toast: { error: h.toastError, warning: h.toastWarning, success: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(async () => ({ data: {}, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'id-super-admin', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } } } })),
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jeton-admin' } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

import AdminDashboardPage from '@/app/(commun)/admin/dashboard/page'

const DOSSIER = {
  id: '3f2b8c1e-5d4a-4b6f-9e7d-1a2b3c4d5e6f', company_name: 'BÂTIMENT EXEMPLE', email: 'contact@exemple.fr',
  kyc_status: 'pending', kyc_market: 'fr_btp', kyc_score: null, kyc_checks: null, kbis_url: null, id_document_url: null,
}

const json = (corps: unknown, status = 200) => new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => {
  h.toastError.mockReset()
  h.toastWarning.mockReset()
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    if (String(url).startsWith('/api/admin/kyc') && (init as RequestInit | undefined)?.method === 'PATCH') {
      return h.reponseDecision ? h.reponseDecision() : json({ success: true, status: 'approved', email_envoye: true })
    }
    if (String(url).startsWith('/api/admin/kyc')) return json({ data: [DOSSIER], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } })
    return json({ error: 'indisponible' }, 503)
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  h.reponseDecision = null
})

async function ouvrirKyc() {
  render(<AdminDashboardPage />)
  fireEvent.click(await screen.findByRole('button', { name: /KYC/ }, { timeout: 5000 }))
  await screen.findByText('BÂTIMENT EXEMPLE')
}

describe('Panneau admin — décision KYC qui échoue', () => {
  it('« Approuver » refusé par le serveur : un message d’erreur s’affiche', async () => {
    h.reponseDecision = async () => json({ error: 'Database error' }, 500)
    await ouvrirKyc()

    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }))

    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(1))
    const message = String(h.toastError.mock.calls[0][0])
    expect(message).toMatch(/n’a pas été enregistrée|n'a pas été enregistrée/)
    // Certains dossiers échouent à chaque essai : le message ne promet pas qu'un nouvel essai réussira
    expect(message).not.toMatch(/Réessayez/)
    expect(message).toMatch(/Si l’erreur persiste|Si l'erreur persiste/)
  })

  it('rejet refusé : message d’erreur, fenêtre du motif gardée ouverte avec le motif saisi', async () => {
    h.reponseDecision = async () => json({ error: 'Database error' }, 500)
    await ouvrirKyc()

    fireEvent.click(screen.getByRole('button', { name: /Rejeter/ }))
    fireEvent.change(screen.getByPlaceholderText(/KBIS illisible/), { target: { value: 'Kbis illisible' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le rejet' }))

    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(1))
    expect((screen.getByPlaceholderText(/KBIS illisible/) as HTMLTextAreaElement).value).toBe('Kbis illisible')
  })

  it('réseau coupé : un message d’erreur s’affiche', async () => {
    h.reponseDecision = () => Promise.reject(new TypeError('Failed to fetch'))
    await ouvrirKyc()

    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }))

    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(1))
  })

  it('décision enregistrée mais e-mail non parti : avertissement pour prévenir la société', async () => {
    h.reponseDecision = async () => json({ success: true, status: 'approved', email_envoye: false })
    await ouvrirKyc()

    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }))

    await waitFor(() => expect(h.toastWarning).toHaveBeenCalledTimes(1))
    expect(String(h.toastWarning.mock.calls[0][0])).toMatch(/e-mail/)
    expect(h.toastError).not.toHaveBeenCalled()
  })

  it('décision enregistrée, e-mail parti : ni erreur ni avertissement', async () => {
    await ouvrirKyc()

    fireEvent.click(screen.getByRole('button', { name: /Approuver/ }))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/kyc', expect.objectContaining({ method: 'PATCH' })))
    await new Promise((r) => setTimeout(r, 50))
    expect(h.toastError).not.toHaveBeenCalled()
    expect(h.toastWarning).not.toHaveBeenCalled()
  })
})
