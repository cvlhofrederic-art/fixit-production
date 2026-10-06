/**
 * Données structurées des pages FR : chaque niveau du fil d'Ariane (BreadcrumbList) désigne l'URL finale,
 * jamais une URL qui redirige (https://vitfix.io/ en 302 géolocalisé, /recherche/ en 308, hub
 * /fr/pres-de-chez-moi/ en 308 vers /fr/).
 * Fiche artisan FR : un profil inexistant (page client servie en 200, « Artisan non trouvé ») est en noindex.
 *
 * Les composants serveur sont appelés comme des fonctions : le JSON-LD est lu dans l'arbre d'éléments rendu,
 * sans monter les composants enfants. Supabase (REST) est simulé par un fetch factice.
 * Le logger serveur est simulé : une lecture Supabase en échec doit laisser une trace (jamais de catch muet).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement, type ReactNode } from 'react'

const journal = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/logger', () => ({ logger: journal }))

type ElementDeFil = { position: number; name: string; item: string }

function extraireJsonLd(noeud: ReactNode): unknown[] {
  if (Array.isArray(noeud)) return noeud.flatMap(extraireJsonLd)
  if (!isValidElement(noeud)) return []
  const props = noeud.props as { type?: string; dangerouslySetInnerHTML?: { __html: string }; children?: ReactNode }
  if (noeud.type === 'script' && props.type === 'application/ld+json' && props.dangerouslySetInnerHTML) {
    return [JSON.parse(props.dangerouslySetInnerHTML.__html)]
  }
  return extraireJsonLd(props.children)
}

function trouverFils(donnee: unknown): ElementDeFil[][] {
  if (Array.isArray(donnee)) return donnee.flatMap(trouverFils)
  if (!donnee || typeof donnee !== 'object') return []
  const objet = donnee as Record<string, unknown>
  if (objet['@type'] === 'BreadcrumbList') return [objet.itemListElement as ElementDeFil[]]
  return Object.values(objet).flatMap(trouverFils)
}

function filUnique(noeud: ReactNode): ElementDeFil[] {
  const fils = trouverFils(extraireJsonLd(noeud))
  expect(fils).toHaveLength(1)
  return fils[0]
}

// URL qui ne sont jamais des pages finales : racine (302 géolocalisé), ancienne recherche (308), hub sans page (308).
const URL_REDIRIGEES = ['https://vitfix.io/', 'https://vitfix.io/recherche/', 'https://vitfix.io/fr/pres-de-chez-moi/']

function verifierFil(fil: ElementDeFil[]) {
  expect(fil.map(({ position }) => position)).toEqual(fil.map((_, index) => index + 1))
  for (const { item } of fil) expect(URL_REDIRIGEES).not.toContain(item)
}

describe('pages FR statiques : niveau 1 « Vitfix » sur https://vitfix.io/fr/', () => {
  it.each([
    ['/fr/artisans-verifies/', () => import('@/app/fr/artisans-verifies/page'), 'https://vitfix.io/fr/artisans-verifies/'],
    ['/fr/comment-ca-marche/', () => import('@/app/fr/comment-ca-marche/page'), 'https://vitfix.io/fr/comment-ca-marche/'],
    ['/fr/devenir-partenaire/', () => import('@/app/fr/devenir-partenaire/page'), 'https://vitfix.io/fr/devenir-partenaire/'],
  ])('%s', async (_page, charger, urlPage) => {
    const { default: Page } = await charger()
    const fil = filUnique(Page())
    verifierFil(fil)
    expect(fil.map(({ item }) => item)).toEqual(['https://vitfix.io/fr/', urlPage])
  })
})

describe('/fr/pres-de-chez-moi/<slug>/ : pas de niveau vers le hub redirigé', () => {
  it.each([
    ['plombier-marseille'],
    ['plombier'],
  ])('%s', async (slug) => {
    const { default: Page } = await import('@/app/fr/pres-de-chez-moi/[slug]/page')
    const fil = filUnique(await Page({ params: Promise.resolve({ slug }) }))
    verifierFil(fil)
    expect(fil.map(({ item }) => item)).toEqual(['https://vitfix.io/fr/', `https://vitfix.io/fr/pres-de-chez-moi/${slug}/`])
  })
})

describe('fiche artisan /fr/artisan/<id>/', () => {
  const lecture: { reponse: null | { ok: boolean; lignes: unknown[] } | 'erreur-reseau' } = { reponse: null }

  const ARTISAN = {
    company_name: 'Plomberie Durand',
    bio: null,
    categories: ['Plombier'],
    company_city: 'Marseille',
    rating_avg: null,
    rating_count: 0,
    language: 'fr',
    profile_photo_url: null,
    slug: 'plomberie-durand',
    latitude: null,
    longitude: null,
    phone: null,
  }

  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemple.supabase.co')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-anon-de-test')
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (lecture.reponse === 'erreur-reseau') throw new TypeError('fetch failed')
      if (!lecture.reponse) throw new Error('réponse Supabase non définie par le test')
      const { ok, lignes } = lecture.reponse
      return { ok, status: ok ? 200 : 503, json: async () => lignes }
    }))
  })

  afterAll(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    lecture.reponse = null
    journal.warn.mockClear()
    journal.error.mockClear()
  })

  const charger = () => import('@/app/fr/artisan/[id]/layout')
  const params = (id: string) => Promise.resolve({ id })

  it('profil inexistant (Supabase répond sans ligne) : noindex, titre inchangé', async () => {
    const { generateMetadata } = await charger()
    lecture.reponse = { ok: true, lignes: [] }
    const metadata = await generateMetadata({ params: params('xyz-inexistant-999') })
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(metadata.title).toBe('Artisan non trouvé - Vitfix')
  })

  it('Supabase en erreur : on ne conclut pas à un profil inexistant (pas de noindex), erreur journalisée', async () => {
    const { generateMetadata } = await charger()
    lecture.reponse = { ok: false, lignes: [] }
    const enErreur = await generateMetadata({ params: params('plomberie-durand') })
    expect(enErreur.robots).toBeUndefined()
    expect(enErreur.title).toBe('Artisan non trouvé - Vitfix')
    expect(journal.warn).toHaveBeenCalledWith(expect.stringContaining('[fr/artisan]'), expect.objectContaining({ status: 503 }))

    journal.warn.mockClear()
    lecture.reponse = 'erreur-reseau'
    const horsLigne = await generateMetadata({ params: params('plomberie-durand') })
    expect(horsLigne.robots).toBeUndefined()
    expect(horsLigne.title).toBe('Artisan - Vitfix')
    expect(journal.warn).toHaveBeenCalledWith(
      expect.stringContaining('[fr/artisan]'),
      expect.objectContaining({ id: 'plomberie-durand', error: expect.stringContaining('fetch failed') }),
    )
  })

  it('Supabase injoignable : fiche rendue sans JSON-LD, erreur journalisée', async () => {
    const { default: ArtisanLayout } = await charger()
    lecture.reponse = 'erreur-reseau'
    const contenu = 'contenu-de-la-fiche'
    const rendu = await ArtisanLayout({ children: contenu, params: params('plomberie-durand') })
    expect(extraireJsonLd(rendu)).toEqual([])
    expect(isValidElement(rendu) && (rendu.props as { children?: ReactNode }).children).toContain(contenu)
    expect(journal.warn).toHaveBeenCalledWith(
      expect.stringContaining('[fr/artisan]'),
      expect.objectContaining({ id: 'plomberie-durand', error: expect.stringContaining('fetch failed') }),
    )
  })

  it('profil inexistant ou trouvé : aucune trace d’erreur', async () => {
    const { generateMetadata } = await charger()
    lecture.reponse = { ok: true, lignes: [] }
    await generateMetadata({ params: params('xyz-inexistant-999') })
    lecture.reponse = { ok: true, lignes: [ARTISAN] }
    await generateMetadata({ params: params('plomberie-durand') })
    expect(journal.warn).not.toHaveBeenCalled()
    expect(journal.error).not.toHaveBeenCalled()
  })

  it('profil existant : indexable, canonical sur la fiche', async () => {
    const { generateMetadata } = await charger()
    lecture.reponse = { ok: true, lignes: [ARTISAN] }
    const metadata = await generateMetadata({ params: params('plomberie-durand') })
    expect(metadata.robots).toBeUndefined()
    expect(metadata.alternates?.canonical).toBe('https://vitfix.io/fr/artisan/plomberie-durand/')
  })

  it('fil d’Ariane FR : /fr/ → /fr/recherche/ → fiche', async () => {
    const { default: ArtisanLayout } = await charger()
    lecture.reponse = { ok: true, lignes: [ARTISAN] }
    const fil = filUnique(await ArtisanLayout({ children: null, params: params('plomberie-durand') }))
    verifierFil(fil)
    expect(fil.map(({ item }) => item)).toEqual([
      'https://vitfix.io/fr/',
      'https://vitfix.io/fr/recherche/',
      'https://vitfix.io/fr/artisan/plomberie-durand/',
    ])
  })

  it('fil d’Ariane PT : inchangé (/pt/ → /pt/pesquisar/ → fiche)', async () => {
    const { default: ArtisanLayout } = await charger()
    lecture.reponse = { ok: true, lignes: [{ ...ARTISAN, language: 'pt', slug: 'canalizacao-silva' }] }
    const fil = filUnique(await ArtisanLayout({ children: null, params: params('canalizacao-silva') }))
    expect(fil.map(({ item }) => item)).toEqual([
      'https://vitfix.io/pt/',
      'https://vitfix.io/pt/pesquisar/',
      'https://vitfix.io/pt/profissional/canalizacao-silva/',
    ])
  })

  it('profil inexistant : pas de JSON-LD', async () => {
    const { default: ArtisanLayout } = await charger()
    lecture.reponse = { ok: true, lignes: [] }
    expect(extraireJsonLd(await ArtisanLayout({ children: null, params: params('xyz-inexistant-999') }))).toEqual([])
  })
})
