// tests/seo/prechargement-cookie-langue.test.tsx
//
// Préchargement des liens vers une autre langue. Les pages EN, NL et ES lient des pages /pt/ (lib/i18n/liens-entete-pied.ts).
// En production, Next précharge un <Link> dès qu'il entre à l'écran, et le middleware répondait à ces fetch() par
// « Set-Cookie: locale=pt » (un an) : sur une page NL, voir le pied de page suffisait pour que https://vitfix.io/ (et la
// PWA, start_url « / ») renvoie ensuite vers /pt/ au lieu de /nl/.
// - middleware.ts : cookie de langue posé sur une navigation de document seulement. Next retire ses propres en-têtes
//   (RSC, Next-Router-Prefetch…) avant d'appeler le middleware : les requêtes ci-dessous portent ce qu'il reçoit
//   vraiment, les en-têtes Fetch Metadata du navigateur (Sec-Fetch-Dest « empty » pour un fetch, « document » sinon).
// - LocaleLink : un lien vers une autre langue est un simple <a> (nouveau document, ni préchargement ni navigation
//   douce qui garderait la langue de la page quittée) ; vers la même langue, next/link.

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { FLIGHT_HEADERS } from 'next/dist/client/components/app-router-headers'

type Utilisateur = { app_metadata: { role?: string } }
const etat = vi.hoisted(() => ({ utilisateur: null as Utilisateur | null }))

// Client Supabase simulé : seule la décision du middleware est testée.
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: etat.utilisateur } }) } }),
}))

// next/link réduit à un <a> marqué, qui expose la valeur de prefetch reçue de LocaleLink.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children }: { href: string; prefetch?: boolean | null; children: React.ReactNode }) => (
    <a href={href} data-next-link="" data-prefetch={String(prefetch)}>{children}</a>
  ),
}))

import { middleware } from '@/middleware'
import LocaleLink from '@/components/common/LocaleLink'
import { LanguageProvider } from '@/lib/i18n/context'
import { LIENS_ENTETE_PIED } from '@/lib/i18n/liens-entete-pied'
import type { Locale } from '@/lib/i18n/config'

// fetch() du routeur (préchargement ou navigation côté client) et navigation de document, vus par le middleware.
const FETCH = { 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' }
const DOCUMENT = { 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin' }

/**
 * Réponse du middleware pour un visiteur dont le cookie de langue vaut nl (sauf en-tête cookie fourni). Destination
 * comparée sans barre finale : hors du serveur, NextURL ne connaît pas trailingSlash (même choix que
 * tests/securite/acces-middleware-dashboards.test.ts).
 */
async function reponse(chemin: string, entetes: Record<string, string> = {}) {
  const r = await middleware(new NextRequest(`https://vitfix.io${chemin}`, { headers: { cookie: 'locale=nl', ...entetes } }))
  const location = r.headers.get('location')
  return {
    statut: r.status,
    vers: location ? new URL(location, 'https://vitfix.io').pathname.replace(/(.)\/$/, '$1') : null,
    cookieLangue: r.cookies.get('locale')?.value ?? null,
  }
}

// Cibles /pt/ des liens d'en-tête et de pied d'une page NL (les mêmes en EN et ES), tableaux de bord compris.
const CIBLES_PT = [...new Set(Object.values(LIENS_ENTETE_PIED).map((chemins) => chemins.nl))]
  .filter((chemin) => chemin.startsWith('/pt/'))
  .map((chemin) => `${chemin}/`)

beforeEach(() => {
  etat.utilisateur = null
})

describe('middleware : un fetch() du routeur ne pose jamais le cookie de langue', () => {
  it('Next retire ses en-têtes de préchargement avant le middleware : Sec-Fetch-Dest est le seul marqueur lisible', () => {
    // next/dist/server/web/adapter.js supprime ces en-têtes de la requête passée au middleware.
    expect(FLIGHT_HEADERS).toEqual(expect.arrayContaining(['rsc', 'next-router-prefetch', 'next-router-segment-prefetch']))
  })

  it('couvre les cibles /pt/ de la table', () => {
    expect(CIBLES_PT).toEqual(expect.arrayContaining(['/pt/auth/login/', '/pt/precos/', '/pt/termos/', '/pt/artisan/dashboard/']))
  })

  it.each(CIBLES_PT)('%s préchargée depuis une page NL', async (chemin) => {
    expect(await reponse(chemin, FETCH)).toMatchObject({ cookieLangue: null })
  })

  it('compte connecté : redirection de l’accueil /pt/ vers son espace, sans cookie de langue', async () => {
    etat.utilisateur = { app_metadata: { role: 'artisan' } }
    expect(await reponse('/pt/', FETCH)).toEqual({ statut: 307, vers: '/pt/artisan/dashboard', cookieLangue: null })
  })

  it('compte connecté sur un autre espace : redirection sans cookie de langue', async () => {
    etat.utilisateur = { app_metadata: { role: 'artisan' } }
    expect(await reponse('/pt/client/dashboard/', FETCH)).toEqual({ statut: 307, vers: '/pt/artisan/dashboard', cookieLangue: null })
  })

  it('super admin : servi sans cookie de langue', async () => {
    etat.utilisateur = { app_metadata: { role: 'super_admin' } }
    expect(await reponse('/pt/', FETCH)).toMatchObject({ statut: 200, cookieLangue: null })
  })

  it('chemin sans langue : redirection sans cookie de langue', async () => {
    expect(await reponse('/', FETCH)).toMatchObject({ statut: 302, vers: '/nl', cookieLangue: null })
  })
})

describe('middleware : navigation de document inchangée', () => {
  it('visite de /pt/precos/ avec le cookie nl : locale=pt, avec ou sans Sec-Fetch-Dest (robots, anciens navigateurs)', async () => {
    expect(await reponse('/pt/precos/', DOCUMENT)).toMatchObject({ statut: 200, cookieLangue: 'pt' })
    expect(await reponse('/pt/precos/')).toMatchObject({ statut: 200, cookieLangue: 'pt' })
  })

  it('page publique, cookie déjà juste : rien à poser', async () => {
    expect(await reponse('/pt/precos/', { ...DOCUMENT, cookie: 'locale=pt' })).toMatchObject({ statut: 200, cookieLangue: null })
  })

  it('connexion, accueil non connecté, tableau de bord sans session : locale=pt', async () => {
    expect(await reponse('/pt/auth/login/', DOCUMENT)).toMatchObject({ statut: 200, cookieLangue: 'pt' })
    expect(await reponse('/pt/', DOCUMENT)).toMatchObject({ statut: 200, cookieLangue: 'pt' })
    expect(await reponse('/pt/artisan/dashboard/', DOCUMENT)).toEqual({ statut: 307, vers: '/pt/auth/login', cookieLangue: 'pt' })
  })

  it('compte connecté redirigé vers son espace : locale=pt', async () => {
    etat.utilisateur = { app_metadata: { role: 'artisan' } }
    expect(await reponse('/pt/', DOCUMENT)).toEqual({ statut: 307, vers: '/pt/artisan/dashboard', cookieLangue: 'pt' })
  })

  it('super admin : locale=pt', async () => {
    etat.utilisateur = { app_metadata: { role: 'super_admin' } }
    expect(await reponse('/pt/', DOCUMENT)).toMatchObject({ statut: 200, cookieLangue: 'pt' })
  })

  it('chemin sans langue : redirection vers la langue du cookie, cookie reposé', async () => {
    expect(await reponse('/', DOCUMENT)).toMatchObject({ statut: 302, vers: '/nl', cookieLangue: 'nl' })
  })
})

function lienRendu(langue: Locale, href: string, props: Partial<React.ComponentProps<typeof LocaleLink>> = {}) {
  // Une prop de next/link transmise au <a> (prefetch, replace, scroll…) déclenche un avertissement de React.
  const erreursConsole = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const { container, unmount } = render(
      <LanguageProvider initialLocale={langue}>
        <LocaleLink href={href} {...props}>lien</LocaleLink>
      </LanguageProvider>,
    )
    const a = container.querySelector('a')
    // Clic sans navigation (jsdom ne navigue pas) : seul l'appel du gestionnaire transmis compte.
    a?.addEventListener('click', (evenement) => evenement.preventDefault())
    if (a) fireEvent.click(a)
    const rendu = {
      href: a?.getAttribute('href'),
      nextLink: a?.hasAttribute('data-next-link') ?? false,
      prefetch: a?.getAttribute('data-prefetch') ?? null,
      classe: a?.getAttribute('class') ?? null,
    }
    unmount()
    expect(erreursConsole.mock.calls.map((appel) => String(appel[0]))).toEqual([])
    return rendu
  } finally {
    erreursConsole.mockRestore()
  }
}

describe('LocaleLink : simple <a> vers une autre langue', () => {
  it.each([
    ['nl', '/pt/auth/login', '/pt/auth/login/'],
    ['en', '/pt/precos', '/pt/precos/'],
    ['es', '/pt/termos', '/pt/termos/'],
    ['fr', '/pt/', '/pt/'],
    ['pt', '/fr/recherche', '/fr/recherche/'],
    ['nl', '/fr/recherche?cat=plombier#liste', '/fr/recherche/?cat=plombier#liste'],
    ['en', '/pt/#how', '/pt/#how'],
    // Chemin de fichier : pas de barre finale, comme next/link.
    ['en', '/pt/sitemap.xml', '/pt/sitemap.xml'],
  ] as const)('page %s, lien %s : <a href="%s">, sans next/link', (langue, href, attendu) => {
    expect(lienRendu(langue, href)).toEqual({ href: attendu, nextLink: false, prefetch: null, classe: null })
  })

  it('transmet classe, gestionnaire de clic et attributs d’ancre, sans les props de next/link', () => {
    const auClic = vi.fn()
    const rendu = lienRendu('en', '/pt/pro/faq', { className: 'lien-pied', onClick: auClic, prefetch: true, replace: true, scroll: false })
    expect(rendu).toEqual({ href: '/pt/pro/faq/', nextLink: false, prefetch: null, classe: 'lien-pied' })
    expect(auClic).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['fr', '/recherche', '/fr/recherche'],
    ['pt', '/pesquisar', '/pt/pesquisar'],
    ['en', '/en/', '/en/'],
    ['nl', '/nl/#how', '/nl/#how'],
    ['en', '/legal-notices', '/en/legal-notices'],
  ] as const)('page %s, lien %s (même langue) : next/link, préchargement par défaut', (langue, href, attendu) => {
    expect(lienRendu(langue, href)).toEqual({ href: attendu, nextLink: true, prefetch: 'undefined', classe: null })
  })

  it('garde un prefetch explicite vers la même langue', () => {
    expect(lienRendu('fr', '/recherche', { prefetch: false })).toMatchObject({ nextLink: true, prefetch: 'false' })
    expect(lienRendu('fr', '/recherche', { prefetch: true })).toMatchObject({ nextLink: true, prefetch: 'true' })
  })
})
