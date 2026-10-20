// Pages de service à l'échelle du district (lib/data/pt-servicos-distrito.ts, gel A0 levé par le propriétaire le
// 20/10/2026 pour limpeza de telhados, renovação de fachadas et trabalhos verticais). Garde-fous tirés du guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md et des règles internes :
// - une page par service pour tout le distrito, sans liste de concelhos (keyword stuffing) ;
// - prix, délais et chantiers seulement depuis data/seo/local-proof.json (règle 0.2) : blocs absents sans donnée ;
// - JSON-LD : Service fourni par #business sur le distrito + fil d'Ariane, jamais FAQPage, LocalBusiness ni avis ;
// - la page est dans un seul sitemap avec un lastmod réel, et liée depuis /pt/servicos/, le plan du site, les hubs
//   et les pages métier x ville des métiers liés dans le même distrito.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import LimpezaDeTelhadosPage, { metadata as metadataLimpeza } from '@/app/pt/servicos/limpeza-de-telhados/page'
import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import HubMetierPage from '@/app/pt/perto-de-mim/[slug]/page'
import ServicosHubPage from '@/app/pt/servicos/page'
import MapaDoSitePage from '@/app/pt/mapa-do-site/page'
import { LIMPEZA_DE_TELHADOS, SERVICOS_DISTRITO, servicosDistritoLigados } from '@/lib/data/pt-servicos-distrito'
import { BLOG_ARTICLES, CITIES, SERVICES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX } from '@/lib/seo/pt-meta'
import { ENTITE_PT, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { sitemapsPt, getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'
import { DATA_PAGINAS_DISTRITO } from '@/lib/seo/pt-datas'
import { precosPara, prazoDistritoPara, chantiersDistritoPara } from '@/lib/seo/pt-provas-locais'
import { classer, SERVICOS_DISTRITO_SLUGS } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const url = (s: { slug: string }) => `/pt/servicos/${s.slug}/`
const CIDADES_PORTO = CITIES.filter((c) => c.distrito === 'Porto').map((c) => c.slug)

async function htmlLimpeza() {
  const { container } = render(LimpezaDeTelhadosPage())
  return container
}

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]')
  expect(script).not.toBeNull()
  return JSON.parse(script?.textContent ?? '{}') as { '@graph': Array<Record<string, unknown>> }
}

const liens = (container: HTMLElement) => Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')

describe('données des pages de district', () => {
  it('chaque slug est unique, a sa route statique, est absent de la grille métier x ville et connu de l’outillage d’audit', () => {
    const slugs = SERVICOS_DISTRITO.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(SERVICOS_DISTRITO_SLUGS).toEqual(slugs)
    for (const s of SERVICOS_DISTRITO) {
      // Sans dossier app/pt/servicos/{slug}/, la route [slug] répondrait 404 à une URL déclarée dans le sitemap.
      expect(existsSync(join(process.cwd(), 'app', 'pt', 'servicos', s.slug, 'page.tsx')), s.slug).toBe(true)
      expect(SERVICES.some((m) => m.slug === s.slug), s.slug).toBe(false)
      expect(getAllPageCombos().some((c) => c.slug === s.slug), s.slug).toBe(false)
      expect(classer(url(s))).toEqual({ groupe: 'servicos-distrito', metier: s.slug, ville: '' })
    }
  })

  it('limpeza de telhados : les quatre prestations confirmées par le propriétaire le 20/10/2026, et elles seules', () => {
    expect(LIMPEZA_DE_TELHADOS.prestacoes.map((p) => p.titulo)).toEqual([
      'Lavagem e tratamento antimusgo',
      'Hidrofugação',
      'Pintura de telhas',
      'Caleiras e algerozes',
    ])
  })

  it('les textes ne contiennent ni prix, ni délai chiffré, ni pourcentage (règle 0.2) ; seules années citées : 2005 et 2007 (amianto)', () => {
    const textes = JSON.stringify(Object.fromEntries(Object.entries(LIMPEZA_DE_TELHADOS).filter(([k]) => k !== 'dataModificacao')))
    expect(textes).not.toMatch(/€|\beuros?\b|%/i)
    expect(textes).not.toMatch(/\b\d+\s*(h|horas?|dias?|semanas?|minutos?|anos?|m2|m²)\b/i)
    expect(textes.match(/\b(19|20)\d{2}\b/g)).toEqual(['2005', '2007'])
  })

  it('chaque lien de la page vise une page publiée (hub métier ou article du registre)', () => {
    for (const l of LIMPEZA_DE_TELHADOS.ligacoes) {
      const hub = /^\/pt\/perto-de-mim\/([^/]+)\/$/.exec(l.href)
      const artigo = /^\/pt\/blog\/([^/]+)\/$/.exec(l.href)
      if (hub) expect(SERVICES.some((s) => s.slug === hub[1]), l.href).toBe(true)
      else if (artigo) expect(BLOG_ARTICLES.some((a) => a.slug === artigo[1]), l.href).toBe(true)
      else throw new Error(`lien inattendu : ${l.href}`)
    }
  })

  it('prix, délais et chantiers fournis seulement s’ils sont valides (règle 0.2), quel que soit le contenu de local-proof.json', () => {
    for (const p of precosPara(LIMPEZA_DE_TELHADOS.slug)) expect(p.max > 0 && p.min >= 0 && Boolean(p.unite)).toBe(true)
    const prazo = prazoDistritoPara('Porto', LIMPEZA_DE_TELHADOS.slug)
    if (prazo) expect(prazo.visita_dias > 0 && Boolean(prazo.fonte)).toBe(true)
    for (const c of chantiersDistritoPara(LIMPEZA_DE_TELHADOS.slug, CIDADES_PORTO)) {
      expect(CIDADES_PORTO).toContain(c.cidade)
      expect(c.mes).toMatch(/^\d{4}-\d{2}$/)
    }
  })
})

describe('/pt/servicos/limpeza-de-telhados/ : métadonnées', () => {
  const m = metadataLimpeza as Metadata
  it('titre sans marque, 65 caractères au plus marque comprise ; canonical seule ; Open Graph pt_PT', () => {
    expect(typeof m.title).toBe('string')
    expect(m.title).not.toMatch(/vitfix/i)
    expect(String(m.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(m.title).toBe(LIMPEZA_DE_TELHADOS.titulo)
    expect(m.alternates).toEqual({ canonical: `${BASE}/pt/servicos/limpeza-de-telhados/` })
    expect(m.openGraph).toMatchObject({ locale: 'pt_PT', siteName: 'VITFIX', title: m.title })
  })

  it('description de 120 à 155 caractères, avec le numéro portugais et sans « 24h » (service planifié)', () => {
    const d = String(m.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d).toContain(TELEFONE_PT_TEXTE)
    expect(d).not.toMatch(/24 ?h|24\/7|urg[êe]nc/i)
  })
})

describe('/pt/servicos/limpeza-de-telhados/ : rendu', () => {
  it('un seul h1, celui des données ; les sections attendues ; blocs de données réelles seulement s’ils ont des données', async () => {
    const c = await htmlLimpeza()
    const h1 = c.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(LIMPEZA_DE_TELHADOS.h1)
    for (const id of ['servicos', 'preco', 'metodo', 'quando', 'fibrocimento', 'zona', 'relacionados', 'perguntas']) {
      expect(c.querySelector(`#${id}`), id).not.toBeNull()
    }
    const precos = precosPara(LIMPEZA_DE_TELHADOS.slug)
    if (precos.length) expect(c.querySelectorAll('#precos li')).toHaveLength(precos.length)
    else {
      expect(c.querySelector('#precos')).toBeNull()
      expect(c.textContent).not.toMatch(/€/)
    }
    expect(Boolean(c.querySelector('#prazos'))).toBe(Boolean(prazoDistritoPara('Porto', LIMPEZA_DE_TELHADOS.slug)))
    expect(Boolean(c.querySelector('#chantiers'))).toBe(chantiersDistritoPara(LIMPEZA_DE_TELHADOS.slug, CIDADES_PORTO).length > 0)
  })

  it('l’exclusion confirmée (fibrocimento) est dite dès l’introduction', async () => {
    const c = await htmlLimpeza()
    const intro = c.querySelector('h1')?.nextElementSibling?.textContent ?? ''
    expect(intro).toMatch(/Não limpamos telhados de fibrocimento/)
  })

  it('aucune liste de concelhos : au plus deux noms de concelho dans le texte hors chantiers réels (siège et distrito)', async () => {
    const c = (await htmlLimpeza()).cloneNode(true) as HTMLElement
    c.querySelector('#chantiers')?.remove()
    const texte = c.textContent ?? ''
    const cites = CITIES.filter((city) => texte.includes(city.name)).map((city) => city.name)
    expect(cites.sort()).toEqual(['Marco de Canaveses', 'Porto'])
  })

  it('JSON-LD : Service fourni par #business sur le Distrito do Porto, fil d’Ariane visible, rien d’interdit', async () => {
    const c = await htmlLimpeza()
    const graphe = jsonLd(c)['@graph']
    expect(graphe.map((n) => n['@type'])).toEqual(['Service', 'BreadcrumbList'])
    const service = graphe[0]
    expect(service.provider).toEqual({ '@id': ENTITE_PT.id })
    expect(service.areaServed).toEqual({ '@type': 'AdministrativeArea', name: 'Distrito do Porto' })
    expect(service.url).toBe(`${BASE}/pt/servicos/limpeza-de-telhados/`)
    expect(JSON.stringify(graphe)).not.toMatch(/FAQPage|HowTo|LocalBusiness|EmergencyService|AggregateRating|"Review"|Offer|PriceSpecification/)
    const fil = graphe[1] as { itemListElement: Array<{ item: string }> }
    const visibles = new Set(liens(c))
    for (const { item } of fil.itemListElement.slice(0, -1)) expect(visibles.has(item.replace(BASE, ''))).toBe(true)
  })

  it('FAQ visible (details), sans balisage FAQPage ; une question par entrée des données', async () => {
    const c = await htmlLimpeza()
    const questions = Array.from(c.querySelectorAll('#perguntas details summary')).map((q) => q.querySelector('span')?.textContent)
    expect(questions).toEqual(LIMPEZA_DE_TELHADOS.faqs.map((f) => f.pergunta))
  })
})

describe('sitemap et maillage', () => {
  it('l’URL est dans le seul fichier servicos, une fois, avec la date de la page', () => {
    const groupes = sitemapsPt(BASE)
    for (const s of SERVICOS_DISTRITO) {
      const cible = `${BASE}${url(s)}`
      const presences = Object.entries(groupes).filter(([, urls]) => urls.some((u) => u.url === cible)).map(([g]) => g)
      expect(presences).toEqual(['servicos'])
      expect(groupes.servicos.find((u) => u.url === cible)?.lastModified).toBe(s.dataModificacao)
      expect(s.dataModificacao).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    // Les pages qui reçoivent le lien portent la même date (Google : un changement de liens est significatif).
    const date = (chemin: string) => Object.values(groupes).flat().find((u) => u.url === `${BASE}${chemin}`)?.lastModified
    for (const chemin of ['/pt/servicos/', '/pt/mapa-do-site/', '/pt/perto-de-mim/telhador/', '/pt/perto-de-mim/impermeabilizacao/', '/pt/servicos/telhador-porto/', '/pt/servicos/impermeabilizacao-baiao/']) {
      expect(date(chemin), chemin).toBe(DATA_PAGINAS_DISTRITO)
    }
    for (const chemin of ['/pt/perto-de-mim/eletricista/', '/pt/servicos/telhador-braga/', '/pt/servicos/canalizador-porto/']) {
      expect(date(chemin), chemin).not.toBe(DATA_PAGINAS_DISTRITO)
    }
    expect(getAllPtSitemapUrls(BASE)).toHaveLength(554 + SERVICOS_DISTRITO.length)
  })

  it('liée depuis /pt/servicos/ et le plan du site (profondeur 2 depuis /pt/)', async () => {
    const index = render(ServicosHubPage()).container
    expect(liens(index)).toContain('/pt/servicos/limpeza-de-telhados/')
    const plano = render(MapaDoSitePage()).container
    expect(liens(plano)).toContain('/pt/servicos/limpeza-de-telhados/')
  })

  it('liée depuis les hubs telhador et impermeabilização, pas depuis un hub sans lien métier', async () => {
    for (const slug of ['telhador', 'impermeabilizacao']) {
      const { container } = render(await HubMetierPage({ params: Promise.resolve({ slug }) }))
      expect(liens(container), slug).toContain('/pt/servicos/limpeza-de-telhados/')
    }
    const { container } = render(await HubMetierPage({ params: Promise.resolve({ slug: 'eletricista' }) }))
    expect(liens(container)).not.toContain('/pt/servicos/limpeza-de-telhados/')
  })

  it('liée depuis les pages telhador et impermeabilização du distrito do Porto, jamais depuis un autre distrito', async () => {
    const lienVers = async (slug: string) => {
      const { container } = render(await ServiceCityPage({ params: Promise.resolve({ slug }) }))
      return liens(container).includes('/pt/servicos/limpeza-de-telhados/')
    }
    expect(await lienVers('telhador-porto')).toBe(true)
    expect(await lienVers('impermeabilizacao-penafiel')).toBe(true)
    expect(await lienVers('telhador-braga')).toBe(false)
    expect(await lienVers('telhador-aveiro')).toBe(false)
    expect(await lienVers('canalizador-porto')).toBe(false)
    expect(servicosDistritoLigados('telhador', 'Porto').map((s) => s.slug)).toEqual(['limpeza-de-telhados'])
  })
})
