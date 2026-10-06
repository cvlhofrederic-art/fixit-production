// tests/seo/liens-pages-publiques-chemins-racine.test.tsx
//
// Liens de pages publiques qui visaient d'anciens chemins racine au lieu de
// l'URL finale de leur locale (constat « liens-publics-chemins-racine ») :
// - /fr/cgu/ : <a href="/confidentialite"> (308 puis 302 du middleware) ;
// - BookingForm (profil public) : case RGPD vers /confidentialite, 3 sauts
//   côté PT jusqu'à /pt/privacidade/ ;
// - /pro/conformite/ : '/confidentialite/' (302 du middleware) ;
// - ArtisansCatalogueSection (/fr/services/*) : /recherche?cat=… (2 sauts) ;
// - /auth/login/ et /pro/register/ côté PT : LocaleLink préfixe les slugs FR
//   (/pt/mentions-legales/, /pt/confidentialite/, /pt/cgu/), redirigés.

import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

const etat = vi.hoisted(() => ({ locale: 'fr' as 'fr' | 'pt', pathname: '/fr/artisan/x/', xLocale: 'fr' }))

vi.mock('next/navigation', () => ({
  usePathname: () => etat.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-locale': etat.xLocale }),
  cookies: async () => ({ get: () => undefined }),
}))

vi.mock('@/lib/i18n/context', () => ({
  useLocale: () => etat.locale,
  useTranslation: () => ({ t: (cle: string) => cle, locale: etat.locale, setLocale: vi.fn() }),
}))

vi.mock('@/lib/i18n/server', () => ({
  getServerTranslation: async () => ({ t: (cle: string) => cle, locale: 'fr' }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

// Client Supabase serveur factice : chaque requête chaînée se résout en liste vide.
vi.mock('@/lib/supabase-server-component', () => {
  const requete = (): Record<string, unknown> => {
    const r: Record<string, unknown> = {}
    for (const m of ['select', 'eq', 'neq', 'order', 'limit']) r[m] = () => r
    r.then = (resoudre: (v: { data: unknown[]; count: number; error: null }) => unknown) =>
      resoudre({ data: [], count: 0, error: null })
    return r
  }
  return {
    createServerSupabaseClient: async () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'artisan-1' } } }) },
      from: () => requete(),
    }),
  }
})

class IntersectionObserverFactice {
  observe() { /* rendu de test : aucune intersection */ }
  unobserve() { /* idem */ }
  disconnect() { /* idem */ }
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverFactice)

import CGUPage from '@/app/fr/cgu/page'
import { BookingForm } from '@/components/artisan-profile/BookingForm'
import ConformitePage from '@/app/pro/conformite/page'
import ArtisansCatalogueSection from '@/components/ArtisansCatalogueSection'
import LoginPage from '@/app/auth/login/page'
import AProposPage from '@/app/fr/a-propos/page'

function hrefDuTexte(texte: string | RegExp): string | null {
  return screen.getByText(texte).closest('a')?.getAttribute('href') ?? null
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('IntersectionObserver', IntersectionObserverFactice)
})

describe('liens légaux et de recherche vers les URL finales', () => {
  it('/fr/cgu/ : le lien politique de confidentialité vise /fr/confidentialite/', async () => {
    render(await CGUPage())
    expect(hrefDuTexte('cgu.art10.privacyLink')).toBe('/fr/confidentialite/')
  })

  it.each([
    ['/pt/profissional/joao/', '/pt/privacidade/', '/pt/termos/'],
    ['/fr/artisan/jean/', '/fr/confidentialite/', '/fr/cgu/'],
  ])('BookingForm sur %s : confidentialité %s et CGU %s', (pathname, confidentialite, cgu) => {
    etat.pathname = pathname
    render(
      <BookingForm
        bookingForm={{ name: '', email: '', phone: '', address: '', notes: '', cgu: false }}
        setBookingForm={vi.fn()}
        addressSuggestions={[]}
        showAddrDropdown={false}
        setShowAddrDropdown={vi.fn()}
        bookingError={null}
        submitting={false}
        canSubmitBooking={false}
        connectedUser={null}
        onSubmit={vi.fn()}
        fetchAddressSuggestions={vi.fn()}
        setStep={vi.fn()}
      />,
    )
    expect(hrefDuTexte('politique de confidentialité')).toBe(confidentialite)
    expect(hrefDuTexte("conditions générales d'utilisation")).toBe(cgu)
  })

  it.each([
    ['fr', '/fr/confidentialite/', '/fr/mentions-legales/'],
    ['pt', '/pt/privacidade/', '/pt/avisos-legais/'],
  ])('/pro/conformite/ (x-locale %s) : confidentialité %s, mentions %s', async (xLocale, confidentialite, mentions) => {
    etat.xLocale = xLocale
    render(await ConformitePage())
    expect(hrefDuTexte(/Politique de confidentialité \(RGPD\)/)).toBe(confidentialite)
    expect(hrefDuTexte(/Mentions légales/)).toBe(mentions)
  })

  it('ArtisansCatalogueSection (/fr/services/*) : « Voir tous les artisans » vise /fr/recherche/', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        artisans: [{
          id: 'sirene-1', nom_entreprise: 'Plomberie du Port', metier: 'plombier', specialite: null,
          adresse: null, ville: 'Marseille', arrondissement: null, google_note: null, google_avis: null,
          telephone_pro: null, pappers_verifie: null,
        }],
      }),
    }) as Response))
    render(<ArtisansCatalogueSection city="Aix-en-Provence" service="plombier" waPhone="33600000000" />)
    const lien = (await screen.findByText(/Voir tous les artisans/)).closest('a')
    expect(lien?.getAttribute('href')).toBe('/fr/recherche/?cat=plombier&loc=Aix-en-Provence')
  })

  it.each([
    ['fr', 'Mentions légales', '/fr/mentions-legales/', 'Confidentialité', '/fr/confidentialite/'],
    ['pt', 'Avisos legais', '/pt/avisos-legais/', 'Privacidade', '/pt/privacidade/'],
  ] as const)('/auth/login/ (%s) : pied de page légal sans redirection', (locale, mentions, hrefMentions, confid, hrefConfid) => {
    etat.locale = locale
    render(<LoginPage />)
    expect(hrefDuTexte(mentions)).toBe(hrefMentions)
    expect(hrefDuTexte(confid)).toBe(hrefConfid)
    expect(hrefDuTexte('Contact')).toBe(`/${locale}/contact/`)
  })

  it('/fr/a-propos/ : le bouton contact vise déjà /fr/contact/ (LocaleLink préfixe la locale)', () => {
    etat.locale = 'fr'
    render(<AProposPage />)
    expect(hrefDuTexte('about.cta.contactUs')).toBe('/fr/contact/')
  })
})

// /pro/register/ : le lien CGU et confidentialité n'apparaît qu'à l'étape 3
// du formulaire pro (après vérification SIRET/NIF et dépôt du KBIS) ; un rendu
// jusqu'à cette étape demanderait de simuler tout le parcours. Garde statique :
// aucun slug légal FR littéral ne doit être confié à LocaleLink (il serait
// préfixé /pt/ côté PT, puis redirigé), et chaque lien légal choisit le slug
// de sa locale : branche PT /termos et /privacidade, branche FR /cgu et
// /confidentialite.
describe('garde statique : slugs légaux FR passés à LocaleLink', () => {
  it.each(['app/pro/register/page.tsx', 'app/auth/login/page.tsx'])('%s', (fichier) => {
    const source = readFileSync(path.resolve(__dirname, '../..', fichier), 'utf8')
    const littéraux = source.match(/<LocaleLink\s+href="\/(cgu|confidentialite|mentions-legales|cookies)\/?"/g) ?? []
    expect(littéraux).toEqual([])
  })

  it('app/pro/register/page.tsx : CGU et confidentialité visent /termos et /privacidade côté PT', () => {
    const source = readFileSync(path.resolve(__dirname, '../..', 'app/pro/register/page.tsx'), 'utf8')
    const slugsLegauxFr = ['/cgu', '/confidentialite', '/mentions-legales', '/cookies']
    const paires = Array.from(
      source.matchAll(/<LocaleLink\s+href=\{(?:isPt|locale === 'pt') \? '([^']+)' : '([^']+)'\}/g),
      (m) => [m[1], m[2]],
    ).filter(([, fr]) => slugsLegauxFr.includes(fr))
    expect(paires).toEqual([
      ['/termos', '/cgu'],
      ['/privacidade', '/confidentialite'],
    ])
  })
})
