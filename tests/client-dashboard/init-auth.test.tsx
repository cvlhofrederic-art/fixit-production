/**
 * Tableau de bord client (/{locale}/client/dashboard/) : plus d'état sans issue au chargement.
 *
 * Incident : une session gardée par le navigateur (super_admin, client ou rôle inconnu) envoyait sur ce
 * tableau de bord, qui restait indéfiniment sur son squelette quand getUser() levait une erreur ou ne
 * répondait pas (initAuth sans try/catch ni délai, setLoading(false) seulement à la fin de fetchBookings),
 * et renvoyait vers '/auth/login' (sans locale ni barre finale : 308 puis 302), d'où la page de connexion
 * le renvoyait aussitôt vers le tableau de bord.
 *
 * Contrat vérifié ici, sans aucun changement visible dans le parcours normal :
 * - session refusée (utilisateur nul sans erreur, AuthSessionMissingError, AuthApiError 401/403/404) → POST
 *   /api/auth/logout/ (suppression des seuls cookies sb-* côté serveur), PUIS /{locale}/auth/login/?session=echec ;
 * - service indisponible (autres 4xx dont 400 et 422, 408, 429, 5xx, réseau, délai dépassé, AbortError du verrou,
 *   exception) → /{locale}/auth/login/?session=echec, sans POST : la session n'est pas détruite sur une lenteur ;
 * - fetchBookings qui lève → le squelette disparaît, avec le toast existant des réservations ;
 * - déconnexion manuelle : la navigation vers /{locale}/ a lieu même si signOut échoue, lève ou ne répond pas ;
 * - le localStorage et le sessionStorage ne sont jamais modifiés (devis et factures des comptes pro).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthApiError, AuthInvalidTokenResponseError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'
import { LanguageProvider } from '@/lib/i18n/context'
import type { Locale } from '@/lib/i18n/config'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  order: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  generateCILEntries: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: mocks.getUser,
      signOut: mocks.signOut,
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: () => ({ select: () => ({ eq: () => ({ order: mocks.order }) }) }),
  },
}))

vi.mock('sonner', () => ({ toast: { error: mocks.toastError, success: mocks.toastSuccess } }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/fr/client/dashboard/',
  useSearchParams: () => new URLSearchParams(),
}))

// Les sections et l'assistant ne font pas partie du chargement de session : on les neutralise.
vi.mock('@/lib/dashboard-section-loader', () => ({ createDynamicSection: () => () => null }))
vi.mock('@/components/chat/FixyChatGeneric', () => ({ default: () => null }))
vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children, className, style }: { href: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
    <a href={href} className={className} style={style}>{children}</a>
  ),
}))

vi.mock('@/lib/cil-utils', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/cil-utils')>()
  mocks.generateCILEntries.mockImplementation(original.generateCILEntries)
  return { ...original, generateCILEntries: mocks.generateCILEntries }
})

import ClientDashboardPage from '@/app/client/dashboard/page'

const UTILISATEUR = {
  id: 'client-1',
  email: 'client@example.com',
  app_metadata: { role: 'client' },
  user_metadata: { full_name: 'Camille Client' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

// ── window.location simulée : on enregistre chaque navigation ──
let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined

function installerLocation() {
  navigations = []
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  const fausseLocation = {
    origin: 'https://vitfix.io',
    protocol: 'https:',
    host: 'vitfix.io',
    hostname: 'vitfix.io',
    port: '',
    pathname: '/fr/client/dashboard/',
    search: '',
    hash: '',
    get href() {
      return navigations.length ? navigations[navigations.length - 1] : 'https://vitfix.io/fr/client/dashboard/'
    },
    set href(valeur: string) {
      navigations.push(valeur)
    },
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  }
  Object.defineProperty(window, 'location', { configurable: true, value: fausseLocation })
}

function restaurerLocation() {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
}

// ── fetch simulé : seul POST /api/auth/logout/ nous intéresse ──
const fetchMock = vi.fn()
let navigationsAuMomentDuPost: string[] | null = null

// trailingSlash: true : la route est appelée avec sa barre finale, sans saut 308 pendant une navigation.
function appelsLogout() {
  return fetchMock.mock.calls.filter(([url]) => url === '/api/auth/logout/')
}

// Page de connexion après un échec de vérification : ?session=echec y coupe la redirection automatique (anti-boucle).
const CONNEXION_ECHEC_FR = '/fr/auth/login/?session=echec'

// ── stockage du navigateur : aucune écriture, aucun effacement ──
const espionsStockage: Array<ReturnType<typeof vi.spyOn>> = []

function espionnerStockage() {
  espionsStockage.length = 0
  for (const methode of ['setItem', 'removeItem', 'clear'] as const) {
    espionsStockage.push(vi.spyOn(Storage.prototype, methode))
  }
}

function expectStockageIntact() {
  for (const espion of espionsStockage) expect(espion).not.toHaveBeenCalled()
}

// ── rejets non gérés ──
const rejetsNonGeres: unknown[] = []
const surRejet = (raison: unknown) => { rejetsNonGeres.push(raison) }

let rappelAuth: ((evenement: string, session: unknown) => unknown) | null = null

function rendre(locale: Locale = 'fr') {
  return render(
    <LanguageProvider initialLocale={locale}>
      <ClientDashboardPage />
    </LanguageProvider>,
  )
}

/** Avance les minuteurs simulés puis laisse s'écouler les promesses en attente. */
async function avancer(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
  await act(async () => {
    for (let i = 0; i < 30; i++) await Promise.resolve()
  })
}

function squeletteAffiche() {
  return screen.queryByText('Déconnexion') === null && document.querySelectorAll('.animate-pulse').length > 0
}

beforeEach(() => {
  installerLocation()
  window.localStorage.clear()
  window.sessionStorage.clear()
  espionnerStockage()
  rejetsNonGeres.length = 0
  process.on('unhandledRejection', surRejet)
  navigationsAuMomentDuPost = null
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => {
    navigationsAuMomentDuPost = [...navigations]
    return { ok: true, status: 200, json: async () => ({ ok: true }) }
  })
  vi.stubGlobal('fetch', fetchMock)
  mocks.getUser.mockReset()
  mocks.signOut.mockReset()
  mocks.getSession.mockReset().mockResolvedValue({ data: { session: null }, error: null })
  mocks.order.mockReset().mockResolvedValue({ data: [], error: null })
  mocks.toastError.mockReset()
  mocks.toastSuccess.mockReset()
  rappelAuth = null
  mocks.onAuthStateChange.mockReset().mockImplementation((rappel: (evenement: string, session: unknown) => unknown) => {
    rappelAuth = rappel
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  process.off('unhandledRejection', surRejet)
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  restaurerLocation()
})

describe('tableau de bord client — session valide (parcours normal inchangé)', () => {
  it('affiche le tableau de bord, sans POST de déconnexion ni redirection', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    rendre()
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    expect(appelsLogout()).toHaveLength(0)
    expect(navigations).toEqual([])
    expect(mocks.toastError).not.toHaveBeenCalled()
    expectStockageIntact()
  })
})

describe('tableau de bord client — session refusée : déconnexion serveur puis page de connexion', () => {
  it.each([
    ['getUser renvoie un utilisateur null sans erreur', { data: { user: null }, error: null }],
    ['getUser renvoie AuthSessionMissingError', { data: { user: null }, error: new AuthSessionMissingError() }],
    ['getUser renvoie une AuthApiError 401', { data: { user: null }, error: new AuthApiError('missing authorization', 401, 'no_authorization') }],
    ['getUser renvoie une AuthApiError 403 (utilisateur inexistant)', { data: { user: null }, error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found') }],
    ['getUser renvoie une AuthApiError 404 (utilisateur supprimé)', { data: { user: null }, error: new AuthApiError('User not found', 404, 'user_not_found') }],
  ])('%s → POST /api/auth/logout/ puis /fr/auth/login/?session=echec', async (_cas, reponse) => {
    mocks.getUser.mockResolvedValue(reponse)
    rendre()
    await waitFor(() => expect(navigations).toEqual([CONNEXION_ECHEC_FR]))
    const appels = appelsLogout()
    expect(appels).toHaveLength(1)
    const [, options] = appels[0] as [string, RequestInit]
    expect(options.method).toBe('POST')
    expect(JSON.parse(String(options.body))).toEqual({ locale: 'fr' })
    expect(new Headers(options.headers).get('Accept')).toBe('application/json')
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json')
    // Le POST part AVANT la navigation : les cookies sb-* sont supprimés avant d'arriver sur la page de connexion.
    expect(navigationsAuMomentDuPost).toEqual([])
    expect(rejetsNonGeres).toEqual([])
    expectStockageIntact()
  })

  it('la redirection a lieu même si le POST de déconnexion échoue', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    rendre()
    await waitFor(() => expect(navigations).toEqual([CONNEXION_ECHEC_FR]))
    expect(appelsLogout()).toHaveLength(1)
    expect(rejetsNonGeres).toEqual([])
    expectStockageIntact()
  })

  it('la redirection a lieu même si le POST de déconnexion ne répond pas (au plus 5 s)', async () => {
    vi.useFakeTimers()
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    fetchMock.mockImplementation((_url: string, options: RequestInit) => new Promise((_resoudre, rejeter) => {
      options.signal?.addEventListener('abort', () => rejeter(new DOMException('The operation was aborted.', 'AbortError')))
    }))
    rendre()
    await avancer(0)
    expect(appelsLogout()).toHaveLength(1)
    expect(navigations).toEqual([])
    await avancer(5_000)
    expect(navigations).toEqual([CONNEXION_ECHEC_FR])
    expect(rejetsNonGeres).toEqual([])
  })

  it('session chargée par INITIAL_SESSION puis refusée par getUser → la validation l’emporte', async () => {
    let refuser: (valeur: unknown) => void = () => {}
    mocks.getUser.mockReturnValue(new Promise((resoudre) => { refuser = resoudre }))
    rendre()
    await act(async () => { await rappelAuth?.('INITIAL_SESSION', { user: UTILISATEUR }) })
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    expect(navigations).toEqual([])
    await act(async () => {
      refuser({ data: { user: null }, error: new AuthApiError('User from sub claim in JWT does not exist', 403, 'user_not_found') })
    })
    await waitFor(() => expect(navigations).toEqual([CONNEXION_ECHEC_FR]))
    expect(appelsLogout()).toHaveLength(1)
    expect(navigationsAuMomentDuPost).toEqual([])
    expectStockageIntact()
  })

  it('locale pt → corps { locale: "pt" } et /pt/auth/login/?session=echec', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('invalid JWT', 403, 'bad_jwt') })
    rendre('pt')
    await waitFor(() => expect(navigations).toEqual(['/pt/auth/login/?session=echec']))
    const [, options] = appelsLogout()[0] as [string, RequestInit]
    expect(JSON.parse(String(options.body))).toEqual({ locale: 'pt' })
  })
})

describe('tableau de bord client — service indisponible : page de connexion sans détruire la session', () => {
  it.each([
    ['getUser renvoie AuthRetryableFetchError (réseau coupé)', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })],
    ['getUser renvoie AuthRetryableFetchError 503', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Service Unavailable', 503) })],
    ['getUser renvoie une AuthApiError 500', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('Internal error', 500, 'unexpected_failure') })],
    ['getUser renvoie une AuthApiError 429 (trop de requêtes)', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('Too many requests', 429, 'over_request_rate_limit') })],
    ['getUser renvoie une AuthApiError 408', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('Request timeout', 408, 'request_timeout') })],
    ['getUser renvoie une AuthApiError 400', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found') })],
    ['getUser renvoie une AuthApiError 422', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('Unprocessable', 422, 'validation_failed') })],
    ['getUser renvoie AuthInvalidTokenResponseError', () => mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthInvalidTokenResponseError() })],
    ['getUser rejette une exception inattendue', () => mocks.getUser.mockRejectedValue(new TypeError('Failed to fetch'))],
    ['getUser rejette une AbortError (verrou navigateur)', () => mocks.getUser.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))],
  ])('%s → /fr/auth/login/?session=echec sans POST de déconnexion', async (_cas, preparer) => {
    preparer()
    rendre()
    await waitFor(() => expect(navigations).toEqual([CONNEXION_ECHEC_FR]))
    expect(appelsLogout()).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(rejetsNonGeres).toEqual([])
    expectStockageIntact()
  })

  it('getUser qui ne répond pas → squelette jusqu’à 10 s, puis page de connexion sans POST (session intacte)', async () => {
    vi.useFakeTimers()
    mocks.getUser.mockReturnValue(new Promise(() => {}))
    rendre()
    await avancer(9_999)
    expect(navigations).toEqual([])
    expect(squeletteAffiche()).toBe(true)
    await avancer(1)
    expect(navigations).toEqual([CONNEXION_ECHEC_FR])
    expect(appelsLogout()).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(mocks.signOut).not.toHaveBeenCalled()
    expect(rejetsNonGeres).toEqual([])
    expectStockageIntact()
  })

  it('locale pt → /pt/auth/login/?session=echec', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })
    rendre('pt')
    await waitFor(() => expect(navigations).toEqual(['/pt/auth/login/?session=echec']))
    expect(appelsLogout()).toHaveLength(0)
  })

  // Tableau de bord déjà affiché par INITIAL_SESSION : une vérification qui n'aboutit pas (réseau, lenteur)
  // ne doit pas en faire sortir l'utilisateur — seul un refus explicite le renvoie vers la connexion.
  it.each([
    ['réseau coupé', (resoudre: (v: unknown) => void) => resoudre({ data: { user: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })],
    ['AuthApiError 500', (resoudre: (v: unknown) => void) => resoudre({ data: { user: null }, error: new AuthApiError('Internal error', 500, 'unexpected_failure') })],
  ])('session chargée par INITIAL_SESSION puis vérification indisponible (%s) → le tableau de bord reste affiché', async (_cas, conclure) => {
    let resoudre: (valeur: unknown) => void = () => {}
    mocks.getUser.mockReturnValue(new Promise((r) => { resoudre = r }))
    rendre()
    await act(async () => { await rappelAuth?.('INITIAL_SESSION', { user: UTILISATEUR }) })
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    await act(async () => { conclure(resoudre) })
    await act(async () => { await Promise.resolve() })
    expect(navigations).toEqual([])
    expect(appelsLogout()).toHaveLength(0)
    expect(screen.getByText('Déconnexion')).toBeInTheDocument()
    expectStockageIntact()
  })

  it('session chargée par INITIAL_SESSION puis getUser au-delà de 10 s → le tableau de bord reste affiché', async () => {
    vi.useFakeTimers()
    mocks.getUser.mockReturnValue(new Promise(() => {}))
    rendre()
    await act(async () => { await rappelAuth?.('INITIAL_SESSION', { user: UTILISATEUR }) })
    await avancer(10_001)
    expect(navigations).toEqual([])
    expect(appelsLogout()).toHaveLength(0)
    expect(rejetsNonGeres).toEqual([])
  })
})

describe('tableau de bord client — fetchBookings ne bloque plus le squelette', () => {
  it('requête bookings qui rejette → le tableau de bord s’affiche, avec le toast existant des réservations', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    mocks.order.mockRejectedValue(new Error('réseau indisponible'))
    rendre()
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    // Même message que lorsque la requête renvoie { error } : aucun texte nouveau.
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Erreur de chargement des réservations')
    expect(console.error).toHaveBeenCalled()
    expect(navigations).toEqual([])
    expect(appelsLogout()).toHaveLength(0)
    expect(rejetsNonGeres).toEqual([])
    expectStockageIntact()
  })

  it('erreur renvoyée par la requête bookings → toast existant inchangé, tableau de bord affiché', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    mocks.order.mockResolvedValue({ data: null, error: { message: 'permission denied' } })
    rendre()
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
    expect(mocks.toastError).toHaveBeenCalledWith('Erreur de chargement des réservations')
  })

  it('génération du carnet de santé qui lève → le tableau de bord s’affiche quand même', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    mocks.order.mockResolvedValue({ data: [{ id: 'b1', booking_date: '2026-01-01', booking_time: '10:00', status: 'completed', address: '', notes: '', price_ttc: 100, duration_minutes: 60 }], error: null })
    mocks.generateCILEntries.mockImplementationOnce(() => { throw new Error('donnée inattendue') })
    rendre()
    expect(await screen.findByText('Déconnexion')).toBeInTheDocument()
    expect(mocks.toastError).not.toHaveBeenCalled()
    expect(rejetsNonGeres).toEqual([])
  })
})

describe('tableau de bord client — événement SIGNED_OUT', () => {
  it('vise /{locale}/auth/login/ (locale et barre finale)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    rendre('pt')
    expect(await screen.findByText('Terminar sessão')).toBeInTheDocument()
    expect(rappelAuth).not.toBeNull()
    await act(async () => { await rappelAuth?.('SIGNED_OUT', null) })
    expect(navigations).toEqual(['/pt/auth/login/'])
    expect(appelsLogout()).toHaveLength(0)
  })
})

describe('tableau de bord client — bouton Déconnexion existant', () => {
  async function cliquerDeconnexion() {
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    rendre()
    const bouton = await screen.findByText('Déconnexion')
    await act(async () => { fireEvent.click(bouton) })
  }

  it('signOut réussi → /fr/ comme aujourd’hui, sans POST de repli', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    await cliquerDeconnexion()
    await waitFor(() => expect(navigations).toEqual(['/fr/']))
    expect(appelsLogout()).toHaveLength(0)
    expectStockageIntact()
  })

  it('signOut renvoie { error } → POST /api/auth/logout puis /fr/', async () => {
    mocks.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    await cliquerDeconnexion()
    await waitFor(() => expect(navigations).toEqual(['/fr/']))
    expect(appelsLogout()).toHaveLength(1)
    expect(navigationsAuMomentDuPost).toEqual([])
    expectStockageIntact()
  })

  it('signOut qui lève → POST /api/auth/logout puis /fr/, sans rejet non géré', async () => {
    mocks.signOut.mockRejectedValue(new Error('verrou indisponible'))
    await cliquerDeconnexion()
    await waitFor(() => expect(navigations).toEqual(['/fr/']))
    expect(appelsLogout()).toHaveLength(1)
    expect(rejetsNonGeres).toEqual([])
  })

  it('signOut qui ne répond pas → POST /api/auth/logout puis /fr/ après 10 s', async () => {
    vi.useFakeTimers()
    mocks.getUser.mockResolvedValue({ data: { user: UTILISATEUR }, error: null })
    mocks.signOut.mockReturnValue(new Promise(() => {}))
    rendre()
    await avancer(0)
    const bouton = screen.getByText('Déconnexion')
    await act(async () => { fireEvent.click(bouton) })
    await avancer(9_999)
    expect(navigations).toEqual([])
    await avancer(1)
    expect(appelsLogout()).toHaveLength(1)
    expect(navigations).toEqual(['/fr/'])
    expect(rejetsNonGeres).toEqual([])
  })
})
