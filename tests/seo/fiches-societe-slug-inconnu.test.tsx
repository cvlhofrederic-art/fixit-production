/**
 * Fiches de société /fr/societe/[slug] et /pt/empresa/[slug] (rendues à la demande, lues en base) : un slug inconnu de
 * profiles_artisan répond par une vraie 404 (notFound de Next), et non plus par une fiche « Artisan non trouvé » servie
 * en 200 avec index, follow (soft 404 relevé en production le 30/10/2026 sur /fr/societe/exemplo/ et
 * /pt/empresa/exemplo/). Une fiche existante garde son rendu et ses métadonnées ; une panne de Supabase ne conclut rien
 * (pas de 404 ni de noindex sur une panne), et laisse une trace.
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

type Reponse = { ok: boolean; lignes: unknown[] } | 'erreur-reseau' | null
const supabase = vi.hoisted(() => ({ reponse: null as Reponse, urls: [] as string[] }))

type Props = { params: Promise<{ slug: string }> }
type ModuleFiche = { default: (props: Props) => Promise<unknown>; generateMetadata: (props: Props) => Promise<Metadata> }

const props = (slug: string): Props => ({ params: Promise.resolve({ slug }) })

const ROUTES = [
  {
    route: '/fr/societe/[slug]',
    charger: () => import('@/app/fr/societe/[slug]/page') as Promise<ModuleFiche>,
    origine: '[fr/societe]',
    metadonnees: (): Metadata => ({ title: 'Société | Vitfix', robots: { index: true, follow: true } }),
  },
  {
    route: '/pt/empresa/[slug]',
    charger: () => import('@/app/pt/empresa/[slug]/page') as Promise<ModuleFiche>,
    origine: '[pt/empresa]',
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
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    supabase.urls.push(url)
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

describe.each(ROUTES)('$route', ({ charger, origine, metadonnees }) => {
  it('slug inconnu (Supabase répond sans ligne) : vraie 404 et noindex, sans trace d’erreur', async () => {
    const { default: Page, generateMetadata } = await charger()
    supabase.reponse = { ok: true, lignes: [] }
    await expect(Page(props('exemplo'))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    expect(await generateMetadata(props('exemplo'))).toEqual({ robots: { index: false, follow: false } })
    expect(supabase.urls).toContain('https://exemple.supabase.co/rest/v1/profiles_artisan?select=id&slug=eq.exemplo&limit=1')
    expect(journal.warn).not.toHaveBeenCalled()
  })

  it('fiche existante : fiche partagée rendue, métadonnées inchangées', async () => {
    const { default: Page, generateMetadata } = await charger()
    supabase.reponse = { ok: true, lignes: [{ id: '4f0b7c1e-2a3d-4e5f-8a9b-0c1d2e3f4a5b' }] }
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
})
