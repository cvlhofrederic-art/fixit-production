/**
 * Page de connexion ouverte par un navigateur qui garde déjà une session Supabase.
 *
 * Avant : checkAuth lisait getSession() — la session stockée dans les cookies, jamais validée auprès de Supabase — et
 * redirigeait d'office vers l'espace du rôle (client pour un rôle absent ou inconnu). Une session refusée par le serveur
 * renvoyait donc vers un tableau de bord qui ne pouvait pas se charger, et le formulaire n'était jamais affiché : aucun
 * moyen de changer de compte.
 * Après : la décision repose sur getUser() (session validée), classée par le même classificateur que le tableau de
 * bord client (lib/auth/session-navigateur.ts). Session refusée (utilisateur nul sans erreur, AuthSessionMissingError,
 * AuthApiError 401/403/404) → fermeture de la session locale, le formulaire reste affiché. Tout le reste (autres 4xx dont
 * 400 et 422, 408, 429, 5xx, réseau, exception) → ni redirection ni déconnexion, le formulaire reste affiché.
 * Dès que l'utilisateur lance une connexion (formulaire ou Google), une vérification encore en cours ne redirige plus et
 * ne ferme plus rien : elle ne peut ni révoquer la nouvelle session ni écraser la redirection d'après connexion.
 * Les destinations par rôle sont inchangées et l'écran affiché est celui d'un visiteur sans session : aucun texte nouveau.
 * Le client Supabase est simulé.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'

const simul = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  locale: 'fr',
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: simul.getSession,
      getUser: simul.getUser,
      signOut: simul.signOut,
      signInWithPassword: simul.signInWithPassword,
      signInWithOAuth: simul.signInWithOAuth,
    },
  },
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: simul.locale, setLocale: () => {} }),
  useLocale: () => simul.locale,
}))

vi.mock('@/components/common/LocaleLink', async () => {
  const { createElement } = await import('react')
  return {
    default: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) =>
      createElement('a', { href, ...reste }, children),
  }
})

const { default: LoginPage } = await import('@/app/auth/login/page')

// ── window.location simulé : on enregistre les navigations au lieu de les exécuter ──
let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined

function ouvrir(url = 'https://vitfix.io/fr/auth/login/') {
  const courante = new URL(url)
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      get href() { return courante.href },
      set href(destination: string) { navigations.push(destination) },
      get search() { return courante.search },
      get pathname() { return courante.pathname },
      get origin() { return courante.origin },
      assign: (destination: string) => { navigations.push(destination) },
      replace: (destination: string) => { navigations.push(destination) },
    },
  })
}

const SESSION_LOCALE = {
  access_token: 'jeton-local',
  refresh_token: 'rafraichissement',
  user: { id: 'u1', app_metadata: { role: 'artisan' }, user_metadata: {} },
}

function sessionLocalePresente() {
  simul.getSession.mockResolvedValue({ data: { session: SESSION_LOCALE }, error: null })
}

function utilisateurValide(appMetadata: Record<string, unknown>, userMetadata: Record<string, unknown> = {}) {
  simul.getUser.mockResolvedValue({
    data: { user: { id: 'u1', app_metadata: appMetadata, user_metadata: userMetadata } },
    error: null,
  })
}

function sessionRefusee(erreur: unknown) {
  simul.getUser.mockResolvedValue({ data: { user: null }, error: erreur })
}

/** Laisse s'achever les promesses en cours (vérification de session) avant de constater l'absence d'effet. */
async function laisserFinir() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function ouvrirLeFormulaire() {
  fireEvent.click(screen.getByText('auth.espaceParticulier'))
  return screen.findByLabelText('Adresse email')
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  navigations = []
  simul.locale = 'fr'
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  ouvrir()
  simul.getSession.mockReset()
  simul.getSession.mockResolvedValue({ data: { session: null }, error: null })
  simul.getUser.mockReset()
  simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
  simul.signOut.mockReset()
  simul.signOut.mockResolvedValue({ error: null })
  simul.signInWithPassword.mockReset()
  simul.signInWithOAuth.mockReset()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
  vi.restoreAllMocks()
})

describe('session existante validée par getUser', () => {
  it.each([
    ['artisan', '/fr/artisan/dashboard'],
    ['pro_societe', '/fr/pro/dashboard'],
    ['pro_conciergerie', '/fr/pro/dashboard'],
    ['pro_gestionnaire', '/fr/pro/dashboard'],
    ['syndic', '/fr/syndic/dashboard'],
    ['syndic_admin', '/fr/syndic/dashboard'],
    ['super_admin', '/fr/client/dashboard'],
    ['coproprio', '/fr/client/dashboard'],
    ['client', '/fr/client/dashboard'],
    ['inconnu', '/fr/client/dashboard'],
  ])('rôle %s → %s (destination inchangée)', async (role, attendu) => {
    sessionLocalePresente()
    utilisateurValide({ role })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual([attendu]))
    expect(simul.getUser).toHaveBeenCalledTimes(1)
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('rôle absent → tableau de bord client, comme avant', async () => {
    sessionLocalePresente()
    utilisateurValide({})
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/fr/client/dashboard']))
  })

  it('garde la langue de la page', async () => {
    simul.locale = 'pt'
    ouvrir('https://vitfix.io/pt/auth/login/')
    sessionLocalePresente()
    utilisateurValide({ role: 'pro_societe' })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/pt/pro/dashboard']))
  })

  it('prend le rôle de l’utilisateur validé (app_metadata), jamais celui de la session locale ni de user_metadata', async () => {
    sessionLocalePresente() // session locale : role artisan
    utilisateurValide({ role: 'client' }, { role: 'artisan' })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/fr/client/dashboard']))
  })

  it('ne redirige jamais d’office quand le tableau de bord signale un échec (?session=echec)', async () => {
    ouvrir('https://vitfix.io/fr/auth/login/?session=echec')
    sessionLocalePresente()
    utilisateurValide({ role: 'client' })
    render(<LoginPage />)
    await waitFor(() => expect(simul.getUser).toHaveBeenCalled())
    await laisserFinir()
    expect(navigations).toEqual([])
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(await ouvrirLeFormulaire()).toBeInTheDocument()
  })
})

describe('sans session locale', () => {
  it('n’appelle pas Supabase, ne redirige pas et ne déconnecte rien', async () => {
    render(<LoginPage />)
    await waitFor(() => expect(simul.getSession).toHaveBeenCalled())
    await laisserFinir()
    expect(simul.getUser).not.toHaveBeenCalled()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
    expect(screen.getByText('auth.espaceParticulier')).toBeInTheDocument()
  })

  it('une lecture de session en erreur est journalisée, sans redirection ni appel à getUser', async () => {
    simul.getSession.mockResolvedValue({ data: { session: null }, error: new AuthRetryableFetchError('Failed to fetch', 0) })
    render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(simul.getUser).not.toHaveBeenCalled()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
  })
})

describe('session refusée par Supabase', () => {
  it.each([
    ['AuthApiError 403 (jeton refusé)', new AuthApiError('invalid JWT', 403, 'bad_jwt')],
    ['AuthApiError 401', new AuthApiError('missing authorization', 401, 'no_authorization')],
    ['AuthApiError 404 (utilisateur supprimé)', new AuthApiError('User not found', 404, 'user_not_found')],
    ['AuthSessionMissingError (session supprimée)', new AuthSessionMissingError()],
    ['utilisateur absent sans erreur', null],
  ])('%s → ferme la session locale et garde le formulaire', async (_cas, erreur) => {
    sessionLocalePresente()
    sessionRefusee(erreur)
    render(<LoginPage />)
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    await laisserFinir()
    expect(simul.signOut).toHaveBeenCalledTimes(1)
    expect(navigations).toEqual([])
    expect(await ouvrirLeFormulaire()).toBeInTheDocument()
  })

  it('affiche exactement l’écran d’un visiteur sans session (aucun texte nouveau)', async () => {
    const { container: sansSession, unmount } = render(<LoginPage />)
    await laisserFinir()
    const texteSansSession = sansSession.textContent
    unmount()

    sessionLocalePresente()
    sessionRefusee(new AuthApiError('invalid JWT', 403, 'bad_jwt'))
    const { container } = render(<LoginPage />)
    await waitFor(() => expect(simul.signOut).toHaveBeenCalled())
    await laisserFinir()
    expect(container.textContent).toBe(texteSansSession)
  })

  it('un échec de signOut (exception ou erreur renvoyée) n’empêche pas le formulaire et est journalisé', async () => {
    sessionLocalePresente()
    sessionRefusee(new AuthApiError('invalid JWT', 403, 'bad_jwt'))
    simul.signOut.mockRejectedValue(new TypeError('Failed to fetch'))
    const { unmount } = render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(navigations).toEqual([])
    expect(await ouvrirLeFormulaire()).toBeInTheDocument()
    unmount()

    consoleError.mockClear()
    simul.signOut.mockReset()
    simul.signOut.mockResolvedValue({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(navigations).toEqual([])
  })
})

describe('Supabase injoignable ou en erreur', () => {
  it.each([
    ['erreur réseau (AuthRetryableFetchError)', new AuthRetryableFetchError('Failed to fetch', 0)],
    ['passerelle indisponible (AuthRetryableFetchError 503)', new AuthRetryableFetchError('Service Unavailable', 503)],
    ['erreur serveur (AuthApiError 500)', new AuthApiError('Internal error', 500, 'unexpected_failure')],
    ['limitation de débit (AuthApiError 429)', new AuthApiError('Too many requests', 429, 'over_request_rate_limit')],
    ['requête refusée (AuthApiError 400)', new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found')],
    ['requête invalide (AuthApiError 422)', new AuthApiError('Unprocessable', 422, 'validation_failed')],
  ])('%s → ni redirection ni déconnexion, formulaire affiché, erreur journalisée', async (_cas, erreur) => {
    sessionLocalePresente()
    sessionRefusee(erreur)
    render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
    expect(await ouvrirLeFormulaire()).toBeInTheDocument()
  })

  it('getUser qui rejette (requête interrompue, verrou) → aucune redirection, aucun rejet non géré', async () => {
    sessionLocalePresente()
    simul.getUser.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
    render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
    expect(await ouvrirLeFormulaire()).toBeInTheDocument()
  })

  it('getSession qui rejette → aucune redirection, aucun rejet non géré', async () => {
    simul.getSession.mockRejectedValue(new Error('Acquiring an exclusive Navigator LockManager lock timed out'))
    render(<LoginPage />)
    await waitFor(() => expect(consoleError).toHaveBeenCalled())
    await laisserFinir()
    expect(simul.getUser).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
  })
})

describe('connexion avec le formulaire', () => {
  async function seConnecter(role: string | undefined) {
    simul.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u2', app_metadata: role === undefined ? {} : { role } } },
      error: null,
    })
    render(<LoginPage />)
    const email = await ouvrirLeFormulaire()
    fireEvent.change(email, { target: { value: 'compte@exemple.fr' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret-de-test' } })
    fireEvent.submit(email.closest('form') as HTMLFormElement)
    await waitFor(() => expect(navigations).toHaveLength(1))
  }

  it.each([
    ['artisan', '/fr/artisan/dashboard'],
    ['pro_societe', '/fr/pro/dashboard'],
    ['syndic_admin', '/fr/syndic/dashboard'],
    ['super_admin', '/fr/client/dashboard'],
    [undefined, '/fr/client/dashboard'],
  ])('rôle %s → %s (même table qu’avant)', async (role, attendu) => {
    await seConnecter(role)
    expect(navigations).toEqual([attendu])
  })

  it('redirige après une connexion explicite, même avec ?session=echec', async () => {
    ouvrir('https://vitfix.io/fr/auth/login/?session=echec')
    await seConnecter('pro_societe')
    expect(navigations).toEqual(['/fr/pro/dashboard'])
  })
})

describe('connexion lancée pendant une vérification de session lente', () => {
  /** getUser en attente : la vérification lancée à l'ouverture de la page ne répond qu'à l'appel de `repondre`. */
  function verificationEnAttente() {
    let repondre: (valeur: unknown) => void = () => {}
    simul.getUser.mockReturnValue(new Promise((resoudre) => { repondre = resoudre }))
    return (valeur: unknown) => act(async () => { repondre(valeur) })
  }

  async function soumettreLeFormulaire(role: string) {
    simul.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u2', app_metadata: { role } } }, error: null })
    const email = await ouvrirLeFormulaire()
    fireEvent.change(email, { target: { value: 'compte@exemple.fr' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret-de-test' } })
    fireEvent.submit(email.closest('form') as HTMLFormElement)
    await waitFor(() => expect(navigations).toHaveLength(1))
  }

  it('getUser répond 403 après la soumission du formulaire → la nouvelle session n’est pas fermée', async () => {
    sessionLocalePresente()
    const repondre = verificationEnAttente()
    render(<LoginPage />)
    await waitFor(() => expect(simul.getUser).toHaveBeenCalled())
    await soumettreLeFormulaire('client')
    await repondre({ data: { user: null }, error: new AuthApiError('invalid JWT', 403, 'bad_jwt') })
    await laisserFinir()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual(['/fr/client/dashboard'])
  })

  it('getUser lent qui valide l’ancienne session → n’écrase pas la redirection d’après connexion', async () => {
    sessionLocalePresente() // ancienne session : artisan
    const repondre = verificationEnAttente()
    render(<LoginPage />)
    await waitFor(() => expect(simul.getUser).toHaveBeenCalled())
    await soumettreLeFormulaire('pro_societe')
    await repondre({ data: { user: { id: 'u1', app_metadata: { role: 'artisan' }, user_metadata: {} } }, error: null })
    await laisserFinir()
    expect(navigations).toEqual(['/fr/pro/dashboard'])
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('fermeture de la session refusée déjà lancée → la connexion attend sa fin (son signOut n’efface pas la nouvelle)', async () => {
    // auth-js : signInWithPassword ne prend pas le verrou, et signOut retire la session stockée APRÈS son appel réseau.
    sessionLocalePresente()
    sessionRefusee(new AuthApiError('invalid JWT', 403, 'bad_jwt'))
    let terminerFermeture: (valeur: unknown) => void = () => {}
    simul.signOut.mockReturnValue(new Promise((resoudre) => { terminerFermeture = resoudre }))
    simul.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u2', app_metadata: { role: 'client' } } }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    const email = await ouvrirLeFormulaire()
    fireEvent.change(email, { target: { value: 'compte@exemple.fr' } })
    fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'secret-de-test' } })
    fireEvent.submit(email.closest('form') as HTMLFormElement)
    await laisserFinir()
    expect(simul.signInWithPassword).not.toHaveBeenCalled()
    await act(async () => { terminerFermeture({ error: null }) })
    await waitFor(() => expect(navigations).toEqual(['/fr/client/dashboard']))
    expect(simul.signInWithPassword).toHaveBeenCalledTimes(1)
    expect(simul.signOut).toHaveBeenCalledTimes(1)
  })

  it('fermeture de la session refusée déjà lancée → la connexion Google attend sa fin (code-verifier PKCE préservé)', async () => {
    sessionLocalePresente()
    sessionRefusee(new AuthApiError('invalid JWT', 403, 'bad_jwt'))
    let terminerFermeture: (valeur: unknown) => void = () => {}
    simul.signOut.mockReturnValue(new Promise((resoudre) => { terminerFermeture = resoudre }))
    simul.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.example/oauth' }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    await ouvrirLeFormulaire()
    await act(async () => { fireEvent.click(screen.getByText('Continuer avec Google')) })
    await laisserFinir()
    expect(simul.signInWithOAuth).not.toHaveBeenCalled()
    await act(async () => { terminerFermeture({ error: null }) })
    await waitFor(() => expect(simul.signInWithOAuth).toHaveBeenCalledTimes(1))
  })

  it.each([
    ['refusée (403)', { data: { user: null }, error: new AuthApiError('invalid JWT', 403, 'bad_jwt') }],
    ['validée', { data: { user: { id: 'u1', app_metadata: { role: 'artisan' }, user_metadata: {} } }, error: null }],
  ])('connexion Google lancée avant la réponse de getUser (session %s) → ni fermeture ni redirection', async (_cas, reponseGetUser) => {
    sessionLocalePresente()
    const repondre = verificationEnAttente()
    simul.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.example/oauth' }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(simul.getUser).toHaveBeenCalled())
    await ouvrirLeFormulaire()
    await act(async () => { fireEvent.click(screen.getByText('Continuer avec Google')) })
    expect(simul.signInWithOAuth).toHaveBeenCalledTimes(1)
    await repondre(reponseGetUser)
    await laisserFinir()
    expect(simul.signOut).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
  })
})
