// tests/seo/liens-accueil-locale.test.tsx
//
// Accueil FR et PT (app/page.tsx, rendu uniquement par /fr/ et /pt/) :
// chaque lien interne doit viser l'URL finale de la locale de la page.
// Avant correctif, les CTA visaient d'anciens chemins racine (/recherche/,
// /pesquisar/, /pro/register/, /auth/login/, /contact/, /confidentialite/…)
// qui coûtent un 308 permanent ou un 302 du middleware (locale prise dans le
// cookie, puis le pays, puis Accept-Language) : un robot sans cookie qui
// suivait « Contacto » ou « Privacidade » depuis /pt/ arrivait en FR.
// Seul le logo garde href="/" (racine x-default).

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

const routeur = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

// next.config.ts déclare trailingSlash: true ; next/link lit cette variable
// (injectée au build) pour normaliser les href rendus comme en production.
vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routeur.push, replace: routeur.replace, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

class IntersectionObserverFactice {
  observe() { /* rendu de test : aucune intersection */ }
  unobserve() { /* idem */ }
  disconnect() { /* idem */ }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverFactice)

import HomePage from '@/app/page'
import { LanguageProvider } from '@/lib/i18n/context'

function rendreAccueil(locale: 'fr' | 'pt') {
  return render(
    <LanguageProvider initialLocale={locale}>
      <HomePage />
    </LanguageProvider>,
  )
}

function liensInternes(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('a[href]'))
    .map((a) => a.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/'))
}

describe('accueil : liens internes vers les URL finales de la locale', () => {
  beforeEach(() => {
    routeur.push.mockClear()
  })

  it.each(['fr', 'pt'] as const)('accueil %s : aucun lien vers un ancien chemin racine (hors logo)', (locale) => {
    const { container } = rendreAccueil(locale)
    const horsLocale = liensInternes(container).filter((href) => href !== '/' && !href.startsWith(`/${locale}/`))
    expect(horsLocale).toEqual([])
  })

  it('accueil fr : CTA, connexion et pied de page visent les pages FR finales', () => {
    const hrefs = liensInternes(rendreAccueil('fr').container)
    expect(hrefs).toEqual(expect.arrayContaining([
      '/fr/recherche/',
      '/fr/recherche/?category=plomberie',
      '/fr/pro/register/',
      '/fr/pro/tarifs/',
      '/fr/auth/login/',
      '/fr/contact/',
      '/fr/pro/faq/',
      '/fr/confidentialite/',
    ]))
  })

  it('accueil pt : CTA, connexion et pied de page visent les pages PT finales', () => {
    const hrefs = liensInternes(rendreAccueil('pt').container)
    expect(hrefs).toEqual(expect.arrayContaining([
      '/pt/pesquisar/',
      '/pt/pesquisar/?category=plomberie',
      '/pt/pro/register/',
      '/pt/pro/tarifs/',
      '/pt/auth/login/',
      '/pt/contact/',
      '/pt/pro/faq/',
      '/pt/privacidade/',
    ]))
    // « Privacidade » ne passe plus par /confidentialite/ (3 sauts jusqu'à /pt/privacidade/)
    expect(hrefs.some((href) => href.includes('confidentialite'))).toBe(false)
  })

  it.each([
    ['fr', '/fr/recherche/?'],
    ['pt', '/pt/pesquisar/?'],
  ] as const)('accueil %s : le bouton de recherche du formulaire navigue vers %s', (locale, attendu) => {
    const { container } = rendreAccueil(locale)
    const bouton = Array.from(container.querySelectorAll('button'))
      .find((b) => /Rechercher les artisans disponibles|Pesquisar profissionais disponíveis/.test(b.textContent ?? ''))
    expect(bouton).toBeDefined()
    fireEvent.click(bouton as HTMLButtonElement)
    expect(routeur.push).toHaveBeenCalledTimes(1)
    expect(String(routeur.push.mock.calls[0][0]).startsWith(attendu)).toBe(true)
  })
})
