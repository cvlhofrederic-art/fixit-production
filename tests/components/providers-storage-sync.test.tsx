// Régression : le miroir localStorage <-> user_storage (storage-sync) ne
// s'installait jamais en prod.
//
// Cause racine : <Providers> instanciait son PROPRE client via createClient de
// @supabase/supabase-js (session lue dans le localStorage), alors que l'auth de
// l'app est en cookies SSR. getSession() renvoyait donc null au mount, et
// bootstrap() sortait AVANT installStorageSync() — le patch n'était jamais posé.
// Conséquence : aucune donnée pro (dont la base clients) n'était sauvegardée
// dans le cloud → perte au vidage du cache / changement d'appareil.
//
// Contrat garanti ici : installStorageSync() est appelé au mount, même quand
// aucune session n'est immédiatement disponible (pire cas : session restaurée
// via cookies après coup, sans event SIGNED_IN).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

const installStorageSync = vi.fn()
const hydrateStorageFromServer = vi.fn().mockResolvedValue({ count: 0 })
const pushAllLocalToServer = vi.fn().mockResolvedValue({ count: 0 })
vi.mock('@/lib/storage-sync', () => ({ installStorageSync, hydrateStorageFromServer, pushAllLocalToServer }))
vi.mock('@/lib/document-sync', () => ({ importLocalStorageDocsToSupabase: vi.fn().mockResolvedValue(0) }))

// Isole Providers de l'i18n et du Toaster (non pertinents pour ce contrat).
vi.mock('@/lib/i18n/context', () => ({ LanguageProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('sonner', () => ({ Toaster: () => null }))

const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn((_cb: (event: string) => void) => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange } },
}))

// Garde-fou : un client @supabase/supabase-js ad hoc ne voit pas la session.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Pire cas : aucune session immédiate au mount.
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

describe('Providers — bootstrap storage-sync', () => {
  it('installe le miroir localStorage au mount, même sans session immédiate', async () => {
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    // Laisse le microtask de bootstrap se dérouler.
    await Promise.resolve()
    await Promise.resolve()
    expect(installStorageSync).toHaveBeenCalled()
  })

  it("réagit à l'event INITIAL_SESSION (session restaurée via cookies)", async () => {
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    await Promise.resolve()
    const handler = mockOnAuthStateChange.mock.calls[0]?.[0]
    expect(handler).toBeTypeOf('function')
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    handler!('INITIAL_SESSION')
    await Promise.resolve()
    await Promise.resolve()
    expect(hydrateStorageFromServer).toHaveBeenCalled()
  })
})
