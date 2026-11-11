// tests/components/admin-dashboard-carte-aj-signalement.test.tsx
//
// Panneau admin, onglet « Dashboards » : une carte « AJ Signalement » ouvre l'espace indépendant des signalements
// par QR code (/fr/aj-signalement/), à côté de la carte Administrateur judiciaire (demande de Hugo du 11/11/2026 :
// « je ne vois pas aj signalements sur mon dashboard admin »). Comme les cartes AJ et Copropriétaire, elle s'ouvre
// SANS « vue en tant que » : rôle rendu super_admin (retour au rôle réel), le seul admis dans l'espace.

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

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

afterEach(() => { cleanup(); vi.restoreAllMocks() })

/** Ouvre l'onglet « Dashboards » ; renvoie l'espion fetch et l'emplacement observable. */
async function ouvrirSelecteur() {
  // Seule l'impersonation répond ; les statistiques de l'onglet d'ouverture restent indisponibles.
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
    String(url) === '/api/admin/impersonate'
      ? new Response(JSON.stringify({ success: true }), { status: 200 })
      : new Response(JSON.stringify({ error: 'indisponible' }), { status: 503 }),
  )
  // safeNavigate (lib/security/safe-url) résout le chemin sur l'origine courante puis appelle location.assign :
  // le double enregistre le chemin atteint dans href.
  const emplacement = {
    href: '/admin/dashboard', pathname: '/admin/dashboard', search: '', hash: '', origin: 'http://localhost:3000',
    assign(url: string) { emplacement.href = new URL(url).pathname },
  }
  Object.defineProperty(window, 'location', { configurable: true, value: emplacement })
  render(<AdminDashboardPage />)
  fireEvent.click(await screen.findByRole('button', { name: /Dashboards/ }, { timeout: 5000 }))
  return { fetchSpy, emplacement }
}

/** Rôle demandé à POST /api/admin/impersonate (undefined : aucun appel). */
const roleDemande = (fetchSpy: { mock: { calls: unknown[][] } }): string | undefined => {
  const appel = fetchSpy.mock.calls.find((args) => String(args[0]) === '/api/admin/impersonate')
  return appel ? JSON.parse(String((appel[1] as RequestInit).body)).role : undefined
}

describe('Panneau admin — carte « AJ Signalement »', () => {
  const origine = Object.getOwnPropertyDescriptor(window, 'location')
  afterEach(() => { if (origine) Object.defineProperty(window, 'location', origine) })

  it('la carte existe, avec son libellé, juste après la carte Administrateur judiciaire', async () => {
    await ouvrirSelecteur()
    const carte = screen.getByRole('button', { name: /AJ Signalement/ })
    expect(carte.querySelector('h3')?.textContent).toBe('AJ Signalement')
    const cartes = screen.getAllByRole('button').filter((bouton) => bouton.querySelector('h3'))
    const rangAj = cartes.findIndex((bouton) => bouton.querySelector('h3')?.textContent === 'Administrateur Judiciaire')
    expect(rangAj).toBeGreaterThanOrEqual(0)
    expect(cartes[rangAj + 1]).toBe(carte)
  })

  it('clic : sans « vue en tant que » (rôle super_admin conservé), ouverture de /fr/aj-signalement/', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /AJ Signalement/ }))
    await waitFor(() => expect(emplacement.href).toBe('/fr/aj-signalement/'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('super_admin')
  })
})
