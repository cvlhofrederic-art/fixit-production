/**
 * Page de connexion ouverte par un navigateur qui garde déjà une session Supabase (lot 1 Sentry du 28/10/2026).
 *
 * Avant : checkAuth lisait getSession() — la session des cookies, jamais validée auprès de Supabase — et
 * redirigeait d'office vers l'espace du rôle. Une session refusée par le serveur renvoyait donc vers un tableau de
 * bord qui la refusait à son tour et renvoyait ici : boucle. Après : la décision repose sur getUser() (session
 * validée), classée par lib/auth/session-navigateur.ts :
 * - valide → redirection vers l'espace du rôle (destinations inchangées) ;
 * - refusée pour authentification (401/403/404) → fermeture de la session locale, formulaire affiché ;
 * - absente ou indisponible (réseau, AbortError du verrou) → ni redirection ni déconnexion ;
 * - une connexion lancée par l'utilisateur prime sur une vérification encore en cours.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AuthApiError, AuthSessionMissingError } from '@supabase/supabase-js'

vi.mock('@/lib/supabase', async () => (await import('../helpers/page-connexion')).supabaseFactice())

vi.mock('@/lib/i18n/context', async () => (await import('../helpers/page-connexion')).i18nFrancais())
vi.mock('@/components/common/LocaleLink', async () => (await import('../helpers/page-connexion')).localeLinkSimple())

import LoginPage from '@/app/(commun)/auth/login/page'

import { authSimulee as simul, installerLocationFactice } from '../helpers/page-connexion'

let navigations: string[] = []
let restaurerLocation: () => void = () => {}

const utilisateur = (role: string) => ({ id: 'u1', app_metadata: { role }, user_metadata: {} })
const abortError = () => new DOMException('signal is aborted without reason', 'AbortError')
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  vi.clearAllMocks()
  simul.getSession.mockResolvedValue({ data: { session: null }, error: null })
  simul.signOut.mockResolvedValue({ error: null })
  ;({ navigations, restaurer: restaurerLocation } = installerLocationFactice())
})

afterEach(() => {
  restaurerLocation()
})

describe('page de connexion — session déjà présente', () => {
  it('session validée par Supabase : redirection vers l’espace du rôle', async () => {
    simul.getUser.mockResolvedValue({ data: { user: utilisateur('artisan') }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/fr/artisan/dashboard']))
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('session refusée (401) : fermeture de la session locale, formulaire affiché, aucune navigation', async () => {
    simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthApiError('invalid JWT', 401, 'bad_jwt') })
    render(<LoginPage />)
    await waitFor(() => expect(simul.signOut).toHaveBeenCalledWith({ scope: 'local' }))
    expect(navigations).toEqual([])
    expect(screen.getByText('auth.espaceParticulier')).toBeTruthy()
  })

  it('aucune session (AuthSessionMissingError) : ni redirection ni déconnexion', async () => {
    simul.getUser.mockResolvedValue({ data: { user: null }, error: new AuthSessionMissingError() })
    render(<LoginPage />)
    await act(async () => { await attendre(20) })
    expect(navigations).toEqual([])
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('session indisponible (AbortError du verrou, deux fois) : ni redirection ni déconnexion', async () => {
    simul.getUser.mockRejectedValue(abortError())
    render(<LoginPage />)
    await waitFor(() => expect(simul.getUser).toHaveBeenCalledTimes(2), { timeout: 3000 })
    await act(async () => { await attendre(20) })
    expect(navigations).toEqual([])
    expect(simul.signOut).not.toHaveBeenCalled()
  })

  it('connexion lancée pendant une vérification lente : la vérification ne redirige plus', async () => {
    let resoudreGetUser: (valeur: unknown) => void = () => {}
    simul.getUser.mockReturnValue(new Promise((resoudre) => { resoudreGetUser = resoudre }))
    simul.signInWithPassword.mockResolvedValue({ data: { user: utilisateur('client') }, error: null })
    render(<LoginPage />)

    fireEvent.click(screen.getByText('auth.espaceParticulier'))
    const formulaire = await waitFor(() => {
      const f = document.querySelector('form')
      if (!f) throw new Error('formulaire absent')
      return f
    })
    fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: 'camille@example.com' } })
    fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: 'secret-de-test' } })
    fireEvent.submit(formulaire)
    await waitFor(() => expect(navigations).toEqual(['/fr/client/dashboard']))

    await act(async () => {
      resoudreGetUser({ data: { user: utilisateur('artisan') }, error: null })
      await attendre(20)
    })
    expect(navigations).toEqual(['/fr/client/dashboard'])
  })
})
