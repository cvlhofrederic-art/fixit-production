// tests/seo/langue-du-chemin-rsc.test.tsx
//
// Langue d'un rendu serveur après une navigation côté client. Le middleware ne pose plus le cookie de langue sur les
// fetch() du routeur (poserCookieLangue, middleware.ts). Avant, Next fusionnait ce Set-Cookie dans cookies() pour le
// rendu de la même requête, et les pages qui lisaient leur langue dans le cookie suivaient le chemin. Sans lui, un clic
// sur « Termos » depuis /pt/avisos-legais/, alors qu'un autre onglet avait posé fr, affichait /pt/termos/ en français ;
// /fr/cgu/ sans cookie sortait en portugais (DEFAULT_LOCALE), et /fr/marches/publier/ avec le cookie pt, un titre et une
// canonique PT. La langue du rendu vient maintenant d'abord du chemin : en-tête x-locale, que le middleware pose sur
// toute requête de page, document comme fetch ; le cookie ne sert plus que de repli (getServerTranslation et les pages
// qui lisent elles-mêmes la langue).

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { NextRequest } from 'next/server'

const etat = vi.hoisted(() => ({ cookie: undefined as string | undefined, enTete: null as string | null }))

// cookies() et headers() du rendu : cookie de langue du navigateur, x-locale transmis par le middleware.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nom: string) => (nom === 'locale' && etat.cookie !== undefined ? { value: etat.cookie } : undefined) }),
  headers: async () => new Headers(etat.enTete === null ? {} : { 'x-locale': etat.enTete }),
}))

// Client Supabase du middleware simulé (visiteur non connecté).
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))

// Gestion d'un appel d'offres : seule la langue choisie par la page compte ici.
vi.mock('@/app/fr/marches/gerer/GererMarcheClient', () => ({
  default: ({ isPt }: { isPt: boolean }) => <p data-is-pt={String(isPt)}>gestion</p>,
}))

import { middleware } from '@/middleware'
import TermosPage from '@/app/pt/termos/page'
import CGUPage from '@/app/fr/cgu/page'
import ProTarifsPage from '@/app/(commun)/pro/tarifs/page'
import ProFAQPage from '@/app/(commun)/pro/faq/page'
import PageIntrouvableCommune from '@/app/(commun)/not-found'
import GererMarchePage from '@/app/fr/marches/gerer/page'
import { generateMetadata as metadonneesPublier } from '@/app/fr/marches/publier/page'

/** fetch() RSC d'une navigation côté client, tel que le middleware le reçoit, avec le cookie de langue donné. */
async function navigationCoteClient(chemin: string, cookie: string) {
  const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`, {
    headers: { cookie: `locale=${cookie}`, 'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin' },
  }))
  return {
    cookieLangue: reponse.cookies.get('locale')?.value ?? null,
    // En-tête de requête réécrit par NextResponse.next({ request: { headers } }) : ce que le rendu lira dans headers().
    xLocale: reponse.headers.get('x-middleware-request-x-locale'),
  }
}

async function titre(page: () => Promise<React.ReactElement>) {
  const { container, unmount } = render(await page())
  const h1 = container.querySelector('h1')?.textContent?.trim()
  unmount()
  return h1
}

beforeEach(() => {
  etat.cookie = undefined
  etat.enTete = null
})

describe('navigation côté client vers une page d’une autre langue que le cookie', () => {
  it('/pt/termos/ depuis un onglet resté en fr : aucun cookie posé, x-locale pt transmis au rendu', async () => {
    expect(await navigationCoteClient('/pt/termos/', 'fr')).toEqual({ cookieLangue: null, xLocale: 'pt' })
    expect(await navigationCoteClient('/pt/pro/tarifs/', 'fr')).toEqual({ cookieLangue: null, xLocale: 'pt' })
  })

  it('rendu avec ce x-locale et le cookie fr : pages en portugais', async () => {
    etat.cookie = 'fr'
    etat.enTete = (await navigationCoteClient('/pt/termos/', 'fr')).xLocale
    expect(await titre(TermosPage)).toBe('Termos e Condições de Utilização')
    expect(await titre(ProTarifsPage)).toBe('Ofertas para cada profissional')
  })

  it('/pt/pro/faq/ avec le cookie en : FAQ en portugais', async () => {
    etat.cookie = 'en'
    etat.enTete = 'pt'
    expect(await titre(ProFAQPage)).toBe('FAQ Profissionais')
  })

  it('/fr/cgu/ sans cookie (refusé) : en français, et non dans la langue par défaut pt', async () => {
    etat.enTete = 'fr'
    expect(await titre(CGUPage)).toBe("Conditions Générales d'Utilisation")
  })

  it('/fr/marches/publier/ avec le cookie pt : titre et canonique FR', async () => {
    etat.cookie = 'pt'
    etat.enTete = 'fr'
    const metadonnees = await metadonneesPublier()
    // Sans la marque, que le gabarit « %s | VITFIX » ajoute (#630).
    expect(metadonnees.title).toBe('Publier un appel d\'offres')
    expect(metadonnees.alternates?.canonical).toBe('https://vitfix.io/fr/marches/publier/')
  })

  it('404 d’une page commune sous /pt/ avec le cookie fr : texte portugais', async () => {
    etat.cookie = 'fr'
    etat.enTete = 'pt'
    expect(await titre(PageIntrouvableCommune)).toBe('Página não encontrada')
  })

  it('/fr/marches/gerer/ avec le cookie pt : interface française', async () => {
    etat.cookie = 'pt'
    etat.enTete = 'fr'
    const { container, unmount } = render(await GererMarchePage())
    expect(container.querySelector('[data-is-pt]')?.getAttribute('data-is-pt')).toBe('false')
    unmount()
  })
})

describe('repli sur le cookie sans x-locale valide (page hors du matcher du middleware)', () => {
  it('cookie seul : il reste lu', async () => {
    etat.cookie = 'fr'
    expect(await titre(TermosPage)).toBe("Conditions Générales d'Utilisation")
    expect(await titre(ProTarifsPage)).toBe('Des offres pour chaque artisan')
  })

  it('x-locale hors liste : ignoré au profit du cookie', async () => {
    etat.cookie = 'pt'
    etat.enTete = 'de'
    expect(await titre(CGUPage)).toBe('Termos e Condições de Utilização')
  })
})
