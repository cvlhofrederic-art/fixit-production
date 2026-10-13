/**
 * Phase 1 du plan SEO PT (hygiène technique, docs/seo/pt-inventaire.md) : garde-fous sur ce que
 * la phase a changé, pour que les phases suivantes ne le défassent pas.
 *
 * 1.1 sitemaps PT découpés par modèle, une URL dans un seul fichier, /sitemap/1.xml en 410 ;
 * 1.2 anciens articles en 410 (middleware) ou 301 vers l'équivalent (tests/next-config-routage-opennext) ;
 * 1.3 entité unique #business avec adresse réelle, NIF et téléphone PT ;
 * 1.4 titres sans marque (le template de app/pt/layout.tsx l'ajoute une fois), ≤ 65 caractères ;
 * 1.5 pas d'hreflang sur la grille (aucune page FR équivalente), x-default sur /fr/ ;
 * 1.6 JSON-LD : Service + BreadcrumbList (+ WebPage), plus de FAQPage, HowTo, LocalBusiness par ville ;
 * 1.7 robots.txt : /api/og/ (image sociale) autorisé malgré « Disallow: /api/ ».
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import type { Metadata } from 'next'
import { NextRequest } from 'next/server'
import { BLOG_ARTICLES, CITIES, SERVICES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { tituloComCidade } from '@/lib/seo/pt-meta'
import {
  SUFIXO_MARCA, TITULO_MAX, DESCRICAO_MAX, tituloBlog, nomeDistrito,
  tituloServico, descricaoServico,
  tituloPertoDeMim, descricaoPertoDeMim, tituloCidade, descricaoCidade,
} from '@/lib/seo/pt-meta'
import { grafo, noFilAriane, noServicoLocal, noServicoRegional, noWebPage, areaServidaPt } from '@/lib/seo/pt-schemas'
import { ENTITE_PT, ADRESSE_PT_TEXTE, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { FICHIERS_SITEMAP_PT, sitemapsPt, urlsFichiersSitemapPt, type GroupeSitemapPt } from '@/lib/sitemap-pt-pages'

vi.mock('@/lib/supabase-server-component', () => ({ createServerSupabaseClient: vi.fn() }))
// Pages à generateMetadata par locale (cookie) : branche PT.
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (nom: string) => (nom === 'locale' ? { name: 'locale', value: 'pt' } : undefined) }),
}))

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
const TITULO_MIN = 35 // Plancher du test T6 (scripts/seo/pt-tests.mjs), marque comprise.
const DESCRICAO_MIN = 120

// Imports statiques (vite n'accepte pas un chemin de module entièrement dynamique).
// Phase 2 SEO PT : plus de route urgencia/[slug] ; perto-de-mim/[slug] ne sert que les 21 hubs métier.
const ROUTES_GRILLE = {
  servicos: () => import('@/app/pt/servicos/[slug]/page'),
  'perto-de-mim': () => import('@/app/pt/perto-de-mim/[slug]/page'),
  cidade: () => import('@/app/pt/cidade/[slug]/page'),
}
const HUBS = {
  servicos: () => import('@/app/pt/servicos/page'),
  urgencia: () => import('@/app/pt/urgencia/page'),
  'perto-de-mim': () => import('@/app/pt/perto-de-mim/page'),
  cidade: () => import('@/app/pt/cidade/page'),
}
const ROUTES_SITEMAP: Record<GroupeSitemapPt, () => Promise<{ GET: () => Response | Promise<Response> }>> = {
  servicos: () => import('@/app/pt/sitemap-servicos.xml/route'),
  hubs: () => import('@/app/pt/sitemap-hubs.xml/route'),
  cidades: () => import('@/app/pt/sitemap-cidades.xml/route'),
  blog: () => import('@/app/pt/sitemap-blog.xml/route'),
  paginas: () => import('@/app/pt/sitemap-paginas.xml/route'),
}
// Pages PT à métadonnées statiques (title string) : la marque est ajoutée par le template du layout.
const PAGES_STATIQUES = {
  '/pt/': () => import('@/app/pt/page'),
  '/pt/servicos/': () => import('@/app/pt/servicos/page'),
  '/pt/urgencia/': () => import('@/app/pt/urgencia/page'),
  '/pt/perto-de-mim/': () => import('@/app/pt/perto-de-mim/page'),
  '/pt/cidade/': () => import('@/app/pt/cidade/page'),
  '/pt/blog/': () => import('@/app/pt/blog/page'),
  '/pt/precos/': () => import('@/app/pt/precos/page'),
  '/pt/especialidades/': () => import('@/app/pt/especialidades/page'),
  '/pt/condominio/': () => import('@/app/pt/condominio/page'),
  '/pt/profissionais-verificados/': () => import('@/app/pt/profissionais-verificados/page'),
  '/pt/como-funciona/': () => import('@/app/pt/como-funciona/page'),
  '/pt/torne-se-parceiro/': () => import('@/app/pt/torne-se-parceiro/page'),
  '/pt/simulador-orcamento/': () => import('@/app/pt/simulador-orcamento/page'),
  '/pt/sobre/': () => import('@/app/pt/sobre/page'),
  '/pt/sobre/ (layout)': () => import('@/app/pt/sobre/layout'),
  '/pt/pesquisar/': () => import('@/app/pt/pesquisar/page'),
  '/pt/pesquisar/ (layout)': () => import('@/app/pt/pesquisar/layout'),
  '/pt/avaliacoes/': () => import('@/app/pt/avaliacoes/page'),
  '/pt/mapa-do-site/': () => import('@/app/pt/mapa-do-site/page'),
  '/pt/mercados/publicar/': () => import('@/app/pt/mercados/publicar/page'),
  '/pt/avisos-legais/': () => import('@/app/pt/avisos-legais/page'),
  '/pt/termos/': () => import('@/app/pt/termos/page'),
  '/pt/privacidade/': () => import('@/app/pt/privacidade/page'),
  '/pt/politica-cookies/': () => import('@/app/pt/politica-cookies/page'),
}

function fichiersSous(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom)
    if (statSync(chemin).isDirectory()) return fichiersSous(chemin)
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : []
  })
}

describe('1.3 entité unique : adresse réelle, NIF et téléphone PT', () => {
  it('ENTITE_PT porte le NIF, le téléphone PT et l’adresse postale fournie par le propriétaire', () => {
    expect(ENTITE_PT.id).toBe('https://vitfix.io/#business')
    expect(ENTITE_PT.nif).toBe('276873297')
    expect(ENTITE_PT.taxID).toBe('PT276873297')
    expect(ENTITE_PT.telephone).toBe('+351912014971')
    expect(TELEFONE_PT_TEXTE).toBe('+351 912 014 971')
    expect(ENTITE_PT.adresse).toEqual({
      '@type': 'PostalAddress',
      streetAddress: 'Av. Dr. Artur Melo e Castro 109',
      postalCode: '4630-204',
      addressLocality: 'Marco de Canaveses',
      addressRegion: 'Porto',
      addressCountry: 'PT',
    })
    expect(ADRESSE_PT_TEXTE).toBe('Av. Dr. Artur Melo e Castro 109, 4630-204 Marco de Canaveses')
  })

  it('le nœud #business du layout racine utilise cette adresse et les 22 concelhos en areaServed', () => {
    const layout = readFileSync(join(process.cwd(), 'app', 'layout.tsx'), 'utf8')
    expect(layout).toContain('ENTITE_PT.adresse')
    expect(layout).toContain('areaServidaPt()')
    expect(areaServidaPt()).toHaveLength(22)
    expect(areaServidaPt()[0]).toEqual({
      '@type': 'City',
      name: CITIES[0].name,
      containedInPlace: { '@type': 'AdministrativeArea', name: `Distrito ${nomeDistrito(CITIES[0].distrito)}` },
    })
    // Nom officiel : « Distrito do Porto » (article), « Distrito de Braga », « Distrito de Aveiro ».
    expect(nomeDistrito('Porto')).toBe('do Porto')
    expect(nomeDistrito('Aveiro')).toBe('de Aveiro')
    expect(areaServidaPt().map((c) => c.containedInPlace.name)).not.toContain('Distrito de Porto')
  })

  it('les avisos legais affichent le siège', () => {
    const page = readFileSync(join(process.cwd(), 'app', 'pt', 'avisos-legais', 'page.tsx'), 'utf8')
    expect(page).toContain('ADRESSE_PT_TEXTE')
  })
})

// Phase 2 SEO PT : la grille indexable est 462 servicos + 21 hubs métier + 22 pages ville (505 pages) ;
// urgencia et perto-de-mim métier x ville répondent 301 vers servicos (data/seo/pt-redirects.csv).
describe('1.4 titres et descriptions de la grille (505 pages)', () => {
  const titres: Array<[string, string]> = [
    ...getAllPageCombos().map((c): [string, string] => [`servicos/${c.slug}`, tituloServico(c.service, c.city)]),
    ...SERVICES.map((s): [string, string] => [`perto-de-mim/${s.slug}`, tituloPertoDeMim(s.name)]),
    ...CITIES.map((c): [string, string] => [`cidade/${c.slug}`, tituloCidade(c)]),
  ]
  const descriptions: Array<[string, string]> = [
    ...getAllPageCombos().map((c): [string, string] => [`servicos/${c.slug}`, descricaoServico(c.service, c.city)]),
    ...SERVICES.map((s): [string, string] => [`perto-de-mim/${s.slug}`, descricaoPertoDeMim(s.name)]),
    ...CITIES.map((c): [string, string] => [`cidade/${c.slug}`, descricaoCidade(c, SERVICES.length)]),
  ]

  it('couvre les 462 + 21 + 22 pages', () => {
    expect(titres).toHaveLength(462 + 21 + 22)
    expect(new Set(titres.map(([chemin]) => chemin)).size).toBe(titres.length)
  })

  it('aucun titre ne contient la marque (le template l’ajoute une fois) ni ne dépasse 65 caractères marque comprise', () => {
    const fautifs = titres
      .filter(([, t]) => /vitfix/i.test(t) || t.length + SUFIXO_MARCA.length > TITULO_MAX || t.length + SUFIXO_MARCA.length < TITULO_MIN || /[\s,;:·\-–]$/.test(t))
      .map(([chemin, t]) => `${chemin} : « ${t} » (${t.length + SUFIXO_MARCA.length})`)
    expect(fautifs).toEqual([])
  })

  it('le nom de la ville est toujours entier dans le titre (jamais « em Marco de | VITFIX »)', () => {
    const avecCidade: Array<[string, string, string]> = [
      ...getAllPageCombos().map((c): [string, string, string] => [`servicos/${c.slug}`, tituloServico(c.service, c.city), c.city.name]),
      ...CITIES.map((c): [string, string, string] => [`cidade/${c.slug}`, tituloCidade(c), c.name]),
    ]
    expect(avecCidade).toHaveLength(462 + 22)
    const fautifs = avecCidade.filter(([, t, cidade]) => !t.includes(` ${cidade}`) || /\b(e|de|do|da)\s+(em|urgente|perto)\b/.test(t)).map(([chemin, t]) => `${chemin} : « ${t} »`)
    expect(fautifs).toEqual([])
    // Cas limites : métier long x ville composée, le métier est raccourci, jamais la ville.
    const estores = SERVICES.find((s) => s.slug === 'estores-portoes')!
    const marco = CITIES.find((c) => c.slug === 'marco-de-canaveses')!
    expect(tituloServico(estores, marco)).toContain(' em Marco de Canaveses')
    expect(tituloComCidade('Estores e Portões Automáticos', 'urgente em', 'Marco de Canaveses')).toBe('Estores e Portões urgente em Marco de Canaveses')
    expect(tituloComCidade('Estores e Portões Automáticos', 'perto de mim em', 'Vila Nova de Gaia')).toBe('Estores e Portões perto de mim em Vila Nova de Gaia')
  })

  it('aucune description ne compte les freguesias (la liste du dépôt n’est pas le décompte officiel) ni ne dit « distrito de Porto »', () => {
    expect(descriptions.filter(([, d]) => /\d+ freguesias/.test(d) || /distrito de Porto/.test(d))).toEqual([])
    expect(descriptions.filter(([, d]) => /distrito do Porto/.test(d)).length).toBeGreaterThan(300)
  })

  it('les titres sont uniques dans chaque modèle et entre modèles', () => {
    const doublons = [...titres.reduce((m, [, t]) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())]
      .filter(([, n]) => n > 1)
    expect(doublons).toEqual([])
  })

  it('chaque description tient en 155 caractères, cite la ville ou la zone et un fait réel (freguesias, habitants, concelhos)', () => {
    const fautives = descriptions
      .filter(([, d]) => d.length > DESCRICAO_MAX || d.length < DESCRICAO_MIN || !/(freguesias|habitantes|concelhos)/.test(d))
      .map(([chemin, d]) => `${chemin} : « ${d} » (${d.length})`)
    expect(fautives).toEqual([])
  })

  it('les descriptions sont uniques', () => {
    const doublons = [...descriptions.reduce((m, [, d]) => m.set(d, (m.get(d) ?? 0) + 1), new Map<string, number>())]
      .filter(([, n]) => n > 1)
    expect(doublons).toEqual([])
  })

  it('chaque description garde un appel à l’action (WhatsApp / orçamento) ; le téléphone, quand il tient, est le numéro portugais', () => {
    expect(descriptions.filter(([, d]) => !/WhatsApp|orçamento/i.test(d))).toEqual([])
    // Le numéro n'entre que dans la variante longue de la phrase de contact (métiers et villes aux noms courts).
    const avecTelefone = descriptions.filter(([, d]) => d.includes('+351'))
    expect(avecTelefone.length).toBeGreaterThan(descriptions.length / 4)
    expect(avecTelefone.filter(([, d]) => !d.includes('+351 912 014 971'))).toEqual([])
    expect(descriptions.filter(([, d]) => /\+33/.test(d))).toEqual([])
  })

  it('titres de blog : la marque une seule fois, 65 caractères au plus', () => {
    for (const article of BLOG_ARTICLES) {
      const t = tituloBlog(article.metaTitle, article.title)
      if (typeof t === 'string') {
        expect(t).not.toMatch(/vitfix/i)
        expect(t.length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
      } else {
        expect(t.absolute.length).toBeLessThanOrEqual(TITULO_MAX)
        expect((t.absolute.match(/vitfix/gi) ?? []).length).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('1.4 / 1.5 métadonnées exportées par les routes de la grille et les hubs', () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

  it.each([
    ['servicos', 'canalizador-porto'],
    ['perto-de-mim', 'eletricista'],
    ['cidade', 'porto'],
  ] as Array<[keyof typeof ROUTES_GRILLE, string]>)('/pt/%s/%s/ : titre sans marque, canonical seule (aucun hreflang), Open Graph pt_PT', async (dossier, slug) => {
    const route = (await ROUTES_GRILLE[dossier]()) as unknown as {
      generateMetadata: (args: { params: Promise<{ slug: string }> }) => Promise<Metadata>
    }
    const metadata = await route.generateMetadata(params(slug))
    expect(typeof metadata.title).toBe('string')
    expect(metadata.title).not.toMatch(/vitfix/i)
    expect(String(metadata.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(metadata.alternates).toEqual({ canonical: `https://vitfix.io/pt/${dossier}/${slug}/` })
    expect(metadata.openGraph).toMatchObject({ locale: 'pt_PT', siteName: 'VITFIX', title: metadata.title })
    expect(String(metadata.description).length).toBeLessThanOrEqual(DESCRICAO_MAX)
  })

  it.each(Object.keys(HUBS) as Array<keyof typeof HUBS>)('hub /pt/%s/ : titre sans marque, canonical seule', async (dossier) => {
    const { metadata } = (await HUBS[dossier]()) as unknown as { metadata: Metadata }
    expect(typeof metadata.title).toBe('string')
    expect(metadata.title).not.toMatch(/vitfix/i)
    expect(String(metadata.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(metadata.alternates).toEqual({ canonical: `https://vitfix.io/pt/${dossier}/` })
  })

  it.each(Object.keys(PAGES_STATIQUES) as Array<keyof typeof PAGES_STATIQUES>)('%s : titre string sans marque (≤ 56 + « | VITFIX »), description ≤ 155', async (page) => {
    const module_ = (await PAGES_STATIQUES[page]()) as unknown as { metadata?: Metadata; generateMetadata?: () => Promise<Metadata> }
    const metadata = module_.metadata ?? (await module_.generateMetadata!())
    expect(typeof metadata.title).toBe('string')
    expect(metadata.title).not.toMatch(/vitfix/i)
    expect(String(metadata.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    if (metadata.description) expect(metadata.description.length).toBeLessThanOrEqual(DESCRICAO_MAX)
  })

  it.each([
    ['/pt/empresa/<slug>/', () => import('@/app/pt/empresa/[slug]/page'), { slug: 'exemplo' }, 'https://vitfix.io/pt/empresa/exemplo/'],
    ['/pt/profissional/<id>/', () => import('@/app/pt/profissional/[id]/page'), { id: 'exemplo' }, 'https://vitfix.io/pt/profissional/exemplo/'],
  ] as Array<[string, () => Promise<unknown>, Record<string, string>, string]>)('%s : titre sans marque, canonical seule (aucun hreflang : /fr/artisan/ n’en émet pas en retour)', async (_page, charger, params, canonical) => {
    const { generateMetadata } = (await charger()) as { generateMetadata: (a: { params: Promise<Record<string, string>> }) => Promise<Metadata> }
    const metadata = await generateMetadata({ params: Promise.resolve(params) })
    expect(metadata.title).not.toMatch(/vitfix/i)
    expect(metadata.alternates).toEqual({ canonical })
  })

  it('/pt/pesquisar/ (composant partagé avec /fr/recherche/) : un seul h1 en PT, FR inchangé (h1 visible comme avant la phase 1)', () => {
    const src = readFileSync(join(process.cwd(), 'app', 'fr', 'recherche', 'page.tsx'), 'utf8')
    expect(src).toMatch(/const TituloResultados = siteLocale === 'pt' \? 'h2' : 'h1'/)
    expect((src.match(/<h1\b/g) ?? []).length).toBe(1)
  })

  it('app/pt/layout.tsx : template « %s | VITFIX », x-default sur /fr/ (répond 200, / répond 302)', async () => {
    const { metadata } = (await import('@/app/pt/layout')) as { metadata: Metadata }
    expect(metadata.title).toEqual({ default: 'Profissionais de construção verificados em Portugal', template: '%s | VITFIX' })
    expect(metadata.alternates?.languages).toMatchObject({ 'x-default': 'https://vitfix.io/fr/', 'pt-PT': 'https://vitfix.io/pt/' })
    expect(String(metadata.description).length).toBeLessThanOrEqual(DESCRICAO_MAX)
  })

  it('aucune page sous app/pt ne déclare x-default sur « / » (302) ni d’hreflang vers /en/, /es/ ou /nl/ hors accueil', () => {
    const fautifs = fichiersSous(join(process.cwd(), 'app', 'pt'))
      .filter((f) => !/[\\/]pt[\\/](page|layout)\.tsx$/.test(f))
      .map((f) => [f, readFileSync(f, 'utf8')] as const)
      .filter(([, src]) => /'x-default':\s*'https:\/\/vitfix\.io\/'/.test(src) || /'(en|es|nl)':\s*'https:\/\/vitfix\.io\/(en|es|nl)\//.test(src))
      .map(([f]) => f.replace(process.cwd(), ''))
    expect(fautifs).toEqual([])
  })
})

describe('1.6 JSON-LD', () => {
  it('Service local : fourni par #business, servi dans la ville, sans Offer, FAQ ni horaires', () => {
    const city = CITIES.find((c) => c.slug === 'porto')!
    const service = SERVICES.find((s) => s.slug === 'canalizador')!
    const url = 'https://vitfix.io/pt/servicos/canalizador-porto/'
    const graphe = grafo(
      noServicoLocal({ url, nome: 'Canalizador em Porto', serviceType: service.name, descricao: descricaoServico(service, city), city }),
      noFilAriane([{ name: 'VITFIX', url: 'https://vitfix.io/pt/' }, { name: 'Canalizador em Porto', url }]),
    )
    expect(graphe['@context']).toBe('https://schema.org')
    expect(graphe['@graph'].map((n) => n['@type'])).toEqual(['Service', 'BreadcrumbList'])
    expect(graphe['@graph'][0]).toMatchObject({
      '@id': `${url}#service`,
      provider: { '@id': ENTITE_PT.id },
      areaServed: { '@type': 'City', name: 'Porto' },
      inLanguage: 'pt-PT',
    })
    expect(JSON.stringify(graphe)).not.toMatch(/offers|openingHours|aggregateRating|FAQPage|HowTo|LocalBusiness|priceRange/)
  })

  it('Service régional (hub métier) : areaServed = 22 concelhos ; WebPage rattachée au site et à #business', () => {
    const regional = noServicoRegional({ url: 'https://vitfix.io/pt/perto-de-mim/eletricista/', nome: 'Eletricista perto de mim', serviceType: 'Eletricista', descricao: 'x' })
    expect(regional.areaServed).toHaveLength(22)
    expect(regional.provider).toEqual({ '@id': ENTITE_PT.id })
    const page = noWebPage({ url: 'https://vitfix.io/pt/cidade/porto/', nome: 'Serviços para casa em Porto' })
    expect(page).toMatchObject({ '@type': 'WebPage', isPartOf: { '@id': 'https://vitfix.io/#website' }, publisher: { '@id': ENTITE_PT.id } })
  })

  it('aucune page sous app/pt n’émet FAQPage, HowTo, LocalBusiness, EmergencyService, AggregateRating ou Review', () => {
    const interdits = /['"]@type['"]\s*:\s*['"](FAQPage|HowTo|LocalBusiness|HomeAndConstructionBusiness|EmergencyService|AggregateRating|Review|Plumber|Electrician)['"]|buildFaqSchema\(|buildBusinessSchema\(|buildHowToSchema\(/
    const fautifs = fichiersSous(join(process.cwd(), 'app', 'pt'))
      .filter((f) => interdits.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(process.cwd(), ''))
    expect(fautifs).toEqual([])
  })
})

describe('1.1 sitemaps PT', () => {
  const groupes = Object.keys(FICHIERS_SITEMAP_PT) as GroupeSitemapPt[]

  it('/pt/sitemap.xml est un index des 5 fichiers par modèle (servicos, hubs, cidades, blog, paginas)', async () => {
    const { GET } = await import('@/app/pt/sitemap.xml/route')
    const xml = await (await GET()).text()
    expect(xml).toContain('<sitemapindex')
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
    expect(locs).toEqual(urlsFichiersSitemapPt(BASE))
    expect(locs).toHaveLength(5)
    expect(locs.map((l) => l.replace(BASE, ''))).toEqual(groupes.map((g) => FICHIERS_SITEMAP_PT[g]))
  })

  it.each(groupes)('/pt/sitemap-%s.xml : autant d’<url> que le code, un lastmod par URL, ni priority ni changefreq', async (groupe) => {
    const { GET } = await ROUTES_SITEMAP[groupe]()
    const reponse = await GET()
    expect(reponse.headers.get('content-type')).toContain('xml')
    const xml = await reponse.text()
    const attendu = sitemapsPt(BASE)[groupe]
    expect((xml.match(/<url>/g) ?? []).length).toBe(attendu.length)
    expect((xml.match(/<lastmod>/g) ?? []).length).toBe(attendu.length)
    expect(xml).not.toContain('<priority>')
    expect(xml).not.toContain('<changefreq>')
    expect(xml).not.toContain('<xhtml:link')
    for (const { url } of attendu.slice(0, 3)) expect(xml).toContain(`<loc>${url}</loc>`)
  })

  it('/sitemap.xml référence 0, 2, 3 et les 6 fichiers PT ; plus /sitemap/1.xml ni l’index /pt/sitemap.xml', async () => {
    const { GET } = await import('@/app/sitemap.xml/route')
    const xml = await (await GET()).text()
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(BASE, ''))
    expect(locs).toEqual(['/sitemap/0.xml', '/sitemap/2.xml', '/sitemap/3.xml', ...groupes.map((g) => FICHIERS_SITEMAP_PT[g])])
  })

  it('lastmod : date propre à chaque article de blog (dateModified sinon datePublished), jamais une date unique sur tout le blog', () => {
    const blog = sitemapsPt(BASE).blog
    const dates = new Set(blog.map((u) => String(u.lastModified)))
    expect(dates.size).toBeGreaterThan(5)
    for (const article of BLOG_ARTICLES) {
      const entree = blog.find((u) => u.url === `${BASE}/pt/blog/${article.slug}/`)
      expect(entree?.lastModified).toBe(article.dateModified ?? article.datePublished)
    }
    expect(BLOG_ARTICLES.find((a) => a.slug === 'fuga-agua-como-agir')?.dateModified).toBe('2026-10-13')
  })

  it('/sitemap/1.xml répond 410 ; /sitemap/0.xml ne contient plus aucune URL /pt/', async () => {
    const { GET } = await import('@/app/sitemap/[id]/route')
    const gone = await GET(new Request(`${BASE}/sitemap/1.xml`), { params: Promise.resolve({ id: '1' }) })
    expect(gone.status).toBe(410)
    const zero = await (await GET(new Request(`${BASE}/sitemap/0.xml`), { params: Promise.resolve({ id: '0' }) })).text()
    expect(zero).not.toContain('/pt/')
    expect(zero).toContain('<loc>' + BASE + '/fr/</loc>')
    expect((zero.match(/<url>/g) ?? []).length).toBe(11)
  })
})

describe('1.7 robots.txt', () => {
  it('chaque règle autorise /api/og/ (image sociale) tout en interdisant /api/', async () => {
    const { default: robots } = await import('@/app/robots')
    const { rules, sitemap } = robots()
    const liste = Array.isArray(rules) ? rules : [rules]
    expect(liste.length).toBeGreaterThan(10)
    for (const regle of liste) {
      const allow = Array.isArray(regle.allow) ? regle.allow : [regle.allow]
      const disallow = Array.isArray(regle.disallow) ? regle.disallow : [regle.disallow]
      expect(allow).toContain('/api/og/')
      expect(allow).toContain('/')
      expect(disallow).toContain('/api/')
    }
    expect(String(sitemap)).toMatch(/\/sitemap\.xml$/)
  })
})

describe('1.2 middleware : anciens articles PT en 410 Gone', () => {
  it.each([
    '/pt/blog/poupar-agua-casa/',
    '/pt/blog/certificacao-eletrica/',
    '/pt/blog/seguranca-eletrica-casa',
    '/pt/blog/paineis-solares-portugal/',
    '/pt/blog/como-escolher-tinta/',
    '/pt/blog/preparar-paredes-pintura/',
  ])('%s → 410, X-Robots-Tag noindex, CSP posée', async (chemin) => {
    const { middleware } = await import('@/middleware')
    const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`))
    expect(reponse.status).toBe(410)
    expect(reponse.headers.get('x-robots-tag')).toBe('noindex')
    expect(reponse.headers.get('content-security-policy')).toBeTruthy()
  })

  it('un article existant et l’index du blog passent (200)', async () => {
    const { middleware } = await import('@/middleware')
    for (const chemin of ['/pt/blog/humidade-parede-causas-reparacao/', '/pt/blog/']) {
      const reponse = await middleware(new NextRequest(`https://vitfix.io${chemin}`))
      expect(reponse.status).toBe(200)
    }
  })
})
