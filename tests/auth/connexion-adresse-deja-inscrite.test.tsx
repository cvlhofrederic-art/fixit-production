/**
 * Page de connexion ouverte par l'inscription d'une société BTP dont l'adresse e-mail a déjà un compte
 * (constat inscription-profil-14 de l'audit du 11/11/2026). Le formulaire d'inscription renvoie alors vers
 * /{langue}/auth/login?email_exists=1, paramètre qu'aucune page ne lisait : la société arrivait sur la connexion sans
 * un mot d'explication, après trois étapes et l'envoi de ses pièces. La page le dit désormais (en français ; la page
 * portugaise reste inchangée, Portugal hors de ce lot).
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const simul = vi.hoisted(() => ({ locale: 'fr' }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}))

vi.mock('@/lib/i18n/context', () => ({
  useTranslation: () => ({ t: (cle: string) => cle, locale: simul.locale, setLocale: () => {} }),
  useLocale: () => simul.locale,
}))

vi.mock('@/components/common/LocaleLink', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import LoginPage from '@/app/(commun)/auth/login/page'

const MESSAGE = /Un compte existe déjà avec cette adresse e-mail/

let descripteurLocation: PropertyDescriptor | undefined

function ouvrirAvec(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'https://vitfix.io', pathname: '/fr/auth/login/', search, href: `https://vitfix.io/fr/auth/login/${search}` },
  })
  render(<LoginPage />)
}

beforeEach(() => {
  simul.locale = 'fr'
  descripteurLocation = Object.getOwnPropertyDescriptor(window, 'location')
})

afterEach(() => {
  cleanup()
  if (descripteurLocation) Object.defineProperty(window, 'location', descripteurLocation)
})

describe('Connexion après une inscription avec une adresse déjà inscrite', () => {
  it('?email_exists=1 : la page explique pourquoi la société arrive ici', async () => {
    ouvrirAvec('?email_exists=1')

    expect(await screen.findByText(MESSAGE)).toBeTruthy()
  })

  it('sans le paramètre : aucun message (page inchangée)', () => {
    ouvrirAvec('')

    expect(screen.queryByText(MESSAGE)).toBeNull()
  })

  it('page portugaise : inchangée (Portugal hors de ce lot)', () => {
    simul.locale = 'pt'
    ouvrirAvec('?email_exists=1')

    expect(screen.queryByText(MESSAGE)).toBeNull()
  })
})
