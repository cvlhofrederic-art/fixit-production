// tests/components/panneau-admin-liens.test.tsx
//
// Démo multi-vues du super_admin : lien discret « Panneau admin » dans le dashboard Artisan, le
// dashboard BTP (les deux orgRoles, voulu) et l'application Administrateur judiciaire.
// Visible SEULEMENT pour un super_admin (→ /admin/dashboard) ou une session « vue en tant que »
// ouverte par un super_admin (→ /admin/exit) ; décision lue dans app_metadata, jamais user_metadata.

import '../administrateur-judiciaire/fuseau-paris'
import 'fake-indexeddb/auto'
import React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'

const h = vi.hoisted(() => ({
  session: null as null | { access_token: string; user: { id: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> } },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: h.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

// Écrans de l'application AJ remplacés par un écran factice (seul le cadre compte ici).
vi.mock('next/dynamic', () => ({
  default: () =>
    function EcranFactice() {
      return <div data-testid="ecran-registre" />
    },
}))

import { lienPanneauAdmin } from '@/lib/auth/panneau-admin'
import LienPanneauAdmin from '@/components/common/LienPanneauAdmin'
import V5SidebarArtisan from '@/components/dashboard/V5SidebarArtisan'
import V5Sidebar from '@/components/dashboard/V5Sidebar'
import { Shell } from '@/components/administrateur-judiciaire/shell/Shell'
import { ToastProvider } from '@/components/administrateur-judiciaire/ui/toast'

afterEach(() => { cleanup(); h.session = null })

const sessionAvec = (app_metadata: Record<string, unknown>, user_metadata: Record<string, unknown> = {}) => ({
  access_token: 'tok', user: { id: 'u1', app_metadata, user_metadata },
})

describe('lienPanneauAdmin (app_metadata)', () => {
  it('super_admin → /admin/dashboard ; « vue en tant que » d’un super_admin → /admin/exit', () => {
    expect(lienPanneauAdmin({ role: 'super_admin' })).toBe('/admin/dashboard')
    expect(lienPanneauAdmin({ role: 'artisan', _admin_override: true, _original_role: 'super_admin' })).toBe('/admin/exit')
    expect(lienPanneauAdmin({ role: 'pro_societe', _original_role: 'super_admin' })).toBe('/admin/exit')
  })

  it('tout autre compte → aucun lien', () => {
    expect(lienPanneauAdmin({ role: 'artisan' })).toBeNull()
    expect(lienPanneauAdmin({ role: 'syndic', _original_role: 'syndic' })).toBeNull()
    expect(lienPanneauAdmin({})).toBeNull()
    expect(lienPanneauAdmin(null)).toBeNull()
    expect(lienPanneauAdmin(undefined)).toBeNull()
  })
})

describe('LienPanneauAdmin', () => {
  it('super_admin : lien vers le panneau', async () => {
    h.session = sessionAvec({ role: 'super_admin' })
    render(<LienPanneauAdmin />)
    expect((await screen.findByRole('link', { name: 'Panneau admin' }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/dashboard')
  })

  it('« vue en tant que » : lien vers /admin/exit (rend le rôle super_admin)', async () => {
    h.session = sessionAvec({ role: 'artisan', _admin_override: true, _original_role: 'super_admin' })
    render(<LienPanneauAdmin />)
    expect((await screen.findByRole('link', { name: 'Panneau admin' }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/exit')
  })

  it('compte ordinaire, même avec un user_metadata trafiqué : rien', async () => {
    h.session = sessionAvec({ role: 'artisan' }, { role: 'super_admin', _original_role: 'super_admin' })
    await act(async () => { render(<LienPanneauAdmin />) })
    expect(screen.queryByRole('link')).toBeNull()
  })
})

const fonctions = { navigateTo: vi.fn(), handleLogout: vi.fn(), isModuleEnabled: () => true }

describe('Dashboard Artisan / BTP — pied de sidebar', () => {
  it('artisan en « vue en tant que » : lien « Panneau admin » vers /admin/exit', async () => {
    h.session = sessionAvec({ role: 'artisan', _original_role: 'super_admin' })
    render(<V5SidebarArtisan activePage="home" {...fonctions} isPt={false} pendingBookings={{ length: 0 }} unreadMsgCount={0} />)
    expect((await screen.findByRole('link', { name: /Panneau admin/ }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/exit')
  })

  it('BTP (pro_societe) en « vue en tant que » : même lien', async () => {
    h.session = sessionAvec({ role: 'pro_societe', _original_role: 'super_admin' })
    render(<V5Sidebar activePage="home" {...fonctions} isProGerant proCanAccess={() => true} isPt={false} pendingBookings={{ length: 0 }} unreadMsgCount={0} />)
    expect((await screen.findByRole('link', { name: /Panneau admin/ }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/exit')
  })

  it('vrai artisan : aucun lien admin', async () => {
    h.session = sessionAvec({ role: 'artisan' })
    await act(async () => {
      render(<V5SidebarArtisan activePage="home" {...fonctions} isPt={false} pendingBookings={{ length: 0 }} unreadMsgCount={0} />)
    })
    expect(screen.queryByRole('link', { name: /Panneau admin/ })).toBeNull()
  })
})

describe('Administrateur judiciaire — pied de sidebar', () => {
  it('super_admin : lien « Panneau admin » vers /admin/dashboard', async () => {
    h.session = sessionAvec({ role: 'super_admin' })
    await act(async () => {
      render(<ToastProvider><Shell /></ToastProvider>)
    })
    expect((await screen.findByRole('link', { name: /Panneau admin/ }, { timeout: 5000 })).getAttribute('href')).toBe('/admin/dashboard')
  })

  it('compte syndic ordinaire : aucun lien', async () => {
    h.session = sessionAvec({ role: 'syndic' })
    await act(async () => {
      render(<ToastProvider><Shell /></ToastProvider>)
    })
    expect(screen.queryByRole('link', { name: /Panneau admin/ })).toBeNull()
  })
})
