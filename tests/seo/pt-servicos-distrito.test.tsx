// Pages de service à l'échelle du district (lib/data/pt-servicos-distrito.ts, gel A0 levé par le propriétaire le
// 20/10/2026 pour limpeza de telhados, renovação de fachadas et trabalhos verticais). Garde-fous tirés du guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md et des règles internes :
// - une page par service pour toute sa zone (distritos do Porto, Braga e Aveiro depuis le 28/10/2026), sans liste de
//   concelhos (keyword stuffing) ;
// - prix, délais et chantiers seulement depuis data/seo/local-proof.json (règle 0.2) : blocs absents sans donnée ;
// - JSON-LD : Service fourni par #business sur ses distritos + fil d'Ariane, jamais FAQPage, LocalBusiness ni avis ;
// - la page est dans un seul sitemap avec un lastmod réel, et liée depuis /pt/servicos/, le plan du site, les hubs
//   et les pages métier x ville des métiers liés dans les distritos couverts.

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
import { DATA_LIGACOES_DISTRITO, DATA_LIGACOES_FACHADAS_TV, DATA_PAGINAS_AGUEDA, DATA_ZONA_DISTRITOS } from '@/lib/seo/pt-datas'
import { precosPara, prazoDistritoPara, dataIsoValida } from '@/lib/seo/pt-provas-locais'
import { chantiersExibidosDistrito, dataModificacaoDistrito, paginasConcelhoDistrito } from '@/lib/data/pt-servicos-distrito'
import { SERVICOS_CONCELHO } from '@/lib/data/pt-servicos-concelho'
import { dataLigacoesGrelhaConcelho } from '@/lib/sitemap-pt-pages'
import provas from '@/data/seo/local-proof.json'
import { classer, SERVICOS_DISTRITO_SLUGS } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const url = (s: { slug: string }) => `/pt/servicos/${s.slug}/`
// Villes de la grille dans la zone de la page : les 18 concelhos du distrito do Porto, Braga, Aveiro, Ovar et Águeda.
const CIDADES_ZONA = CITIES.filter((c) => LIMPEZA_DE_TELHADOS.distritos.includes(c.distrito)).map((c) => c.slug)

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
    // « Impermeabilização das telhas » : nom du propriétaire pour la hidrofugação (21/10/2026).
    expect(LIMPEZA_DE_TELHADOS.prestacoes.map((p) => p.titulo)).toEqual([
      'Lavagem e tratamento antimusgo',
      'Impermeabilização das telhas',
      'Pintura de telhas',
      'Caleiras e algerozes',
    ])
  })

  it('les textes ne contiennent ni prix, ni délai chiffré, ni pourcentage (règle 0.2) ; seules années citées : 2005 et 2007 (amianto)', () => {
    const textes = JSON.stringify(Object.fromEntries(Object.entries(LIMPEZA_DE_TELHADOS).filter(([k]) => !['dataModificacao', 'dataModificacaoLigacoes', 'dataLigacoes', 'dataLigacoesGrelha'].includes(k))))
    expect(textes).not.toMatch(/€|\beuros?\b|%/i)
    expect(textes).not.toMatch(/\b\d+\s*(h|horas?|dias?|semanas?|minutos?|anos?|m2|m²)\b/i)
    expect(textes.match(/\b(19|20)\d{2}\b/g)).toEqual(['2005', '2007'])
  })

  it('chaque lien des pages de district vise une page publiée (hub métier, autre page de district ou article du registre)', () => {
    for (const servico of SERVICOS_DISTRITO) {
      for (const l of servico.ligacoes) {
        const hub = /^\/pt\/perto-de-mim\/([^/]+)\/$/.exec(l.href)
        const distrito = /^\/pt\/servicos\/([^/]+)\/$/.exec(l.href)
        const artigo = /^\/pt\/blog\/([^/]+)\/$/.exec(l.href)
        if (hub) expect(SERVICES.some((s) => s.slug === hub[1]), l.href).toBe(true)
        else if (distrito) expect(SERVICOS_DISTRITO.some((s) => s.slug === distrito[1] && s.slug !== servico.slug), l.href).toBe(true)
        else if (artigo) expect(BLOG_ARTICLES.some((a) => a.slug === artigo[1]), l.href).toBe(true)
        else throw new Error(`lien inattendu : ${l.href}`)
      }
    }
  })

  it('limpeza de telhados lie les deux autres pages de district (accès difficile, fachada mouillée par les caleiras)', () => {
    const hrefs = LIMPEZA_DE_TELHADOS.ligacoes.map((l) => l.href)
    expect(hrefs).toContain('/pt/servicos/renovacao-de-fachadas/')
    expect(hrefs).toContain('/pt/servicos/trabalhos-verticais/')
  })

  it('prix, délais et chantiers fournis seulement s’ils sont valides (règle 0.2), quel que soit le contenu de local-proof.json', () => {
    for (const p of precosPara(LIMPEZA_DE_TELHADOS.slug)) expect(p.max > 0 && p.min >= 0 && Boolean(p.unite)).toBe(true)
    const prazo = prazoDistritoPara(LIMPEZA_DE_TELHADOS.distritos, LIMPEZA_DE_TELHADOS.slug)
    if (prazo) expect(prazo.visita_dias > 0 && Boolean(prazo.fonte)).toBe(true)
    for (const c of chantiersExibidosDistrito(LIMPEZA_DE_TELHADOS)) {
      expect(CIDADES_ZONA).toContain(c.cidade)
      expect(c.mes).toMatch(/^\d{4}-\d{2}$/)
    }
  })
})

describe('données saisies dans data/seo/local-proof.json', () => {
  const dados = provas as unknown as {
    chantiers?: Array<Record<string, string>>
    notas_concelho?: Array<Record<string, string>>
    revisoes_concelho?: Array<Record<string, string>>
  }
  const hoje = new Date().toISOString().slice(0, 10)
  const datas = (r: Record<string, string>) => ['publicado', 'atualizado', 'revisto'].map((k) => r[k]).filter((d): d is string => d !== undefined)

  it('dates réelles (AAAA-MM-JJ qui existe), jamais dans le futur ; mois du chantier au plus celui de sa publication', () => {
    for (const r of [...(dados.chantiers ?? []), ...(dados.notas_concelho ?? []), ...(dados.revisoes_concelho ?? [])]) {
      for (const d of datas(r)) {
        expect(dataIsoValida(d), d).toBe(true)
        expect(d <= hoje, d).toBe(true)
      }
      if (r.mes && r.publicado) expect(r.mes <= r.publicado.slice(0, 7), r.mes).toBe(true)
    }
  })

  it('chantiers : ville connue, freguesia non vide si donnée, photo toujours décrite, photo locale existante ou URL Supabase', () => {
    const villes = new Set(CITIES.map((c) => c.slug))
    for (const c of dados.chantiers ?? []) {
      expect(villes.has(c.cidade), c.cidade).toBe(true)
      if (c.freguesia !== undefined) expect(c.freguesia.trim().length).toBeGreaterThan(0)
      if (c.foto) {
        expect(c.foto_alt?.trim().length ?? 0, c.foto).toBeGreaterThan(0)
        const local = c.foto.startsWith('/') && existsSync(join(process.cwd(), 'public', c.foto))
        expect(local || /^https:\/\/[a-z0-9-]+\.supabase\.co\//.test(c.foto), c.foto).toBe(true)
      }
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
    expect(Boolean(c.querySelector('#prazos'))).toBe(Boolean(prazoDistritoPara(LIMPEZA_DE_TELHADOS.distritos, LIMPEZA_DE_TELHADOS.slug)))
    expect(Boolean(c.querySelector('#chantiers'))).toBe(chantiersExibidosDistrito(LIMPEZA_DE_TELHADOS).length > 0)
  })

  it('l’exclusion confirmée (fibrocimento) est dite dès l’introduction', async () => {
    const c = await htmlLimpeza()
    const intro = c.querySelector('h1')?.nextElementSibling?.textContent ?? ''
    expect(intro).toMatch(/Não limpamos telhados de fibrocimento/)
  })

  it('aucune liste de concelhos : hors chantiers réels, le siège et les trois distritos (« Porto, Braga e Aveiro », trois fois au plus)', async () => {
    const c = (await htmlLimpeza()).cloneNode(true) as HTMLElement
    c.querySelector('#chantiers')?.remove()
    c.querySelector('script')?.remove()
    const texte = c.textContent ?? ''
    // Porto, Braga et Aveiro sont aussi des concelhos de la grille : ils ne paraissent que dans la zone, dite d'un seul tenant.
    expect(texte.split('Porto, Braga e Aveiro').length - 1).toBeGreaterThanOrEqual(1)
    expect(texte.split('Porto, Braga e Aveiro').length - 1).toBeLessThanOrEqual(3)
    const horsZona = texte.split('Porto, Braga e Aveiro').join(' ')
    expect(CITIES.filter((city) => horsZona.includes(city.name)).map((city) => city.name)).toEqual(['Marco de Canaveses'])
    expect(texte).not.toMatch(/distrito do Porto/)
  })

  it('JSON-LD : Service fourni par #business sur les distritos do Porto, de Braga et de Aveiro, fil d’Ariane visible, rien d’interdit', async () => {
    const c = await htmlLimpeza()
    const graphe = jsonLd(c)['@graph']
    expect(graphe.map((n) => n['@type'])).toEqual(['Service', 'BreadcrumbList'])
    const service = graphe[0]
    expect(service.provider).toEqual({ '@id': ENTITE_PT.id })
    expect(service.areaServed).toEqual([
      { '@type': 'AdministrativeArea', name: 'Distrito do Porto' },
      { '@type': 'AdministrativeArea', name: 'Distrito de Braga' },
      { '@type': 'AdministrativeArea', name: 'Distrito de Aveiro' },
    ])
    expect(service.url).toBe(`${BASE}/pt/servicos/limpeza-de-telhados/`)
    expect(JSON.stringify(graphe)).not.toMatch(/FAQPage|HowTo|LocalBusiness|EmergencyService|AggregateRating|"Review"|Offer|PriceSpecification/)
    const fil = graphe[1] as { itemListElement: Array<{ item: string }> }
    const visibles = new Set(liens(c))
    for (const { item } of fil.itemListElement.slice(0, -1)) expect(visibles.has(item.replace(BASE, ''))).toBe(true)
  })

  it('FAQ « quanto custa » : fourchette réelle de local-proof.json et calcul pour 100 m² (aucun chiffre écrit dans les textes)', async () => {
    const c = await htmlLimpeza()
    const reponses = Array.from(c.querySelectorAll('#perguntas details')).map((d) => d.textContent ?? '')
    const precos = precosPara(LIMPEZA_DE_TELHADOS.slug)
    const m2 = precos.find((p) => /^m(2|²)$/.test(p.unite))
    // Le prix chiffré répond à la seule question qui porte sur la prestation chiffrée (limpeza com impermeabilização).
    expect(reponses.find((r) => r.startsWith('Quanto custa limpar um telhado?')) ?? '').not.toMatch(/€/)
    const custo = reponses.find((r) => r.startsWith('Quanto custa lavar e impermeabilizar')) ?? ''
    if (m2) {
      const n = (v: number) => v.toLocaleString('pt-PT')
      expect(custo).toContain(`de ${n(m2.min)} a ${n(m2.max)} € por ${m2.unite}`)
      expect(custo).toContain(`Exemplo para 100 m²`)
      expect(custo).toContain(`${n(m2.min * 100)} a ${n(m2.max * 100)} €, ${LIMPEZA_DE_TELHADOS.ressalvaPreco}`)
    } else expect(custo).not.toMatch(/€/)
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
      expect(groupes.servicos.find((u) => u.url === cible)?.lastModified).toBe(dataModificacaoDistrito(s))
      expect(s.dataModificacao).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    // Les pages qui reçoivent un lien portent la date de ce lien (Google : un changement de liens est significatif) ; une
    // page qui lie plusieurs pages de district prend la plus récente, une page qui ne lie que limpeza garde la sienne. Le
    // 28/10/2026, le titre des pages (texte des liens des hubs, de /pt/servicos/ et du plan) change avec la zone.
    const date = (chemin: string) => Object.values(groupes).flat().find((u) => u.url === `${BASE}${chemin}`)?.lastModified
    for (const chemin of ['/pt/perto-de-mim/telhador/', '/pt/servicos/', '/pt/perto-de-mim/impermeabilizacao/', '/pt/perto-de-mim/pintor/']) {
      expect(date(chemin), chemin).toBe(DATA_ZONA_DISTRITOS)
    }
    // Le plan du site lie aussi les pages de service d'Águeda : la plus récente des dates, jamais une date antérieure.
    expect(date('/pt/mapa-do-site/')! >= DATA_ZONA_DISTRITOS).toBe(true)
    expect(date('/pt/mapa-do-site/')! >= DATA_PAGINAS_AGUEDA).toBe(true)
    // Grille du distrito do Porto : lien et ancre inchangés le 28/10/2026, date d'ajout du lien gardée.
    expect(date('/pt/servicos/telhador-porto/')).toBe(dataLigacoesGrelhaConcelho('porto', ['limpeza-de-telhados']))
    expect(date('/pt/servicos/telhador-porto/')).toBe(DATA_LIGACOES_DISTRITO)
    expect(date('/pt/servicos/impermeabilizacao-baiao/')).toBe(dataLigacoesGrelhaConcelho('baiao', ['limpeza-de-telhados', 'renovacao-de-fachadas', 'trabalhos-verticais']))
    expect(date('/pt/servicos/impermeabilizacao-baiao/')).toBe(DATA_LIGACOES_FACHADAS_TV)
    // Grille des distritos de Braga et de Aveiro : liens ajoutés le 28/10/2026.
    for (const chemin of ['/pt/servicos/telhador-braga/', '/pt/servicos/pintor-braga/', '/pt/servicos/telhador-aveiro/', '/pt/servicos/pedreiro-ovar/']) {
      expect(date(chemin), chemin).toBe(DATA_ZONA_DISTRITOS)
    }
    for (const chemin of ['/pt/perto-de-mim/eletricista/', '/pt/servicos/canalizador-porto/', '/pt/servicos/canalizador-braga/']) {
      for (const d of [DATA_LIGACOES_DISTRITO, DATA_LIGACOES_FACHADAS_TV, DATA_ZONA_DISTRITOS]) expect(date(chemin), chemin).not.toBe(d)
    }
    // Plus les pages de service du concelho d'Águeda (lib/data/pt-servicos-concelho.ts), même fichier servicos.
    expect(getAllPtSitemapUrls(BASE)).toHaveLength(554 + SERVICOS_DISTRITO.length + paginasConcelhoDistrito().length + SERVICOS_CONCELHO.length)
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

  it('liée depuis les pages telhador et impermeabilização des trois distritos (Braga, Aveiro, Ovar, Águeda comprises), jamais depuis un autre métier', async () => {
    const lienVers = async (slug: string) => {
      const { container } = render(await ServiceCityPage({ params: Promise.resolve({ slug }) }))
      return liens(container).includes('/pt/servicos/limpeza-de-telhados/')
    }
    for (const slug of ['telhador-porto', 'impermeabilizacao-penafiel', 'telhador-braga', 'telhador-aveiro', 'impermeabilizacao-ovar', 'telhador-agueda']) {
      expect(await lienVers(slug), slug).toBe(true)
    }
    expect(await lienVers('canalizador-porto')).toBe(false)
    expect(await lienVers('canalizador-braga')).toBe(false)
    for (const distrito of ['Porto', 'Braga', 'Aveiro']) {
      expect(servicosDistritoLigados('telhador', distrito).map((s) => s.slug), distrito).toEqual(['limpeza-de-telhados'])
    }
    expect(servicosDistritoLigados('telhador', 'Lisboa')).toEqual([])
  })
})
