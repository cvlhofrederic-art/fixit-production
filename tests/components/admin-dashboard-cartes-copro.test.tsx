// tests/components/admin-dashboard-cartes-copro.test.tsx
//
// Panneau admin, onglet « Dashboards » : les cartes Copropriétaire ouvrent le dashboard copro SANS
// « vue en tant que » (rôle rendu : super_admin, comme la carte Administrateur judiciaire). Avant,
// elles basculaient le compte en 'coproprio' et le Syndic v54 retombait ensuite en maquette anonyme.
// Idem pour le sous-rôle Locataire et l'accès complet de la carte « Syndic / Cabinet », qui ouvre le
// Syndic v54 français (/fr/syndic/v54 ; /syndic/dashboard redirigeait vers la version PT).
// Les cartes Artisan / BTP gardent la « vue en tant que » (ces dashboards ont besoin du rôle).

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

import AdminDashboardPage from '@/app/admin/dashboard/page'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

/** Ouvre l'onglet « Dashboards » ; renvoie l'espion fetch et l'emplacement observable. */
async function ouvrirSelecteur() {
  // Seule l'impersonation répond ; les statistiques de l'onglet d'ouverture restent indisponibles
  // (une réponse factice mal formée ferait planter la vue d'ensemble selon l'ordre d'arrivée).
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

describe('Panneau admin — cartes Copropriétaire sans « vue en tant que »', () => {
  const origine = Object.getOwnPropertyDescriptor(window, 'location')
  afterEach(() => { if (origine) Object.defineProperty(window, 'location', origine) })

  it('carte « Dashboard Copropriétaire » : rôle super_admin conservé, ouverture du dashboard copro', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Dashboard Copropriétaire/ }))
    await waitFor(() => expect(emplacement.href).toBe('/coproprietaire/dashboard'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('super_admin')
  })

  it('sous-rôle « Copropriétaire » de la carte Syndic : idem', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Syndic \/ Cabinet/ }))
    fireEvent.click(screen.getByRole('button', { name: /^🏘️\s*Copropriétaire/ }))
    await waitFor(() => expect(emplacement.href).toBe('/coproprietaire/dashboard'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('super_admin')
  })

  it('sous-rôle « Locataire » de la carte Syndic : sans « vue en tant que », dashboard copro', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Syndic \/ Cabinet/ }))
    fireEvent.click(screen.getByRole('button', { name: /^🔑\s*Locataire/ }))
    await waitFor(() => expect(emplacement.href).toBe('/coproprietaire/dashboard'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('super_admin')
  })

  it('carte « Syndic / Cabinet », accès complet : sans « vue en tant que », Syndic v54 en français', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Syndic \/ Cabinet/ }))
    fireEvent.click(screen.getByRole('button', { name: /Syndic \(accès complet\)/ }))
    await waitFor(() => expect(emplacement.href).toBe('/fr/syndic/v54'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('super_admin')
  })

  it('sous-rôle d’équipe (Gestionnaire) : vue en tant que conservée, ouvert sur /fr/syndic/v54 (plus /syndic/dashboard → PT)', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Syndic \/ Cabinet/ }))
    fireEvent.click(screen.getByRole('button', { name: /^📋\s*Gestionnaire Gestion/ }))
    await waitFor(() => expect(emplacement.href).toBe('/fr/syndic/v54'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('syndic_gestionnaire')
  })

  it('carte Artisan : la « vue en tant que » artisan est conservée', async () => {
    const { fetchSpy, emplacement } = await ouvrirSelecteur()
    fireEvent.click(screen.getByRole('button', { name: /Artisan \/ Auto-entrepreneur/ }))
    await waitFor(() => expect(emplacement.href).toBe('/pro/dashboard'), { timeout: 5000 })
    expect(roleDemande(fetchSpy)).toBe('artisan')
  })
})
