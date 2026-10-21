// Pages concelho des services de district (/pt/servicos/{servico}-{concelho}/) : elles ne s'ouvrent que si
// data/seo/local-proof.json documente des chantiers réels de ce service dans ce concelho (deux chantiers datés, ou un
// seul avec photo décrite). Le fichier de données est remplacé ici par un jeu de test : ces chantiers n'existent pas,
// ils servent seulement à vérifier le mécanisme (aucun n'est publié).

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

vi.mock('@/data/seo/local-proof.json', () => ({
  default: {
    chantiers: [
      // Santo Tirso : deux chantiers datés → page ouverte
      { cidade: 'santo-tirso', metier: 'limpeza-de-telhados', tipo: 'Lavagem e impermeabilização de telhado', quantidade: '120 m²', mes: '2026-09', freguesia: 'Vila das Aves', publicado: '2026-10-25' },
      { cidade: 'santo-tirso', metier: 'limpeza-de-telhados', tipo: 'Limpeza de caleiras', mes: '2026-08', freguesia: 'Roriz', publicado: '2026-10-24' },
      // Baião : un seul chantier, avec photo décrite → page ouverte
      { cidade: 'baiao', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado de lousa', mes: '2026-07', foto: '/images/chantiers/teste.jpg', foto_alt: 'Telhado de lousa depois da lavagem', publicado: '2026-10-23' },
      // Lousada : un seul chantier sans photo → pas de page
      { cidade: 'lousada', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado', mes: '2026-06', publicado: '2026-10-22' },
      // Trofa : deux chantiers mais sans date d'ajout → ne comptent pas (lastmod impossible)
      { cidade: 'trofa', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado', mes: '2026-06' },
      { cidade: 'trofa', metier: 'limpeza-de-telhados', tipo: 'Limpeza de caleiras', mes: '2026-05' },
      // Braga : hors distrito do Porto → jamais de page
      { cidade: 'braga', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado', mes: '2026-06', publicado: '2026-10-22' },
      { cidade: 'braga', metier: 'limpeza-de-telhados', tipo: 'Limpeza de caleiras', mes: '2026-05', publicado: '2026-10-22' },
    ],
    precos: [{ metier: 'limpeza-de-telhados', servico: 'Limpeza e impermeabilização do telhado', min: 20, max: 30, unite: 'm²', fonte: 'equipa VITFIX, outubro de 2026' }],
    prazos: [{ cidade: 'distrito-porto', metiers: ['limpeza-de-telhados'], visita_dias: 2, visita_horas_max: 48, fonte: 'compromisso da equipa VITFIX' }],
    notas_concelho: [{ metier: 'limpeza-de-telhados', cidade: 'baiao', texto: 'Muitos telhados antigos do concelho são de lousa, que se lava com mais cuidado.' }],
    avis: [],
    metodos: {},
  },
}))

import ServiceCityPage, { generateStaticParams, generateMetadata } from '@/app/pt/servicos/[slug]/page'
import CidadePage from '@/app/pt/cidade/[slug]/page'
import LimpezaDeTelhadosPage from '@/app/pt/servicos/limpeza-de-telhados/page'
import { LIMPEZA_DE_TELHADOS, dataModificacaoDistrito, paginasConcelhoDistrito, urlServicoDistrito } from '@/lib/data/pt-servicos-distrito'
import { sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DATA_PAGINAS_DISTRITO } from '@/lib/seo/pt-datas'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX } from '@/lib/seo/pt-meta'
import { ENTITE_PT } from '@/lib/seo/entite-pt'

const BASE = 'https://vitfix.io'
const liens = (c: HTMLElement) => Array.from(c.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('ouverture des pages concelho', () => {
  it('seuls Santo Tirso (deux chantiers datés) et Baião (un chantier avec photo décrite) ouvrent une page', () => {
    expect(paginasConcelhoDistrito().map((p) => p.slug).sort()).toEqual(['limpeza-de-telhados-baiao', 'limpeza-de-telhados-santo-tirso'])
  })

  it('les pages ouvertes sont générées par la route [slug], avec la date du dernier chantier ajouté', () => {
    const slugs = generateStaticParams().map((p) => p.slug)
    expect(slugs).toContain('limpeza-de-telhados-santo-tirso')
    expect(slugs).toContain('limpeza-de-telhados-baiao')
    expect(slugs).not.toContain('limpeza-de-telhados-lousada')
    expect(slugs).not.toContain('limpeza-de-telhados-braga')
    const santoTirso = paginasConcelhoDistrito().find((p) => p.city.slug === 'santo-tirso')
    expect(santoTirso?.dataModificacao).toBe('2026-10-25')
  })

  it('une page fermée répond 404 (notFound), jamais une page vide', async () => {
    await expect(ServiceCityPage(params('limpeza-de-telhados-lousada'))).rejects.toThrow()
    await expect(ServiceCityPage(params('limpeza-de-telhados-braga'))).rejects.toThrow()
  })
})

describe('contenu d’une page concelho', () => {
  it('titre et description : nom du concelho entier, nombre réel de chantiers, numéro, longueurs', async () => {
    const m = await generateMetadata(params('limpeza-de-telhados-santo-tirso'))
    expect(String(m.title)).toMatch(/^Limpeza de telhados em Santo Tirso/)
    expect(String(m.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(String(m.description)).toMatch(/2 trabalhos documentados/)
    expect(String(m.description).length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(m.alternates).toEqual({ canonical: `${BASE}/pt/servicos/limpeza-de-telhados-santo-tirso/` })
  })

  it('h1, chantiers avec freguesias et mois, prix et délai réels, lien vers la page de district', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-santo-tirso')))
    expect(container.querySelector('h1')?.textContent).toBe('Limpeza de telhados em Santo Tirso')
    const intro = container.querySelector('h1')?.nextElementSibling?.textContent ?? ''
    expect(intro).toMatch(/2 trabalhos de limpeza de telhados em Santo Tirso, nas freguesias de Vila das Aves e Roriz, o mais recente em setembro de 2026/)
    expect(container.querySelectorAll('#chantiers article')).toHaveLength(2)
    expect(container.querySelector('#precos')?.textContent).toMatch(/20 a 30 € por m²/)
    expect(container.querySelector('#prazos')?.textContent).toMatch(/48 horas, no máximo/)
    expect(liens(container)).toContain('/pt/servicos/limpeza-de-telhados/')
    expect(liens(container)).toContain('/pt/servicos/telhador-santo-tirso/')
    // Pas de FAQ ni de méthode recopiées de la page de district (test « Série » du guide).
    expect(container.querySelector('#perguntas')).toBeNull()
    expect(container.querySelector('#metodo')).toBeNull()
  })

  it('JSON-LD : Service servi dans le concelho (City) par #business, fil d’Ariane à quatre niveaux, rien d’interdit', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-santo-tirso')))
    const graphe = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@graph']
    expect(graphe.map((n: { '@type': string }) => n['@type'])).toEqual(['Service', 'BreadcrumbList'])
    expect(graphe[0].provider).toEqual({ '@id': ENTITE_PT.id })
    expect(graphe[0].areaServed).toMatchObject({ '@type': 'City', name: 'Santo Tirso' })
    expect(graphe[1].itemListElement.map((i: { item: string }) => i.item)).toEqual([
      `${BASE}/pt/`, `${BASE}/pt/servicos/`, `${BASE}/pt/servicos/limpeza-de-telhados/`, `${BASE}/pt/servicos/limpeza-de-telhados-santo-tirso/`,
    ])
    expect(JSON.stringify(graphe)).not.toMatch(/FAQPage|HowTo|LocalBusiness|AggregateRating|"Review"/)
  })

  it('Baião : photo avec texte alternatif et particularité locale écrite par le propriétaire', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-baiao')))
    expect(container.querySelector('#chantiers img')?.getAttribute('alt')).toBe('Telhado de lousa depois da lavagem')
    const local = container.querySelector('#local')?.textContent ?? ''
    expect(local).toContain('Os telhados de Baião')
    expect(local).toContain('lousa')
  })
})

describe('liens et sitemap quand une page concelho est ouverte', () => {
  it('la page de district liste les concelhos documentés et lie leurs pages ; sa date suit le dernier chantier', () => {
    const { container } = render(LimpezaDeTelhadosPage())
    const l = liens(container)
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-baiao/')
    expect(l).not.toContain('/pt/servicos/limpeza-de-telhados-lousada/')
    expect(dataModificacaoDistrito(LIMPEZA_DE_TELHADOS)).toBe('2026-10-25')
  })

  it('la page telhador du concelho et la page ville lient la page concelho ; ailleurs, la page de district', async () => {
    expect(urlServicoDistrito(LIMPEZA_DE_TELHADOS, 'santo-tirso')).toBe('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    expect(urlServicoDistrito(LIMPEZA_DE_TELHADOS, 'lousada')).toBe('/pt/servicos/limpeza-de-telhados/')
    const telhador = render(await ServiceCityPage(params('telhador-santo-tirso'))).container
    expect(liens(telhador)).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    const cidade = render(await CidadePage(params('santo-tirso'))).container
    expect(liens(cidade)).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    const lousada = render(await CidadePage(params('lousada'))).container
    expect(liens(lousada)).toContain('/pt/servicos/limpeza-de-telhados/')
    const braga = render(await CidadePage(params('braga'))).container
    expect(liens(braga).some((h) => h.startsWith('/pt/servicos/limpeza-de-telhados'))).toBe(false)
  })

  it('sitemap : pages concelho dans le fichier servicos ; les pages qui les lient prennent leur date', () => {
    const g = sitemapsPt(BASE)
    const date = (chemin: string) => Object.values(g).flat().find((u) => u.url === `${BASE}${chemin}`)?.lastModified
    expect(date('/pt/servicos/limpeza-de-telhados-santo-tirso/')).toBe('2026-10-25')
    expect(date('/pt/servicos/limpeza-de-telhados-baiao/')).toBe('2026-10-23')
    expect(date('/pt/servicos/limpeza-de-telhados/')).toBe('2026-10-25')
    expect(date('/pt/servicos/telhador-santo-tirso/')).toBe('2026-10-25')
    expect(date('/pt/cidade/santo-tirso/')).toBe('2026-10-25')
    expect(date('/pt/cidade/lousada/')).toBe(DATA_PAGINAS_DISTRITO)
    expect(date('/pt/servicos/limpeza-de-telhados-lousada/')).toBeUndefined()
    expect(g.servicos.filter((u) => u.url.includes('/limpeza-de-telhados-'))).toHaveLength(2)
  })
})
