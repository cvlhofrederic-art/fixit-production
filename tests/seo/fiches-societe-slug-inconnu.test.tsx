/**
 * Fiches de société /fr/societe/[slug] et /pt/empresa/[slug] (rendues à la demande, lues en base) : un slug inconnu de
 * profiles_artisan répond par une vraie 404 (notFound de Next), et non plus par une fiche « Artisan non trouvé » servie
 * en 200 avec index, follow (soft 404 relevé en production le 30/10/2026 sur /fr/societe/exemplo/ et
 * /pt/empresa/exemplo/). Une fiche existante garde son rendu et ses métadonnées, avec une canonical vers son adresse
 * publique (getProfilePath : /fr/artisan/ pour une fiche FR, seule URL indexable d'une fiche FR ; /pt/empresa/ pour une
 * société PT ; noindex si elle relève de /pt/profissional/) ; une panne de Supabase ne conclut rien (pas de 404 ni de
 * noindex sur une panne), et laisse une trace ; une base muette est abandonnée au bout de 3 s.
 *
 * Supabase (REST) est simulé par un fetch factice, la page client partagée (/fr/artisan/[id]) par un composant témoin.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { isValidElement } from 'react'
import type { Metadata } from 'next'
import FichePartagee from '@/app/fr/artisan/[id]/page'

const journal = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }))

vi.mock('@/lib/logger', () => ({ logger: journal }))
vi.mock('@/app/fr/artisan/[id]/page', () => ({ default: function FichePartagee() { return null } }))

type Reponse = { ok: boolean; lignes: unknown[] } | 'erreur-reseau' | 'sans-reponse' | null
const supabase = vi.hoisted(() => ({ reponse: null as Reponse, urls: [] as string[] }))

type Props = { params: Promise<{ slug: string }> }
type ModuleFiche = { default: (props: Props) => Promise<unknown>; generateMetadata: (props: Props) => Promise<Metadata> }

const props = (slug: string): Props => ({ params: Promise.resolve({ slug }) })

const UUID = '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b'
// Ligne de profiles_artisan telle que la lit la route (id, slug, language, legal_form).
const ligne = (champs: Record<string, unknown>) => ({ id: UUID, slug: 'plomberie-durand-sarl', language: 'fr', legal_form: 'SARL', ...champs })

// Échoue au lieu d'attendre indéfiniment : sans délai maximal, une base muette laisserait la promesse pendante.
async function avantLimite<T>(promesse: Promise<T>, ms = 2000): Promise<T> {
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const limite = new Promise<never>((_resoudre, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`promesse encore pendante après ${ms} ms`)), ms)
  })
  try {
    return await Promise.race([promesse, limite])
  } finally {
    clearTimeout(minuteur)
  }
}

const ROUTES = [
  {
    route: '/fr/societe/[slug]',
    charger: () => import('@/app/fr/societe/[slug]/page') as Promise<ModuleFiche>,
    origine: '[fr/societe]',
    fiche: ligne({}),
    // Une seule URL indexable par fiche FR : canonical vers /fr/artisan/, la page reste en index, follow.
    metadonnees: (slug: string): Metadata => ({
      title: 'Société',
      robots: { index: true, follow: true },
      alternates: { canonical: `https://vitfix.io/fr/artisan/${slug}/` },
    }),
  },
  {
    route: '/pt/empresa/[slug]',
    charger: () => import('@/app/pt/empresa/[slug]/page') as Promise<ModuleFiche>,
    origine: '[pt/empresa]',
    // Société PT : canonical vers elle-même.
    fiche: ligne({ language: 'pt', legal_form: 'Lda' }),
    metadonnees: (slug: string): Metadata => ({
      title: 'Empresa',
      robots: { index: true, follow: true },
      alternates: { canonical: `https://vitfix.io/pt/empresa/${slug}/` },
    }),
  },
]

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://exemple.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'cle-anon-de-test')
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    supabase.urls.push(url)
    if (supabase.reponse === 'sans-reponse') {
      // Base qui ne répond jamais : seul l'abandon par le signal du fetch termine la lecture.
      return new Promise<never>((_resoudre, rejeter) => {
        init?.signal?.addEventListener('abort', () => rejeter(init.signal?.reason))
      })
    }
    if (supabase.reponse === 'erreur-reseau') throw new TypeError('fetch failed')
    if (!supabase.reponse) throw new Error('réponse Supabase non définie par le test')
    const { ok, lignes } = supabase.reponse
    return { ok, status: ok ? 200 : 503, json: async () => lignes }
  }))
})

afterAll(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  supabase.reponse = null
  supabase.urls = []
  journal.warn.mockClear()
  journal.error.mockClear()
})

describe.each(ROUTES)('$route', ({ charger, origine, fiche, metadonnees }) => {
  it('slug inconnu (Supabase répond sans ligne) : vraie 404 et noindex, sans trace d’erreur', async () => {
    const { default: Page, generateMetadata } = await charger()
    supabase.reponse = { ok: true, lignes: [] }
    await expect(Page(props('exemplo'))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(await generateMetadata(props('exemplo'))).toEqual({ robots: { index: false, follow: false } })
    expect(supabase.urls).toContain('https://exemple.supabase.co/rest/v1/profiles_artisan?select=id%2Cslug%2Clanguage%2Clegal_form&slug=eq.exemplo&limit=1')
    expect(journal.warn).not.toHaveBeenCalled()
  })

  it('fiche existante : fiche partagée rendue, métadonnées inchangées', async () => {
    const { default: Page, generateMetadata } = await charger()
    supabase.reponse = { ok: true, lignes: [fiche] }
    const rendu = await Page(props('plomberie-durand-sarl'))
    expect(isValidElement(rendu) && rendu.type).toBe(FichePartagee)
    expect(await generateMetadata(props('plomberie-durand-sarl'))).toEqual(metadonnees('plomberie-durand-sarl'))
    expect(journal.warn).not.toHaveBeenCalled()
  })

  it('Supabase en erreur ou injoignable : pas de 404 ni de noindex sur une panne, trace journalisée', async () => {
    const { default: Page, generateMetadata } = await charger()
    supabase.reponse = { ok: false, lignes: [] }
    expect(isValidElement(await Page(props('plomberie-durand-sarl')))).toBe(true)
    expect(await generateMetadata(props('plomberie-durand-sarl'))).toEqual(metadonnees('plomberie-durand-sarl'))
    expect(journal.warn).toHaveBeenCalledWith(expect.stringContaining(origine), expect.objectContaining({ status: 503 }))

    journal.warn.mockClear()
    supabase.reponse = 'erreur-reseau'
    expect(isValidElement(await Page(props('plomberie-durand-sarl')))).toBe(true)
    expect(await generateMetadata(props('plomberie-durand-sarl'))).toEqual(metadonnees('plomberie-durand-sarl'))
    expect(journal.warn).toHaveBeenCalledWith(
      expect.stringContaining(origine),
      expect.objectContaining({ id: 'plomberie-durand-sarl', error: expect.stringContaining('fetch failed') }),
    )
  })

  it('Supabase sans réponse : lecture abandonnée au bout de 3 s, fiche rendue au lieu d’une réponse bloquée', async () => {
    const { default: Page, generateMetadata } = await charger()
    // Délai de production vérifié (3 000 ms), puis ramené à 10 ms pour que le test reste rapide.
    const delaiReel = AbortSignal.timeout.bind(AbortSignal)
    const delai = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => delaiReel(10))
    try {
      supabase.reponse = 'sans-reponse'
      expect(isValidElement(await avantLimite(Page(props('plomberie-durand-sarl'))))).toBe(true)
      expect(await avantLimite(generateMetadata(props('plomberie-durand-sarl')))).toEqual(metadonnees('plomberie-durand-sarl'))
      expect(delai).toHaveBeenCalledWith(3000)
      expect(journal.warn).toHaveBeenCalledWith(
        expect.stringContaining(origine),
        expect.objectContaining({ id: 'plomberie-durand-sarl', error: expect.stringContaining('TimeoutError') }),
      )
    } finally {
      delai.mockRestore()
    }
  })
})

describe('/fr/societe/[slug] : une seule URL indexable par fiche FR', () => {
  // /fr/societe/ n'a ni titre ni description de fiche, ni JSON-LD : la fiche complète est sous /fr/artisan/, dont le
  // layout se déclare canonique. La canonical prend le slug de la fiche lue, même pour un accès par UUID : pas de chaîne
  // /fr/societe/<UUID>/ → /fr/artisan/<UUID>/ → /fr/artisan/<slug>/.
  it.each([
    ['slug', 'plomberie-durand-sarl'],
    ['UUID', UUID],
  ])('fiche existante (%s) : canonical vers /fr/artisan/<slug de la fiche>/, toujours en index, follow', async (_type, identifiant) => {
    const { generateMetadata } = (await import('@/app/fr/societe/[slug]/page')) as ModuleFiche
    supabase.reponse = { ok: true, lignes: [ligne({})] }
    const metadata = await generateMetadata(props(identifiant))
    expect(metadata.alternates).toEqual({ canonical: 'https://vitfix.io/fr/artisan/plomberie-durand-sarl/' })
    expect(metadata.robots).toEqual({ index: true, follow: true })
  })
})

describe('fiche reprise sous une autre route : canonical vers son adresse publique (getProfilePath)', () => {
  // Ces adresses ne sont produites par aucun lien ; la canonical suit la langue et la forme juridique de la fiche lue,
  // comme getProfilePath (la redirection UUID suit la langue de la route). Une fiche qui relève de /pt/profissional/
  // (noindex) met la page en noindex.
  const ROUTE = {
    '/fr/societe/': () => import('@/app/fr/societe/[slug]/page') as Promise<ModuleFiche>,
    '/pt/empresa/': () => import('@/app/pt/empresa/[slug]/page') as Promise<ModuleFiche>,
  }
  it.each([
    ['/fr/societe/', 'fiche pt, société', 'https://vitfix.io/pt/empresa/construcoes-ribeiro/', true, ligne({ slug: 'construcoes-ribeiro', language: 'pt', legal_form: 'Lda' })],
    ['/fr/societe/', 'fiche pt, individuelle', 'https://vitfix.io/pt/profissional/canalizacao-silva/', false, ligne({ slug: 'canalizacao-silva', language: 'pt', legal_form: 'ENI' })],
    ['/pt/empresa/', 'non-société', 'https://vitfix.io/pt/profissional/canalizacao-silva/', false, ligne({ slug: 'canalizacao-silva', language: 'pt', legal_form: 'ENI' })],
    ['/pt/empresa/', 'non-société sans slug', `https://vitfix.io/pt/profissional/${UUID}/`, false, ligne({ slug: null, language: 'pt', legal_form: null })],
    ['/pt/empresa/', 'fiche FR', 'https://vitfix.io/fr/artisan/plomberie-durand-sarl/', true, ligne({})],
  ] as Array<[keyof typeof ROUTE, string, string, boolean, Record<string, unknown>]>)(
    '%s, %s : canonical %s, index %s',
    async (route, _cas, canonique, indexable, fiche) => {
      const { generateMetadata } = await ROUTE[route]()
      supabase.reponse = { ok: true, lignes: [fiche] }
      const metadata = await generateMetadata(props('identifiant-de-la-route'))
      expect(metadata.alternates).toEqual({ canonical: canonique })
      expect(metadata.robots).toEqual({ index: indexable, follow: indexable })
    },
  )
})
