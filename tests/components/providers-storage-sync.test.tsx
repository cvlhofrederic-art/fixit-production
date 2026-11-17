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
//
// Lot 1 Sentry du 28/10/2026 : le bootstrap n'appelle plus getSession() (prise du verrou d'auth partagé entre
// onglets) — il reçoit la session de l'événement d'auth, hors du callback, un seul bootstrap à la fois, et plus
// de bootstrap immédiat en double (INITIAL_SESSION couvre le cas « déjà connecté »).

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render } from '@testing-library/react'

const installStorageSync = vi.fn()
const hydrateStorageFromServer = vi.fn()
const pushAllLocalToServer = vi.fn().mockResolvedValue({ count: 0 })
vi.mock('@/lib/storage-sync', () => ({ installStorageSync, hydrateStorageFromServer, pushAllLocalToServer }))
vi.mock('@/lib/document-sync', () => ({ importLocalStorageDocsToSupabase: vi.fn().mockResolvedValue(0) }))

// Isole Providers de l'i18n et du Toaster (non pertinents pour ce contrat).
vi.mock('@/lib/i18n/context', () => ({ LanguageProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('sonner', () => ({ Toaster: () => null }))

type Rappel = (event: string, session: unknown) => unknown
const rappels: Rappel[] = []
const mockGetSession = vi.fn()
const mockOnAuthStateChange = vi.fn((rappel: Rappel) => {
  rappels.push(rappel)
  return { data: { subscription: { unsubscribe: vi.fn() } } }
})
vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange } },
}))

const SESSION = { access_token: 'tok', user: { id: 'u1' } }
// Laisse passer le setTimeout(0) du bootstrap différé et les microtâches qui suivent.
const laisserTourner = () => new Promise((r) => setTimeout(r, 5))

beforeEach(() => {
  vi.clearAllMocks()
  rappels.length = 0
  hydrateStorageFromServer.mockResolvedValue({ count: 0 })
  mockGetSession.mockResolvedValue({ data: { session: null } })
})

describe('Providers — bootstrap storage-sync', () => {
  it('installe le miroir localStorage au mount, même sans session immédiate', async () => {
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    await laisserTourner()
    expect(installStorageSync).toHaveBeenCalled()
    expect(mockOnAuthStateChange).toHaveBeenCalled()
  })

  it("hydrate sur INITIAL_SESSION avec la session de l'événement, sans getSession()", async () => {
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    await laisserTourner()
    expect(hydrateStorageFromServer).not.toHaveBeenCalled()

    rappels.forEach((rappel) => rappel('INITIAL_SESSION', SESSION))
    await laisserTourner()
    await laisserTourner()
    expect(hydrateStorageFromServer).toHaveBeenCalledTimes(1)
    expect(mockGetSession).not.toHaveBeenCalled()
  })

  it('le callback d’auth est synchrone et ne lance rien sans session', async () => {
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    await laisserTourner()

    const retours = rappels.map((rappel) => rappel('INITIAL_SESSION', null))
    for (const retour of retours) expect(retour).toBeUndefined()
    await laisserTourner()
    expect(hydrateStorageFromServer).not.toHaveBeenCalled()
  })

  it('deux événements rapprochés : un seul bootstrap à la fois', async () => {
    let terminerHydratation: (valeur: { count: number }) => void = () => {}
    hydrateStorageFromServer.mockReturnValue(new Promise((resoudre) => { terminerHydratation = resoudre }))
    const Providers = (await import('@/components/common/Providers')).default
    render(<Providers locale="fr">{null}</Providers>)
    await laisserTourner()

    rappels.forEach((rappel) => rappel('INITIAL_SESSION', SESSION))
    rappels.forEach((rappel) => rappel('SIGNED_IN', SESSION))
    await laisserTourner()
    expect(hydrateStorageFromServer).toHaveBeenCalledTimes(1)

    terminerHydratation({ count: 3 })
    await laisserTourner()
    expect(hydrateStorageFromServer).toHaveBeenCalledTimes(1)

    // Une fois le premier bootstrap terminé, un nouvel événement relance bien l'hydratation.
    rappels.forEach((rappel) => rappel('TOKEN_REFRESHED', SESSION))
    await laisserTourner()
    expect(hydrateStorageFromServer).toHaveBeenCalledTimes(2)
  })
})
