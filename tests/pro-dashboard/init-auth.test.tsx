/**
 * Tableau de bord pro / artisan (/{locale}/pro/dashboard/) : reprise d'une session restée indisponible au chargement
 * (lot 1 de l'analyse Sentry du 28/10/2026).
 *
 * Jeton expiré et rafraîchissement en échec réseau au chargement : getSession() rend une erreur réseau (session
 * « indisponible »), auth-js émet INITIAL_SESSION nul, puis son tick d'auto-refresh réussit et n'émet que
 * TOKEN_REFRESHED. Contrat vérifié ici :
 * - session indisponible → ni navigation ni rechargement, aucun chargement ;
 * - TOKEN_REFRESHED avec une session → chargement du tableau de bord, une seule fois et en différé (callback
 *   synchrone) ; les rafraîchissements suivants ne relancent rien ;
 * - session lue au chargement → TOKEN_REFRESHED ultérieur ne recharge rien ;
 * - TOKEN_REFRESHED pendant la lecture initiale (jeton expiré rafraîchi à l'initialisation du client, page déjà
 *   abonnée) → un seul chargement, la lecture initiale ne relance rien.
 *
 * La page est rendue avec ses hooks, ses sections et ses utilitaires neutralisés : elle reste sur son écran de
 * chargement. Témoin du chargement : la première lecture de loadDashboardData (profil artisan), laissée en suspens
 * pour ne rien rendre au-delà.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { AuthRetryableFetchError } from '@supabase/supabase-js'

type Rappel = (event: string, session: unknown) => unknown

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  signOut: vi.fn(),
  rappels: [] as Rappel[],
  from: vi.fn(),
  eq: vi.fn(),
  single: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/supabase', async () => (await import('../helpers/simulations-dashboard')).moduleSupabaseSimule({
  auth: { getSession: mocks.getSession, signOut: mocks.signOut },
  rappels: mocks.rappels,
  from: mocks.from,
}))

vi.mock('next/navigation', async () => (await import('../helpers/simulations-dashboard')).moduleNavigationSimule('/fr/pro/dashboard/', mocks.push))
vi.mock('next/dynamic', () => ({ default: () => () => null }))
vi.mock('@/lib/i18n/context', async () => (await import('../helpers/simulations-dashboard')).moduleI18nSimule())
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))
// Hooks, sections et utilitaires du tableau de bord : hors du chargement de session, on les neutralise.
vi.mock('@/hooks/dashboard', () => ({
  useServices: () => ({}),
  useAbsences: () => ({}),
  useAvailability: () => ({}),
  useCalendar: () => ({}),
  useSettings: () => ({}),
  useBookings: () => ({}),
}))
vi.mock('@/hooks/useDashboardMessaging', () => ({ useDashboardMessaging: () => ({}) }))
vi.mock('@/hooks/useModulesConfig', () => ({ useModulesConfig: () => ({}) }))
vi.mock('@/hooks/useModuleCategories', () => ({ useModuleCategories: () => ({}) }))
vi.mock('@/hooks/usePermissions', () => ({ usePermissions: () => ({}) }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({}) }))
vi.mock('@/components/common/SectionErrorBoundary', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/hooks/useOrgRoleContext', () => ({
  OrgRoleProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/lib/hooks/use-btp-data', () => ({ prefetchBTPTables: vi.fn() }))
vi.mock('@/lib/bookings-fetch', () => ({ fetchAllBookings: vi.fn() }))
vi.mock('@/lib/document-sync', () => ({ fetchDocumentsFromSupabase: vi.fn(async () => []), persistEmittedDocsToCache: vi.fn() }))
vi.mock('@/lib/devis-utils', () => ({ dedupeDocsByIdentity: (docs: unknown[]) => docs }))
vi.mock('@/lib/seed-demo-localStorage', () => ({ seedDemoLocalStorage: vi.fn() }))
vi.mock('@/lib/service-utils', () => ({ getPriceRangeLabel: vi.fn(), getPricingUnit: vi.fn(), getCleanDescription: vi.fn() }))
vi.mock('@/lib/messagerie-pro', () => ({ notificationOuvreMessagerie: vi.fn() }))

import DashboardPageWrapper from '@/app/pro/dashboard/page'

const UTILISATEUR = {
  id: 'artisan-1',
  email: 'artisan@example.com',
  app_metadata: { role: 'artisan' },
  user_metadata: { full_name: 'Alex Artisan' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

// window.location simulée : chaque navigation est enregistrée au lieu d'être exécutée.
let navigations: string[] = []
let rechargements = 0
let descripteurLocation: PropertyDescriptor | undefined

function installerLocation() {
  navigations = []
  rechargements = 0
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io',
      pathname: '/fr/pro/dashboard/',
      search: '',
      hash: '',
      get href() { return 'https://vitfix.io/fr/pro/dashboard/' },
      set href(valeur: string) { navigations.push(valeur) },
      assign: (valeur: string) => { navigations.push(valeur) },
      replace: (valeur: string) => { navigations.push(valeur) },
      reload: () => { rechargements += 1 },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.rappels.length = 0
  // Lecture du profil artisan laissée en suspens : la page reste sur son écran de chargement.
  mocks.single.mockReturnValue(new Promise(() => {}))
  mocks.eq.mockReturnValue({ single: mocks.single })
  mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  installerLocation()
})

afterEach(() => {
  vi.restoreAllMocks()
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('tableau de bord pro — reprise d’une session indisponible au chargement', () => {
  it('lecture initiale indisponible, INITIAL_SESSION nul puis TOKEN_REFRESHED : tableau de bord chargé une seule fois, en différé', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })
    render(<DashboardPageWrapper />)

    await waitFor(() => expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[pro/dashboard] session indisponible')))
    act(() => { mocks.rappels[0]('INITIAL_SESSION', null) })
    await act(async () => { await attendre(10) })
    expect(mocks.from).not.toHaveBeenCalled()

    const session = { user: UTILISATEUR, access_token: 'jeton-rafraichi' }
    let retour: unknown = 'non appelé'
    act(() => { retour = mocks.rappels[0]('TOKEN_REFRESHED', session) })
    expect(retour).toBeUndefined()
    expect(mocks.from).not.toHaveBeenCalled()
    await act(async () => { await attendre(10) })
    expect(mocks.from).toHaveBeenCalledWith('profiles_artisan')
    expect(mocks.eq).toHaveBeenCalledWith('user_id', 'artisan-1')
    expect(mocks.single).toHaveBeenCalledTimes(1)

    // Rafraîchissements suivants du jeton : rien n'est rechargé.
    act(() => {
      mocks.rappels[0]('TOKEN_REFRESHED', session)
      mocks.rappels[0]('SIGNED_IN', session)
    })
    await act(async () => { await attendre(10) })
    expect(mocks.single).toHaveBeenCalledTimes(1)
    expect(mocks.getSession).toHaveBeenCalledTimes(1)
    expect(navigations).toEqual([])
    expect(rechargements).toBe(0)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('session lue au chargement : tableau de bord chargé une fois, TOKEN_REFRESHED ultérieur ne recharge rien', async () => {
    const session = { user: UTILISATEUR, access_token: 'jeton' }
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    render(<DashboardPageWrapper />)

    await waitFor(() => expect(mocks.single).toHaveBeenCalledTimes(1))
    act(() => {
      mocks.rappels[0]('INITIAL_SESSION', session)
      mocks.rappels[0]('TOKEN_REFRESHED', { ...session, access_token: 'jeton-rafraichi' })
    })
    await act(async () => { await attendre(10) })
    expect(mocks.single).toHaveBeenCalledTimes(1)
    expect(navigations).toEqual([])
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it('TOKEN_REFRESHED pendant la lecture initiale (jeton rafraîchi à l’initialisation du client) : un seul chargement', async () => {
    const session = { user: UTILISATEUR, access_token: 'jeton-rafraichi' }
    let rendreSession: (reponse: unknown) => void = () => {}
    mocks.getSession.mockReturnValue(new Promise((resoudre) => { rendreSession = resoudre }))
    render(<DashboardPageWrapper />)

    await waitFor(() => expect(mocks.rappels.length).toBeGreaterThan(0))
    act(() => { mocks.rappels[0]('TOKEN_REFRESHED', session) })
    await act(async () => { await attendre(10) })
    expect(mocks.single).toHaveBeenCalledTimes(1)

    // getSession() attend la fin de l'initialisation puis rend la session rafraîchie.
    await act(async () => {
      rendreSession({ data: { session }, error: null })
      await attendre(10)
    })
    expect(mocks.single).toHaveBeenCalledTimes(1)
    expect(navigations).toEqual([])
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
