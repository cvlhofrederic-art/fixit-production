// Pages concelho des services de district (/pt/servicos/{servico}-{concelho}/) : elles ne s'ouvrent que si
// data/seo/local-proof.json réunit les trois conditions de la section 4.4 du guide Google du 19/10/2026 : un chantier
// complet (photo décrite, freguesia, problème, solution, date), une information propre au lieu (particularité locale ou
// deuxième chantier détaillé) et une relecture humaine datée. Le fichier de données est remplacé ici par un jeu de test
// FICTIF : ces chantiers n'existent pas et ne sont jamais publiés, ils servent seulement à vérifier le mécanisme. Ses dates
// sont postérieures à DATA_ZONA_DISTRITOS (date du contenu des pages de district) pour que celles des chantiers et des
// relectures se voient dans les lastmod. Zone des pages de district depuis le 28/10/2026 : distritos do Porto, Braga e
// Aveiro ; Braga et Ovar (distrito de Aveiro) peuvent donc ouvrir leur page, sur les mêmes conditions.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

// vi.hoisted : la fabrique est remontée avec vi.mock, avant le reste du fichier.
const { completo } = vi.hoisted(() => ({ completo: (cidade: string, freguesia: string, mes: string, publicado: string) => ({
  cidade, metier: 'limpeza-de-telhados', tipo: 'Lavagem e impermeabilização de telhado', mes, freguesia, publicado,
  problema: 'Musgo espesso nas telhas', solucao: 'Lavagem e aplicação de hidrofugante', acesso: 'corda',
  foto: `/images/chantiers/teste-${cidade}.jpg`, foto_alt: `Telhado em ${freguesia} depois da lavagem`,
}) }))

vi.mock('@/data/seo/local-proof.json', () => ({
  default: {
    chantiers: [
      // Santo Tirso : un chantier complet + un deuxième chantier détaillé + relecture → page ouverte
      completo('santo-tirso', 'Vila das Aves', '2026-09', '2026-11-05'),
      { cidade: 'santo-tirso', metier: 'limpeza-de-telhados', tipo: 'Limpeza de caleiras', mes: '2026-08', freguesia: 'Roriz', problema: 'Caleiras entupidas', solucao: 'Limpeza e teste de escoamento', publicado: '2026-11-04' },
      // Baião : un chantier complet + une particularité locale + relecture → page ouverte (un seul chantier)
      completo('baiao', 'Ancede', '2026-07', '2026-11-03'),
      // Porto : complet + particularité locale, mais PAS de relecture → fermée
      completo('porto', 'Foz do Douro', '2026-06', '2026-11-02'),
      // Maia : deux chantiers détaillés mais aucun avec photo, relecture → fermée (pas de chantier complet)
      { cidade: 'maia', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado', mes: '2026-06', freguesia: 'Águas Santas', problema: 'Líquenes', solucao: 'Lavagem', publicado: '2026-11-02' },
      { cidade: 'maia', metier: 'limpeza-de-telhados', tipo: 'Lavagem de telhado', mes: '2026-05', freguesia: 'Moreira', problema: 'Musgo', solucao: 'Lavagem', publicado: '2026-11-02' },
      // Trofa : chantier complet sans date valide (30/02), relecture → fermée
      completo('trofa', 'Bougado', '2026-06', '2026-02-30'),
      // Lousada : chantier complet, relecture, mais ni note ni deuxième chantier détaillé → fermée
      completo('lousada', 'Lustosa', '2026-06', '2026-11-02'),
      // Braga (distrito de Braga) : un chantier complet + un deuxième chantier détaillé + relecture → page ouverte
      completo('braga', 'Gualtar', '2026-06', '2026-11-02'),
      { cidade: 'braga', metier: 'limpeza-de-telhados', tipo: 'Limpeza de caleiras', mes: '2026-05', freguesia: 'Gualtar', problema: 'x', solucao: 'y', publicado: '2026-11-02' },
      // Ovar (distrito de Aveiro) : un chantier complet + une particularité locale + relecture → page ouverte
      completo('ovar', 'Esmoriz', '2026-08', '2026-11-04'),
    ],
    notas_concelho: [
      { metier: 'limpeza-de-telhados', cidade: 'baiao', texto: 'Muitos telhados antigos do concelho são de lousa, que se lava com mais cuidado.', publicado: '2026-11-03' },
      { metier: 'limpeza-de-telhados', cidade: 'porto', texto: 'No centro histórico, o acesso aos telhados faz-se quase sempre por corda.', publicado: '2026-11-02' },
      { metier: 'limpeza-de-telhados', cidade: 'ovar', texto: 'Perto do mar, o sal e a areia acumulam-se nas telhas e nas caleiras.', publicado: '2026-11-04' },
    ],
    revisoes_concelho: [
      { metier: 'limpeza-de-telhados', cidade: 'santo-tirso', revisto: '2026-11-06' },
      { metier: 'limpeza-de-telhados', cidade: 'baiao', revisto: '2026-11-03' },
      { metier: 'limpeza-de-telhados', cidade: 'maia', revisto: '2026-11-02' },
      { metier: 'limpeza-de-telhados', cidade: 'trofa', revisto: '2026-11-02' },
      { metier: 'limpeza-de-telhados', cidade: 'lousada', revisto: '2026-11-02' },
      { metier: 'limpeza-de-telhados', cidade: 'braga', revisto: '2026-11-02' },
      { metier: 'limpeza-de-telhados', cidade: 'ovar', revisto: '2026-11-04' },
    ],
    precos: [{ metier: 'limpeza-de-telhados', servico: 'Limpeza e impermeabilização do telhado', min: 20, max: 30, unite: 'm²', fonte: 'equipa VITFIX, outubro de 2026' }],
    prazos: [{ distritos: ['Porto', 'Braga', 'Aveiro'], metiers: ['limpeza-de-telhados'], visita_dias: 2, visita_horas_max: 48, fonte: 'compromisso da equipa VITFIX' }],
    avis: [{ cidade: 'santo-tirso', metier: 'limpeza-de-telhados', nota: 5, texto: 'Telhado limpo num dia.', mes: '2026-09', autorizacao: true }],
    metodos: {},
  },
}))

import ServiceCityPage, { generateStaticParams, generateMetadata } from '@/app/pt/servicos/[slug]/page'
import CidadePage from '@/app/pt/cidade/[slug]/page'
import LimpezaDeTelhadosPage from '@/app/pt/servicos/limpeza-de-telhados/page'
import { LIMPEZA_DE_TELHADOS, SERVICOS_DISTRITO, dataLigacoesServicos, dataModificacaoDistrito, paginasConcelhoDistrito, urlServicoDistrito } from '@/lib/data/pt-servicos-distrito'
import { sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX, descricaoConcelhoDistrito, tituloConcelhoDistrito } from '@/lib/seo/pt-meta'
import { ENTITE_PT } from '@/lib/seo/entite-pt'
import { CITIES } from '@/lib/data/seo-pages-data'

const BASE = 'https://vitfix.io'
const liens = (c: HTMLElement) => Array.from(c.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

describe('ouverture des pages concelho (section 4.4 du guide)', () => {
  it('seuls Santo Tirso, Baião, Braga et Ovar réunissent chantier complet, information locale et relecture', () => {
    expect(paginasConcelhoDistrito().map((p) => p.slug).sort()).toEqual([
      'limpeza-de-telhados-baiao', 'limpeza-de-telhados-braga', 'limpeza-de-telhados-ovar', 'limpeza-de-telhados-santo-tirso',
    ])
  })

  it('jamais hors des distritos de la page : sans Braga ni Aveiro dans la zone, leurs pages restent fermées et sans lien', async () => {
    const original = LIMPEZA_DE_TELHADOS.distritos
    try {
      LIMPEZA_DE_TELHADOS.distritos = ['Porto']
      expect(paginasConcelhoDistrito().map((p) => p.slug).sort()).toEqual(['limpeza-de-telhados-baiao', 'limpeza-de-telhados-santo-tirso'])
      const braga = render(await CidadePage(params('braga'))).container
      expect(liens(braga).some((h) => h.startsWith('/pt/servicos/limpeza-de-telhados'))).toBe(false)
    } finally {
      LIMPEZA_DE_TELHADOS.distritos = original
    }
  })

  it('les pages ouvertes sont générées par la route [slug] ; ouverture = date de relecture ; lastmod = dernier élément publié', () => {
    const slugs = generateStaticParams().map((p) => p.slug)
    for (const s of ['santo-tirso', 'baiao', 'braga', 'ovar']) expect(slugs).toContain(`limpeza-de-telhados-${s}`)
    for (const s of ['porto', 'maia', 'trofa', 'lousada', 'aveiro']) expect(slugs).not.toContain(`limpeza-de-telhados-${s}`)
    const santoTirso = paginasConcelhoDistrito().find((p) => p.city.slug === 'santo-tirso')
    expect(santoTirso?.dataAbertura).toBe('2026-11-06')
    expect(santoTirso?.dataModificacao).toBe('2026-11-06')
  })

  it('une page fermée répond par notFound (404 de Next), jamais une page vide', async () => {
    for (const s of ['lousada', 'porto', 'aveiro']) {
      await expect(ServiceCityPage(params(`limpeza-de-telhados-${s}`))).rejects.toThrow('NEXT_HTTP_ERROR_FALLBACK;404')
    }
  })
})

describe('contenu d’une page concelho', () => {
  it('titre et description : concelho entier, nombre réel de chantiers, numéro, 120 à 155 caractères', async () => {
    const m = await generateMetadata(params('limpeza-de-telhados-santo-tirso'))
    expect(String(m.title)).toMatch(/^Limpeza de telhados em Santo Tirso/)
    expect(String(m.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(String(m.description)).toMatch(/2 trabalhos documentados/)
    expect(String(m.description).length).toBeGreaterThanOrEqual(120)
    expect(String(m.description).length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(m.alternates).toEqual({ canonical: `${BASE}/pt/servicos/limpeza-de-telhados-santo-tirso/` })
    expect(m.openGraph?.images).toEqual([{ url: `${BASE}/images/chantiers/teste-santo-tirso.jpg`, alt: 'Telhado em Vila das Aves depois da lavagem' }])
  })

  it('titres et descriptions de toutes les villes de la zone, avec 1 ou 2 chantiers : article (no Porto, na Maia), longueurs', () => {
    const zona = CITIES.filter((c) => LIMPEZA_DE_TELHADOS.distritos.includes(c.distrito))
    expect(zona).toHaveLength(22)
    for (const city of zona) {
      for (const n of [1, 2]) {
        const pagina = { servico: LIMPEZA_DE_TELHADOS, city, chantiers: Array.from({ length: n }) }
        const t = tituloConcelhoDistrito(pagina)
        const d = descricaoConcelhoDistrito(pagina)
        expect(t.length + SUFIXO_MARCA.length, `${city.name} ${n}`).toBeLessThanOrEqual(TITULO_MAX)
        expect(d.length, `${city.name} ${n}`).toBeGreaterThanOrEqual(120)
        expect(d.length, `${city.name} ${n}`).toBeLessThanOrEqual(DESCRICAO_MAX)
        expect(t).toContain(city.name)
        expect(t).not.toMatch(/em (Porto|Maia|Trofa|Póvoa)/)
      }
    }
    const porto = CITIES.find((c) => c.slug === 'porto')!
    expect(tituloConcelhoDistrito({ servico: LIMPEZA_DE_TELHADOS, city: porto, chantiers: [1] })).toBe('Limpeza de telhados no Porto')
  })

  it('page complète : ce qui est fait et ne l’est pas, chantiers détaillés, facteurs et prix, délai, avis, liens', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-santo-tirso')))
    expect(container.querySelector('h1')?.textContent).toBe('Limpeza de telhados em Santo Tirso')
    const intro = container.querySelector('h1')?.nextElementSibling?.textContent ?? ''
    expect(intro).toContain('já fez 2 trabalhos de limpeza de telhados e caleiras em Santo Tirso (Vila das Aves e Roriz), o mais recente em setembro de 2026')
    expect(intro).toContain('Partimos de Marco de Canaveses e trabalhamos em todos os concelhos dos distritos do Porto, Braga e Aveiro.')
    expect(container.textContent).toContain('Grátis e sem compromisso, em Santo Tirso e em todos os concelhos onde trabalhamos.')
    expect(container.textContent).not.toMatch(/distrito do Porto/)
    expect(container.querySelector('#servicos')?.textContent).toMatch(/não fazemos a limpeza/)
    expect(container.querySelectorAll('#chantiers article')).toHaveLength(2)
    const chantiersTexto = container.querySelector('#chantiers')?.textContent ?? ''
    for (const t of ['O que encontrámos: Musgo espesso', 'O que fizemos: Lavagem', 'Acesso: técnicos de acesso por corda certificados IRATA']) expect(chantiersTexto).toContain(t)
    expect(container.querySelectorAll('#preco li').length).toBeGreaterThanOrEqual(LIMPEZA_DE_TELHADOS.fatoresPreco.length)
    expect(container.querySelector('#precos')?.textContent).toMatch(/20 a 30 € por m²/)
    expect(container.querySelector('#prazos')?.textContent).toMatch(/Visita em 48 horas, no máximo/)
    expect(container.querySelector('#avaliacoes')?.textContent).toMatch(/Telhado limpo num dia/)
    expect(liens(container)).toContain('/pt/servicos/limpeza-de-telhados/')
    expect(liens(container)).toContain('/pt/servicos/telhador-santo-tirso/')
    // La FAQ et la méthode détaillée restent sur la page de district (test « Série » du guide).
    expect(container.querySelector('#perguntas')).toBeNull()
    expect(container.querySelector('#metodo')).toBeNull()
    expect(container.querySelector('#chantiers img')?.getAttribute('loading')).toBe('lazy')
  })

  it('page concelho hors du distrito do Porto (Ovar, distrito de Aveiro) : même gabarit, délai de la zone, lien vers la grille du concelho', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-ovar')))
    expect(container.querySelector('h1')?.textContent).toBe('Limpeza de telhados em Ovar')
    expect(container.querySelector('#local h2')?.textContent).toBe('Os telhados de Ovar')
    expect(container.querySelector('#prazos')?.textContent).toMatch(/Visita em 48 horas, no máximo/)
    expect(liens(container)).toContain('/pt/servicos/telhador-ovar/')
    const graphe = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@graph']
    expect(graphe[0].areaServed).toMatchObject({ '@type': 'City', name: 'Ovar', containedInPlace: { name: 'Distrito de Aveiro' } })
  })

  it('un seul chantier : pas de « o mais recente », et particularité locale « Os telhados de Baião »', async () => {
    const { container } = render(await ServiceCityPage(params('limpeza-de-telhados-baiao')))
    const intro = container.querySelector('h1')?.nextElementSibling?.textContent ?? ''
    expect(intro).toContain('fez um trabalho de limpeza de telhados e caleiras em Baião (Ancede), em julho de 2026')
    expect(intro).not.toContain('o mais recente')
    expect(container.querySelector('#local h2')?.textContent).toBe('Os telhados de Baião')
    expect(container.querySelector('#chantiers img')?.getAttribute('alt')).toBe('Telhado em Ancede depois da lavagem')
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
})

describe('liens et sitemap quand une page concelho est ouverte', () => {
  it('la page de district lie chaque page concelho depuis une carte de chantier réel, sans liste de villes', () => {
    const { container } = render(LimpezaDeTelhadosPage())
    const l = liens(container)
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-baiao/')
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-braga/')
    expect(l).toContain('/pt/servicos/limpeza-de-telhados-ovar/')
    expect(l).not.toContain('/pt/servicos/limpeza-de-telhados-lousada/')
    expect(container.textContent).not.toContain('Trabalhos documentados por concelho')
    expect(dataModificacaoDistrito(LIMPEZA_DE_TELHADOS)).toBe('2026-11-06')
  })

  it('les cartes de liens de la page de district (dataModificacaoLigacoes) ne changent que son lastmod, pas celui des pages concelho', () => {
    const avant = paginasConcelhoDistrito().map((p) => [p.slug, p.dataModificacao])
    const original = LIMPEZA_DE_TELHADOS.dataModificacaoLigacoes
    try {
      // Date postérieure à tous les éléments du jeu de test : seule la page de district la prend (le gabarit des pages
      // concelho n'affiche pas les cartes de liens).
      LIMPEZA_DE_TELHADOS.dataModificacaoLigacoes = '2026-11-30'
      expect(dataModificacaoDistrito(LIMPEZA_DE_TELHADOS)).toBe('2026-11-30')
      expect(paginasConcelhoDistrito().map((p) => [p.slug, p.dataModificacao])).toEqual(avant)
    } finally {
      LIMPEZA_DE_TELHADOS.dataModificacaoLigacoes = original
    }
  })

  it('pages telhador du concelho et pages ville : page concelho si ouverte, sinon page de district', async () => {
    expect(urlServicoDistrito(LIMPEZA_DE_TELHADOS, 'santo-tirso')).toBe('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    expect(urlServicoDistrito(LIMPEZA_DE_TELHADOS, 'lousada')).toBe('/pt/servicos/limpeza-de-telhados/')
    const telhador = render(await ServiceCityPage(params('telhador-santo-tirso'))).container
    expect(liens(telhador)).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    const cidade = render(await CidadePage(params('santo-tirso'))).container
    expect(liens(cidade)).toContain('/pt/servicos/limpeza-de-telhados-santo-tirso/')
    const lousada = render(await CidadePage(params('lousada'))).container
    expect(liens(lousada)).toContain('/pt/servicos/limpeza-de-telhados/')
    const braga = render(await CidadePage(params('braga'))).container
    expect(liens(braga)).toContain('/pt/servicos/limpeza-de-telhados-braga/')
    expect(braga.textContent).toContain('Limpeza de telhados em Braga')
    const aveiro = render(await CidadePage(params('aveiro'))).container
    expect(liens(aveiro)).toContain('/pt/servicos/limpeza-de-telhados/')
  })

  it('sitemap : pages concelho dans le fichier servicos ; les pages qui les lient prennent la date d’ouverture', () => {
    const g = sitemapsPt(BASE)
    const date = (chemin: string) => Object.values(g).flat().find((u) => u.url === `${BASE}${chemin}`)?.lastModified
    expect(date('/pt/servicos/limpeza-de-telhados-santo-tirso/')).toBe('2026-11-06')
    expect(date('/pt/servicos/limpeza-de-telhados-baiao/')).toBe('2026-11-03')
    expect(date('/pt/servicos/limpeza-de-telhados/')).toBe('2026-11-06')
    expect(date('/pt/servicos/telhador-santo-tirso/')).toBe('2026-11-06')
    expect(date('/pt/cidade/santo-tirso/')).toBe('2026-11-06')
    // Page ville sans page concelho ouverte : date des liens de la plus récente des pages de district qu'elle lie.
    expect(date('/pt/cidade/lousada/')).toBe(dataLigacoesServicos(SERVICOS_DISTRITO))
    expect(date('/pt/servicos/canalizador-santo-tirso/')).not.toBe('2026-11-06')
    expect(date('/pt/servicos/limpeza-de-telhados-lousada/')).toBeUndefined()
    expect(date('/pt/servicos/limpeza-de-telhados-ovar/')).toBe('2026-11-04')
    expect(date('/pt/servicos/telhador-ovar/')).toBe('2026-11-04')
    expect(date('/pt/cidade/ovar/')).toBe('2026-11-04')
    expect(g.servicos.filter((u) => /\/limpeza-de-telhados-[a-z-]+\/$/.test(u.url))).toHaveLength(4)
  })
})
