/**
 * Tableau de bord client (/{locale}/client/dashboard/) : plus de boucle ni de squelette sans issue au chargement
 * (lot 1 de l'analyse Sentry du 28/10/2026, issues C et X : AbortError du verrou d'auth, page qui repartait en
 * boucle toutes les 23 s le 08/10).
 *
 * Contrat vérifié ici :
 * - session validée par getUser() → réservations chargées, aucune navigation ;
 * - session refusée (utilisateur nul sans erreur, AuthApiError 401) → UNE seule redirection vers
 *   /{locale}/auth/login/, même si SIGNED_OUT arrive ensuite ;
 * - AbortError du verrou d'auth (deux fois, second essai compris) → ni navigation ni rechargement, un toast ;
 * - le callback onAuthStateChange est synchrone (jamais de promesse renvoyée) et le chargement des réservations
 *   sur INITIAL_SESSION est différé.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import { AuthApiError } from '@supabase/supabase-js'

type Rappel = (event: string, session: unknown) => unknown

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  rappels: [] as Rappel[],
  order: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      onAuthStateChange: (rappel: Rappel) => {
        mocks.rappels.push(rappel)
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    from: () => ({ select: () => ({ eq: () => ({ order: mocks.order }) }) }),
  },
}))

vi.mock('@/lib/auth/jeton-acces', () => ({ jetonAcces: vi.fn(async () => 'jeton') }))
vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/fr/client/dashboard/',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: () => {} }),
  useLocale: () => 'fr',
}))
// Les sections et l'assistant ne font pas partie du chargement de session : on les neutralise.
vi.mock('@/lib/dashboard-section-loader', () => ({ createDynamicSection: () => () => null }))
vi.mock('@/components/chat/FixyChatGeneric', () => ({ default: () => null }))
vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

import ClientDashboardPage from '@/app/client/dashboard/page'

const UTILISATEUR = {
  id: 'client-1',
  email: 'client@example.com',
  app_metadata: { role: 'client' },
  user_metadata: { full_name: 'Camille Client' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

const abortError = () => new DOMException('signal is aborted without reason', 'AbortError')

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
      pathname: '/fr/client/dashboard/',
      search: '',
      hash: '',
      get href() { return 'https://vitfix.io/fr/client/dashboard/' },
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
  mocks.order.mockResolvedValue({ data: [], error: null })
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  installerLocation()
})

afterEach(() => {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('tableau de bord client — initialisation de la session', () => {
  it('session valide : réservations chargées, aucune navigation', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    render(<ClientDashboardPage />)

    await waitFor(() => expect(mocks.order).toHaveBeenCalledTimes(1))
    expect(navigations).toEqual([])
    expect(rechargements).toBe(0)
    expect(mocks.toastError).not.toHaveBeenCalled()
  })

  it('session absente (utilisateur nul) : une seule redirection vers /fr/auth/login/, même après SIGNED_OUT', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    render(<ClientDashboardPage />)

    await waitFor(() => expect(navigations).toEqual(['/fr/auth/login/']))
    act(() => { mocks.rappels.forEach((r) => r('SIGNED_OUT', null)) })
    expect(navigations).toEqual(['/fr/auth/login/'])
    expect(mocks.order).not.toHaveBeenCalled()
  })

  it('session refusée par Supabase (401) : une seule redirection', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('invalid JWT', 401, 'bad_jwt') })
    render(<ClientDashboardPage />)

    await waitFor(() => expect(navigations).toEqual(['/fr/auth/login/']))
  })

  it('AbortError du verrou d’auth (deux fois) : ni navigation ni rechargement, un toast, second essai', async () => {
    mocks.getUser.mockRejectedValue(abortError())
    render(<ClientDashboardPage />)

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1), { timeout: 3000 })
    expect(mocks.getUser).toHaveBeenCalledTimes(2)
    expect(navigations).toEqual([])
    expect(rechargements).toBe(0)
  })

  it('erreur 500 de Supabase : session inconnue, ni navigation ni rechargement', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('boom', 500, 'unexpected_failure') })
    render(<ClientDashboardPage />)

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1))
    expect(navigations).toEqual([])
    expect(mocks.getUser).toHaveBeenCalledTimes(1)
  })

  it('callback onAuthStateChange synchrone : INITIAL_SESSION charge les réservations en différé', async () => {
    mocks.getUser.mockReturnValue(new Promise(() => {}))
    render(<ClientDashboardPage />)

    await waitFor(() => expect(mocks.rappels.length).toBeGreaterThan(0))
    let retour: unknown = 'non appelé'
    act(() => { retour = mocks.rappels[0]('INITIAL_SESSION', { user: UTILISATEUR, access_token: 'jeton' }) })
    expect(retour).toBeUndefined()
    expect(mocks.order).not.toHaveBeenCalled()
    await act(async () => { await attendre(10) })
    expect(mocks.order).toHaveBeenCalledTimes(1)
    expect(navigations).toEqual([])
  })
})
