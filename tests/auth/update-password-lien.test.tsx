/**
 * Page /auth/update-password/ (app/(commun)/auth/update-password/page.tsx) :
 * - lien de l'e-mail passé par /auth/confirm/ (?lien=1) : formulaire tout de suite, sans session ; l'envoi part vers
 *   POST /api/auth/update-password (jeton dans un cookie httpOnly), jamais vers supabase.auth.updateUser, puis
 *   redirection vers la connexion ;
 * - lien refusé par /auth/confirm (?erreur=) et aucune session : « lien expiré » tout de suite, sans 10 s d'attente ;
 * - ancien lien (?code=…, même navigateur) ou utilisateur connecté : session du SDK, supabase.auth.updateUser comme avant.
 */
import React from 'react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const simul = vi.hoisted(() => ({
  session: null as null | { access_token: string },
  getSession: vi.fn(),
  updateUser: vi.fn(),
  desabonner: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: simul.getSession,
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: simul.desabonner } } })),
      updateUser: simul.updateUser,
    },
  },
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string, repli?: string) => repli ?? cle, locale: 'fr', setLocale: () => {} }),
  useLocale: () => 'fr',
}))

vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import UpdatePasswordPage from '@/app/(commun)/auth/update-password/page'

const LIEN_EXPIRE = 'Ce lien a expiré ou est invalide'
const VERIFICATION = 'Vérification du lien...'
const BOUTON = 'Mettre à jour le mot de passe'
const SUCCES = 'Mot de passe mis à jour !'
const MOT_DE_PASSE = 'NouveauMotDePasse2026'

const reseau = vi.fn()
const descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')

// window.location remplacé par un objet simple : la page lit search et écrit href (redirection vers la connexion).
function ouvrir(chemin: string) {
  const url = new URL(chemin, 'https://vitfix.io')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: url.origin, pathname: url.pathname, search: url.search, hash: '', href: url.href },
  })
  return render(<UpdatePasswordPage />)
}

function saisirEtEnvoyer(container: HTMLElement, motDePasse = MOT_DE_PASSE) {
  const [champ, confirmation] = Array.from(container.querySelectorAll('input[type="password"]'))
  fireEvent.change(champ, { target: { value: motDePasse } })
  fireEvent.change(confirmation, { target: { value: motDePasse } })
  fireEvent.click(screen.getByRole('button', { name: BOUTON }))
}

beforeEach(() => {
  simul.session = null
  simul.getSession.mockReset()
  simul.getSession.mockImplementation(async () => ({ data: { session: simul.session }, error: null }))
  simul.updateUser.mockReset()
  simul.updateUser.mockResolvedValue({ data: { user: {} }, error: null })
  reseau.mockReset()
  reseau.mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal('fetch', reseau)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

afterAll(() => {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

describe('lien de l’e-mail passé par /auth/confirm/ (?lien=1)', () => {
  it('formulaire tout de suite, sans session ; envoi au serveur, jamais à supabase.auth.updateUser ; puis connexion', async () => {
    const minuteries = vi.spyOn(window, 'setTimeout')
    const { container } = ouvrir('/fr/auth/update-password/?lien=1')
    expect(await screen.findByRole('button', { name: BOUTON })).toBeInTheDocument()
    expect(simul.getSession).not.toHaveBeenCalled()

    saisirEtEnvoyer(container)

    expect(await screen.findByText(SUCCES)).toBeInTheDocument()
    expect(reseau).toHaveBeenCalledTimes(1)
    const [url, init] = reseau.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/update-password')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse(String(init.body))).toEqual({ password: MOT_DE_PASSE })
    expect(simul.updateUser).not.toHaveBeenCalled()

    // Aucune session n'est ouverte par le lien : retour à la connexion avec le nouveau mot de passe.
    const redirection = minuteries.mock.calls.find(([, delai]) => delai === 3000)
    expect(redirection).toBeDefined()
    act(() => { (redirection![0] as () => void)() })
    expect(window.location.href).toBe('/auth/login')
  })

  it('jeton refusé par le serveur : « lien expiré » et lien pour en demander un nouveau', async () => {
    reseau.mockResolvedValue(Response.json({ erreur: 'lien-invalide' }, { status: 400 }))
    const { container } = ouvrir('/fr/auth/update-password/?lien=1')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container)

    expect(await screen.findByText(LIEN_EXPIRE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/auth/reset-password')
    expect(screen.queryByRole('button', { name: BOUTON })).not.toBeInTheDocument()
  })

  it.each([
    [{ erreur: 'meme-mot-de-passe' }, 422, 'Ce mot de passe est déjà celui de votre compte : connectez-vous avec lui.'],
    [{ erreur: 'trop-de-tentatives' }, 429, 'Trop de tentatives. Réessayez dans quelques minutes.'],
    [{ erreur: 'reessayer' }, 503, 'Une erreur est survenue'],
    [{ error: 'CSRF: Origin non autorisé' }, 403, 'Une erreur est survenue'],
  ])('réponse %j (%i) : message dans le formulaire', async (corps, statut, message) => {
    reseau.mockResolvedValue(Response.json(corps, { status: statut }))
    const { container } = ouvrir('/fr/auth/update-password/?lien=1')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: BOUTON })).toBeInTheDocument()
  })

  it('mot de passe hors règle : refusé dans la page, rien n’est envoyé', async () => {
    const { container } = ouvrir('/fr/auth/update-password/?lien=1')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container, 'court')
    expect(await screen.findByText(/au moins 8 caractères/)).toBeInTheDocument()
    expect(reseau).not.toHaveBeenCalled()
  })
})

describe('lien refusé par /auth/confirm/ (?erreur=)', () => {
  it('aucune session : « lien expiré » sans attendre le délai de 10 s', async () => {
    ouvrir('/fr/auth/update-password/?erreur=lien-invalide')
    // findByText attend au plus 1 s : bien avant le délai de 10 s de la page.
    expect(await screen.findByText(LIEN_EXPIRE)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: BOUTON })).not.toBeInTheDocument()
  })

  it('session déjà ouverte (utilisateur connecté) : formulaire quand même', async () => {
    simul.session = { access_token: 'jeton' }
    ouvrir('/fr/auth/update-password/?erreur=lien-invalide')
    expect(await screen.findByRole('button', { name: BOUTON })).toBeInTheDocument()
    expect(screen.queryByText(LIEN_EXPIRE)).not.toBeInTheDocument()
  })
})

describe('ancien lien (?code=…) ou utilisateur connecté : session du SDK', () => {
  it('session trouvée : formulaire, envoi par supabase.auth.updateUser comme avant', async () => {
    simul.session = { access_token: 'jeton' }
    const { container } = ouvrir('/fr/auth/update-password/?code=code-pkce')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container)

    expect(await screen.findByText(SUCCES)).toBeInTheDocument()
    expect(simul.updateUser).toHaveBeenCalledWith({ password: MOT_DE_PASSE })
    expect(reseau).not.toHaveBeenCalled()
  })

  it('aucune session encore : reste en vérification (échange ?code=… encore possible)', async () => {
    // Réponse de getSession tenue en main : l'assertion porte sur l'état APRÈS la réponse « aucune session ».
    let repondre: (valeur: unknown) => void = () => {}
    simul.getSession.mockImplementation(() => new Promise((resolve) => { repondre = resolve }))
    ouvrir('/fr/auth/update-password/?code=code-pkce')
    await waitFor(() => expect(simul.getSession).toHaveBeenCalledTimes(1))
    await act(async () => {
      repondre({ data: { session: null }, error: null })
      await Promise.resolve()
    })
    expect(screen.getByText(VERIFICATION)).toBeInTheDocument()
    expect(screen.queryByText(LIEN_EXPIRE)).not.toBeInTheDocument()
  })
})

// PR 2 AJ Signalement, lot 6 (plan § 2.5, point 7.9) : un gestionnaire d'un cabinet client est renvoyé vers la connexion
// professionnelle de SON cabinet (destination rendue par le serveur, ou lue dans app_metadata du compte mis à jour par
// le SDK), jamais vers la connexion générale. Une destination qui n'a pas la forme attendue est ignorée (aucune
// redirection ouverte) : comportement actuel, /auth/login.
describe('gestionnaire AJ Signalement : retour vers la connexion de son cabinet', () => {
  const RETOUR = 'Retour à la connexion'

  const redirectionApres3s = (minuteries: { mock: { calls: unknown[][] } }) => {
    const redirection = minuteries.mock.calls.find(([, delai]) => delai === 3000)
    expect(redirection).toBeDefined()
    act(() => { (redirection![0] as () => void)() })
    return window.location.href
  }

  it('lien de l’e-mail : destination du serveur → bouton et redirection vers /<identifiant>/connexion/', async () => {
    reseau.mockResolvedValue(Response.json({ ok: true, connexion: '/cabinet-exemple/connexion/' }))
    const minuteries = vi.spyOn(window, 'setTimeout')
    const { container } = ouvrir('/fr/auth/update-password/?lien=1')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container)
    expect(await screen.findByText(SUCCES)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: RETOUR })).toHaveAttribute('href', '/cabinet-exemple/connexion/')
    expect(redirectionApres3s(minuteries)).toBe('/cabinet-exemple/connexion/')
  })

  it.each(['https://autre.example/connexion/', '//autre.example/connexion/', '/cabinet-exemple/suivi/', '/api/connexion/', 42])(
    'destination inattendue (%j) : ignorée, /auth/login comme aujourd’hui',
    async (connexion) => {
      reseau.mockResolvedValue(Response.json({ ok: true, connexion }))
      const minuteries = vi.spyOn(window, 'setTimeout')
      const { container } = ouvrir('/fr/auth/update-password/?lien=1')
      await screen.findByRole('button', { name: BOUTON })
      saisirEtEnvoyer(container)
      expect(await screen.findByText(SUCCES)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: RETOUR })).toHaveAttribute('href', '/auth/login')
      expect(redirectionApres3s(minuteries)).toBe('/auth/login')
    },
  )

  it('ancien lien (session du SDK) : app_metadata du compte mis à jour → connexion de son cabinet', async () => {
    simul.session = { access_token: 'jeton' }
    simul.updateUser.mockResolvedValue({
      data: { user: { app_metadata: { role: 'gestionnaire_signalement', aj_signalement_cabinet: 'cabinet-exemple' } } }, error: null,
    })
    const minuteries = vi.spyOn(window, 'setTimeout')
    const { container } = ouvrir('/fr/auth/update-password/?code=code-pkce')
    await screen.findByRole('button', { name: BOUTON })
    saisirEtEnvoyer(container)
    expect(await screen.findByText(SUCCES)).toBeInTheDocument()
    expect(redirectionApres3s(minuteries)).toBe('/cabinet-exemple/connexion/')
  })
})
