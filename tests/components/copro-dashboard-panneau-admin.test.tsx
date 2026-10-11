// tests/components/copro-dashboard-panneau-admin.test.tsx
//
// Dashboard copropriétaire ouvert par le super_admin depuis le panneau admin (sans « vue en tant
// que ») : lien discret « Panneau admin » dans le pied de sidebar pour revenir au sélecteur.
// Un vrai copropriétaire ne le voit pas. Décision lue dans app_metadata (non forgeable).

import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  user: { id: 'id-super-admin', email: 'admin@exemple.fr', app_metadata: { role: 'super_admin' } as Record<string, unknown>, user_metadata: {} },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(async () => ({ data: {}, error: null })),
      getUser: vi.fn(async () => ({ data: { user: h.user } })),
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'tok', user: h.user } } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}))

// Sections du dashboard remplacées par un écran factice : seul le cadre (sidebar) compte ici.
vi.mock('next/dynamic', () => ({
  default: () =>
    function SectionFactice() {
      return <div data-testid="section" />
    },
}))

import CoproDashboardPage from '@/app/coproprietaire/dashboard/page'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function monter() {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({}), { status: 200 }))
  await act(async () => { render(<CoproDashboardPage />) })
  await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
}

describe('Dashboard copropriétaire — lien « Panneau admin »', () => {
  it('super_admin (ouvert sans « vue en tant que ») : lien vers /admin/dashboard', async () => {
    h.user = { ...h.user, app_metadata: { role: 'super_admin' } }
    await monter()
    expect((await screen.findByRole('link', { name: /Panneau admin/ }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/dashboard')
  })

  it('« vue en tant que » copropriétaire d’un super_admin : lien vers /admin/exit', async () => {
    h.user = { ...h.user, app_metadata: { role: 'coproprio', _admin_override: true, _original_role: 'super_admin' } }
    await monter()
    expect((await screen.findByRole('link', { name: /Panneau admin/ }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/exit')
  })

  it('vrai copropriétaire : aucun lien', async () => {
    h.user = { ...h.user, app_metadata: { role: 'coproprio' } }
    await monter()
    expect(screen.queryByRole('link', { name: /Panneau admin/ })).toBeNull()
  })
})
