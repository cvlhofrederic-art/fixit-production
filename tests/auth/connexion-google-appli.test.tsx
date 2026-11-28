/**
 * Bouton « Continuer avec Google » de la page de connexion, dans l'appli Vitfix Pro et sur le web.
 *
 * Ce que ce fichier protège : dans l'appli, le bouton doit emprunter le circuit « fenêtre du navigateur du
 * système + retour par lien profond » et SURTOUT ne pas enchaîner sur le signInWithOAuth du web, qui
 * réécrirait le vérificateur PKCE et rendrait inéchangeable le code revenu par le lien profond — soit
 * exactement l'impasse du 12/11/2026 qu'il répare. Sur le web, rien ne doit changer.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const simul = vi.hoisted(() => ({
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
  ouvrirAppMobile: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: simul.getUser,
      signOut: simul.signOut,
      signInWithPassword: simul.signInWithPassword,
      signInWithOAuth: simul.signInWithOAuth,
    },
  },
}))

vi.mock('@/lib/auth/google-app-mobile', () => ({
  ouvrirConnexionGoogleAppMobile: simul.ouvrirAppMobile,
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: () => {} }),
  useLocale: () => 'fr',
}))

vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import LoginPage from '@/app/(commun)/auth/login/page'

type FenetreTest = Window & { Capacitor?: unknown }

let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined

function installerLocation() {
  navigations = []
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      origin: 'https://vitfix.io',
      pathname: '/fr/auth/login/',
      search: '',
      get href() { return 'https://vitfix.io/fr/auth/login/' },
      set href(destination: string) { navigations.push(destination) },
    },
  })
}

const dansLAppli = () => { (window as FenetreTest).Capacitor = { isNativePlatform: () => true } }

/** Ouvre le formulaire (la page démarre sur le choix de l'espace) et rend le bouton Google. */
async function boutonGoogle(): Promise<HTMLElement> {
  render(<LoginPage />)
  fireEvent.click(screen.getByText('auth.espaceArtisan'))
  return waitFor(() => screen.getByText('Continuer avec Google'))
}

beforeEach(() => {
  vi.clearAllMocks()
  // Aucune session : la page affiche le formulaire sans rien décider.
  simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
  simul.signOut.mockResolvedValue({ error: null })
  simul.signInWithOAuth.mockResolvedValue({ data: { url: null, provider: 'google' }, error: null })
  simul.ouvrirAppMobile.mockResolvedValue(undefined)
  installerLocation()
})

afterEach(() => {
  delete (window as FenetreTest).Capacitor
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

describe('« Continuer avec Google » dans l’appli Vitfix Pro', () => {
  it('emprunte le circuit de l’appli, et jamais celui du web', async () => {
    dansLAppli()
    fireEvent.click(await boutonGoogle())

    await waitFor(() => expect(simul.ouvrirAppMobile).toHaveBeenCalledTimes(1))
    expect(simul.ouvrirAppMobile).toHaveBeenCalledWith(expect.objectContaining({ signInWithOAuth: expect.any(Function) }))
    // Le point sensible : enchaîner sur le chemin du web réécrirait le vérificateur PKCE.
    expect(simul.signInWithOAuth).not.toHaveBeenCalled()
    expect(navigations).toEqual([])
  })

  it('deux appuis rapides n’ouvrent qu’une fenêtre', async () => {
    dansLAppli()
    let ouvrir: () => void = () => {}
    simul.ouvrirAppMobile.mockReturnValue(new Promise<void>((resoudre) => { ouvrir = () => resoudre() }))
    const bouton = await boutonGoogle()

    fireEvent.click(bouton)
    fireEvent.click(bouton)
    fireEvent.click(bouton)
    expect(simul.ouvrirAppMobile).toHaveBeenCalledTimes(1)

    // Fenêtre ouverte puis abandonnée : un nouvel essai doit repartir.
    ouvrir()
    await waitFor(() => expect(simul.ouvrirAppMobile).toHaveBeenCalledTimes(1))
    fireEvent.click(bouton)
    await waitFor(() => expect(simul.ouvrirAppMobile).toHaveBeenCalledTimes(2))
  })

  it('fenêtre impossible à ouvrir : message d’erreur, et on peut réessayer', async () => {
    dansLAppli()
    simul.ouvrirAppMobile.mockRejectedValueOnce(new Error('provider is not enabled'))
    const bouton = await boutonGoogle()

    fireEvent.click(bouton)
    await waitFor(() => expect(screen.getByText('auth.genericError')).toBeTruthy())

    fireEvent.click(bouton)
    await waitFor(() => expect(simul.ouvrirAppMobile).toHaveBeenCalledTimes(2))
  })
})

describe('« Continuer avec Google » sur le web', () => {
  it('garde le circuit du navigateur, sans toucher à celui de l’appli', async () => {
    fireEvent.click(await boutonGoogle())

    await waitFor(() => expect(simul.signInWithOAuth).toHaveBeenCalledTimes(1))
    expect(simul.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://vitfix.io/fr/client/dashboard' },
    })
    expect(simul.ouvrirAppMobile).not.toHaveBeenCalled()
  })
})
