/**
 * Métadonnées SEO : pages privées en noindex, canonicals sur l'URL servie (jamais une URL qui redirige),
 * hreflang réciproques et sitemaps sans page privée.
 *
 * Les métadonnées sont lues telles qu'exportées par les fichiers (metadata / generateMetadata).
 * Les composants client et Supabase sont simulés : seules les métadonnées sont vérifiées.
 * Fusion Next : un segment enfant qui déclare une clé (robots, alternates…) remplace toute la clé du parent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'

const cookieLocale = vi.hoisted(() => ({ valeur: undefined as string | undefined }))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (nom: string) => (nom === 'locale' && cookieLocale.valeur ? { name: 'locale', value: cookieLocale.valeur } : undefined),
  }),
}))
vi.mock('@/app/fr/recherche/page', () => ({ default: () => null }))
vi.mock('@/app/fr/marches/gerer/GererMarcheClient', () => ({ default: () => null }))
vi.mock('@/app/fr/marches/publier/PublierMarcheClient', () => ({ default: () => null }))
vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn() }))

const NOINDEX = { index: false, follow: false }

async function metadataDe(chemin: Promise<{ metadata?: Metadata }>): Promise<Metadata> {
  const { metadata } = await chemin
  if (!metadata) throw new Error('metadata absente')
  return metadata
}

beforeEach(() => {
  cookieLocale.valeur = undefined
})

describe('pages légales FR servies par réécriture : canonical sur /fr/…', () => {
  // /confidentialite/ et /cookies/ répondent 302 géolocalisé (vers /pt/privacidade/, /pt/politica-cookies/ au Portugal).
  // Fusion Next clé par clé ({ ...layout, ...page }) : un alternates déclaré par la page annulerait la canonical du layout.
  it('/fr/confidentialite/', async () => {
    const layout = await metadataDe(import('@/app/confidentialite/layout'))
    const page = await metadataDe(import('@/app/confidentialite/page'))
    expect(layout.alternates?.canonical).toBe('https://vitfix.io/fr/confidentialite/')
    const fusion: Metadata = { ...layout, ...page }
    expect(fusion.alternates?.canonical).toBe('https://vitfix.io/fr/confidentialite/')
    // Le robots index du layout reste remplacé par celui de la page.
    expect(fusion.robots).toEqual({ index: false, follow: true })
  })

  it('/fr/cookies/', async () => {
    const layout = await metadataDe(import('@/app/cookies/layout'))
    const page = await metadataDe(import('@/app/cookies/page'))
    expect(layout.alternates?.canonical).toBe('https://vitfix.io/fr/cookies/')
    const fusion: Metadata = { ...layout, ...page }
    expect(fusion.alternates?.canonical).toBe('https://vitfix.io/fr/cookies/')
    expect(fusion.robots).toEqual({ index: false, follow: true })
  })
})

describe('/pro/tarifs/ : canonical par locale', () => {
  it('FR : https://vitfix.io/fr/pro/tarifs/ (et non /pro/tarifs/, en 302 géolocalisé)', async () => {
    const { generateMetadata } = await import('@/app/pro/tarifs/page')
    cookieLocale.valeur = 'fr'
    expect((await generateMetadata()).alternates?.canonical).toBe('https://vitfix.io/fr/pro/tarifs/')
    cookieLocale.valeur = undefined
    expect((await generateMetadata()).alternates?.canonical).toBe('https://vitfix.io/fr/pro/tarifs/')
  })

  it('PT : inchangé', async () => {
    const { generateMetadata } = await import('@/app/pro/tarifs/page')
    cookieLocale.valeur = 'pt'
    expect((await generateMetadata()).alternates?.canonical).toBe('https://vitfix.io/pt/pro/tarifs/')
  })
})

describe('pages privées : noindex, nofollow', () => {
  // Pages 'use client' sans métadonnées : sans layout, elles héritent de robots index, follow du layout racine.
  it.each([
    ['/pt/privacidade/meus-dados/ (espace RGPD du compte)', () => import('@/app/pt/privacidade/meus-dados/layout')],
    ['/en/privacy/my-data/ (espace RGPD du compte)', () => import('@/app/en/privacy/my-data/layout')],
    ['/fr|pt/tracking/<jeton>/ (position de l’artisan, adresse de la mission)', () => import('@/app/tracking/[token]/layout')],
    ['/fr|pt/confirmation/ (confirmation de réservation)', () => import('@/app/confirmation/layout')],
  ])('%s', async (_page, charger) => {
    const segment = await charger()
    const metadata = await metadataDe(Promise.resolve(segment))
    expect(metadata.robots).toEqual(NOINDEX)
    // Métadonnées seulement : le titre d'onglet hérité ne change pas.
    expect(metadata.title).toBeUndefined()
    // Aucun effet sur l'affichage : le layout rend la page telle quelle.
    const contenu = 'contenu-de-la-page'
    expect(segment.default({ children: contenu })).toBe(contenu)
  })

  it('/pt/mercados/gerir/ (gestion par jeton), comme son jumeau /fr/marches/gerer/', async () => {
    const pt = await metadataDe(import('@/app/pt/mercados/gerir/page'))
    const fr = await metadataDe(import('@/app/fr/marches/gerer/page'))
    expect(fr.robots).toEqual(NOINDEX)
    expect(pt.robots).toEqual(NOINDEX)
  })
})

describe('sitemaps : aucune page privée soumise', () => {
  it('le sitemap PT dédié ne liste pas /pt/mercados/gerir/', async () => {
    const { getAllPtSitemapUrls } = await import('@/lib/sitemap-pt-pages')
    const urls = getAllPtSitemapUrls('https://vitfix.io').map(({ url }) => url)
    expect(urls).toContain('https://vitfix.io/pt/mercados/publicar/')
    expect(urls).not.toContain('https://vitfix.io/pt/mercados/gerir/')
  })

  it('le sous-sitemap 0 (pages statiques) ne liste pas /pt/mercados/gerir/', async () => {
    const { GET } = await import('@/app/sitemap/[id]/route')
    const reponse = await GET(new Request('https://vitfix.io/sitemap/0.xml'), { params: Promise.resolve({ id: '0' }) })
    const xml = await reponse.text()
    expect(xml).toContain('/pt/mercados/publicar/</loc>')
    expect(xml).not.toContain('/pt/mercados/gerir/')
  })
})

describe('hreflang réciproques', () => {
  it('/pt/pesquisar/ garde les alternates de son layout (fr-FR → /fr/recherche/)', async () => {
    const layout = await metadataDe(import('@/app/pt/pesquisar/layout'))
    const page = await metadataDe(import('@/app/pt/pesquisar/page'))
    const recherche = await metadataDe(import('@/app/fr/recherche/layout'))
    // Fusion Next clé par clé : un alternates déclaré par la page remplacerait celui du layout.
    const fusion: Metadata = { ...layout, ...page }
    expect(fusion.alternates?.canonical).toBe('https://vitfix.io/pt/pesquisar/')
    expect(fusion.alternates?.languages).toMatchObject({ 'pt-PT': 'https://vitfix.io/pt/pesquisar/', 'fr-FR': 'https://vitfix.io/fr/recherche/' })
    expect(recherche.alternates?.languages).toMatchObject({ 'pt-PT': 'https://vitfix.io/pt/pesquisar/' })
  })

  it('/fr/marches/publier/ ↔ /pt/mercados/publicar/', async () => {
    const { generateMetadata } = await import('@/app/fr/marches/publier/page')
    const pt = await metadataDe(import('@/app/pt/mercados/publicar/page'))
    const fr = await generateMetadata()
    const languages = { 'fr-FR': 'https://vitfix.io/fr/marches/publier/', 'pt-PT': 'https://vitfix.io/pt/mercados/publicar/' }
    expect(fr.alternates?.canonical).toBe('https://vitfix.io/fr/marches/publier/')
    expect(fr.alternates?.languages).toEqual(languages)
    expect(pt.alternates?.languages).toEqual(languages)

    // Branche PT de la page FR (cookie locale=pt) : même paire, canonical PT inchangée.
    cookieLocale.valeur = 'pt'
    const frEnPt = await generateMetadata()
    expect(frEnPt.alternates?.canonical).toBe('https://vitfix.io/pt/mercados/publicar/')
    expect(frEnPt.alternates?.languages).toEqual(languages)
  })
})
