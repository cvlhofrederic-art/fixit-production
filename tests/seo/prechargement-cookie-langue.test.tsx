// tests/seo/prechargement-cookie-langue.test.tsx
//
// Préchargement des liens vers une autre langue. Les pages EN, NL et ES lient des pages /pt/ (lib/i18n/liens-entete-pied.ts).
// En production, Next précharge un <Link> dès qu'il entre à l'écran, et le middleware répondait à ces fetch() par
// « Set-Cookie: locale=pt » (un an) : sur une page NL, voir le pied de page suffisait pour que https://vitfix.io/ (et la
// PWA, start_url « / ») renvoie ensuite vers /pt/ au lieu de /nl/.
// - middleware.ts : cookie de langue posé sur une navigation de document seulement. Next retire ses propres en-têtes
//   (RSC, Next-Router-Prefetch…) avant d'appeler le middleware : les requêtes ci-dessous portent ce qu'il reçoit
//   vraiment, les en-têtes Fetch Metadata du navigateur (Sec-Fetch-Dest « empty » pour un fetch, « document » sinon).
// - LocaleLink : pas de préchargement vers une autre langue (autre layout racine : la charge serait jetée).

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NextRequest } from 'next/server'
import { FLIGHT_HEADERS } from 'next/dist/client/components/app-router-headers'

type Utilisateur = { app_metadata: { role?: string } }
const etat = vi.hoisted(() => ({ utilisateur: null as Utilisateur | null }))

// Client Supabase simulé : seule la décision du middleware est testée.
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: etat.utilisateur } }) } }),
}))

// next/link réduit à un <a> qui expose la valeur de prefetch reçue de LocaleLink.
vi.mock('next/link', () => ({
  default: ({ href, prefetch, children }: { href: string; prefetch?: boolean | null; children: React.ReactNode }) => (
    <a href={href} data-prefetch={String(prefetch)}>{children}</a>
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

function prefetchRendu(langue: Locale, href: string, prefetch?: boolean) {
  const { container, unmount } = render(
    <LanguageProvider initialLocale={langue}>
      <LocaleLink href={href} prefetch={prefetch}>lien</LocaleLink>
    </LanguageProvider>,
  )
  const valeur = container.querySelector('a')?.getAttribute('data-prefetch')
  unmount()
  return valeur
}

describe('LocaleLink : pas de préchargement vers une autre langue', () => {
  it.each([
    ['nl', '/pt/auth/login'],
    ['en', '/pt/precos'],
    ['es', '/pt/termos'],
    ['fr', '/pt/'],
    ['pt', '/fr/recherche'],
  ] as const)('page %s, lien %s : prefetch={false}', (langue, href) => {
    expect(prefetchRendu(langue, href)).toBe('false')
  })

  it.each([
    ['fr', '/recherche'],
    ['pt', '/pesquisar'],
    ['en', '/en/'],
    ['nl', '/nl/#how'],
    ['en', '/legal-notices'],
  ] as const)('page %s, lien %s (même langue) : préchargement par défaut', (langue, href) => {
    expect(prefetchRendu(langue, href)).toBe('undefined')
  })

  it('garde un prefetch explicite vers la même langue', () => {
    expect(prefetchRendu('fr', '/recherche', false)).toBe('false')
    expect(prefetchRendu('fr', '/recherche', true)).toBe('true')
  })
})
