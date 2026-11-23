/**
 * Connexion d'un compte de société BTP DANS l'appli Vitfix Pro (23/11/2026).
 *
 * L'appli démarre sur /pro/mobile/, d'où le middleware aiguille un compte déjà connecté. Mais un salarié qui
 * s'identifie au formulaire, lui, ne repasse pas par là : c'est la page de connexion qui choisit sa destination.
 * Les deux chemins doivent ouvrir le même écran — le pointage pour un salarié de terrain — sans quoi l'employé
 * atterrirait sur le tableau de bord complet, dont le menu se réduit à un rail d'icônes sur un téléphone.
 *
 * Ce fichier couvre le câblage de la page (le rôle d'équipe transmis à la table des destinations) : la décision
 * elle-même, rôle par rôle, est vérifiée dans tests/auth/destination-par-role.test.ts.
 * `estAppMobile()` est forcé à vrai : sans Capacitor, il répond faux dans un test.
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const simul = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
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

vi.mock('@/lib/app-mobile', () => ({ estAppMobile: () => true }))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: 'fr', setLocale: () => {} }),
  useLocale: () => 'fr',
}))

vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import LoginPage from '@/app/(commun)/auth/login/page'

let navigations: string[] = []
let descripteurLocation: PropertyDescriptor | undefined

/** Compte d'une société BTP : le gérant n'a pas de rôle d'équipe, un salarié invité en porte un. */
const compteBtp = (roleEquipe?: string) => ({
  id: 'u1',
  app_metadata: { role: 'pro_societe', ...(roleEquipe ? { pro_team_role: roleEquipe } : {}) },
  user_metadata: {},
})

beforeEach(() => {
  vi.clearAllMocks()
  simul.getSession.mockResolvedValue({ data: { session: null }, error: null })
  simul.getUser.mockResolvedValue({ data: { user: null }, error: null })
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
      assign: (destination: string) => { navigations.push(destination) },
      replace: (destination: string) => { navigations.push(destination) },
    },
  })
})

afterEach(() => {
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

/** Remplit le formulaire et le soumet. L'espace choisi ne décide de rien : la destination vient du rôle reçu. */
async function seConnecter() {
  fireEvent.click(screen.getByText('auth.espaceArtisan'))
  const formulaire = await waitFor(() => {
    const f = document.querySelector('form')
    if (!f) throw new Error('formulaire absent')
    return f
  })
  fireEvent.change(document.querySelector('input[type="email"]')!, { target: { value: 'joao@example.com' } })
  fireEvent.change(document.querySelector('input[type="password"]')!, { target: { value: 'secret-de-test' } })
  fireEvent.submit(formulaire)
}

describe('société BTP, connexion dans l’appli Vitfix Pro', () => {
  it('un salarié de terrain qui s’identifie au formulaire part sur le pointage', async () => {
    simul.signInWithPassword.mockResolvedValue({ data: { user: compteBtp('OUVRIER') }, error: null })
    render(<LoginPage />)
    await seConnecter()
    await waitFor(() => expect(navigations).toEqual(['/fr/pro/dashboard/?p=pointage']))
  })

  it('le gérant garde son tableau de bord', async () => {
    simul.signInWithPassword.mockResolvedValue({ data: { user: compteBtp() }, error: null })
    render(<LoginPage />)
    await seConnecter()
    await waitFor(() => expect(navigations).toEqual(['/fr/pro/dashboard']))
  })

  it('une session déjà ouverte suit la même règle', async () => {
    simul.getUser.mockResolvedValue({ data: { user: compteBtp('CHEF_CHANTIER') }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/fr/pro/dashboard/?p=pointage']))
  })

  it('une session déjà ouverte du gérant garde le tableau de bord', async () => {
    simul.getUser.mockResolvedValue({ data: { user: compteBtp('GERANT') }, error: null })
    render(<LoginPage />)
    await waitFor(() => expect(navigations).toEqual(['/fr/pro/dashboard']))
  })
})
