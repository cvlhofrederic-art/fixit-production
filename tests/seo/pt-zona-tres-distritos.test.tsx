// Zone des pages de district étendue le 28/10/2026 : le propriétaire confirme que l'équipe VITFIX (base Marco de Canaveses)
// intervient dans TOUS les concelhos des distritos do Porto, de Braga et de Aveiro pour la limpeza de telhados, la renovação
// de fachadas, les trabalhos verticais et le capoto neuf, avec une visite en 48 heures au maximum et les mêmes prix partout.
// Règles Google suivies (docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md, section 2) : une page par service
// pour toute la zone réelle, sans page par ville (doorway abuse) ni copie par lieu (scaled content abuse), zone dite en clair
// sans bloc de concelhos (keyword stuffing), areaServed avec les trois distritos, pages concelho seulement sur chantier réel.
// Garde-fous : modèle et données, titres et descriptions, HTML rendu, délai de 48 h, liens depuis Braga, Aveiro, Ovar et
// Águeda, et liste exacte des URL dont le lastmod passe à DATA_ZONA_DISTRITOS.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { Metadata } from 'next'
import type { JSX } from 'react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import LimpezaDeTelhadosPage, { metadata as metadataLimpeza } from '@/app/pt/servicos/limpeza-de-telhados/page'
import RenovacaoDeFachadasPage, { metadata as metadataFachadas } from '@/app/pt/servicos/renovacao-de-fachadas/page'
import TrabalhosVerticaisPage, { metadata as metadataTv } from '@/app/pt/servicos/trabalhos-verticais/page'
import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import CidadePage from '@/app/pt/cidade/[slug]/page'
import HubMetierPage from '@/app/pt/perto-de-mim/[slug]/page'
import ServicosHubPage from '@/app/pt/servicos/page'
import MapaDoSitePage from '@/app/pt/mapa-do-site/page'
import {
  DISTRITOS_EQUIPA, LIMPEZA_DE_TELHADOS, RENOVACAO_DE_FACHADAS, SERVICOS_DISTRITO, TRABALHOS_VERTICAIS, cobreDistrito, servicosDistritoLigados,
  type ServicoDistrito,
} from '@/lib/data/pt-servicos-distrito'
import { BLOG_ARTICLES, CITIES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX, dosDistritos, enumerar, nosDistritos, zonaDistritos } from '@/lib/seo/pt-meta'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { prazoDistritoPara, prazoPara } from '@/lib/seo/pt-provas-locais'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'
import { DATA_LIGACOES_DISTRITO, DATA_LIGACOES_FACHADAS_TV, DATA_ZONA_DISTRITOS } from '@/lib/seo/pt-datas'
import provas from '@/data/seo/local-proof.json'

const BASE = 'https://vitfix.io'
const ZONA = 'nos distritos do Porto, Braga e Aveiro'
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })
const caminho = (s: { slug: string }) => `/pt/servicos/${s.slug}/`
const liens = (c: HTMLElement) => Array.from(c.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
const PAGINAS: Array<{ servico: ServicoDistrito; Pagina: () => JSX.Element; metadata: Metadata }> = [
  { servico: LIMPEZA_DE_TELHADOS, Pagina: LimpezaDeTelhadosPage, metadata: metadataLimpeza },
  { servico: RENOVACAO_DE_FACHADAS, Pagina: RenovacaoDeFachadasPage, metadata: metadataFachadas },
  { servico: TRABALHOS_VERTICAIS, Pagina: TrabalhosVerticaisPage, metadata: metadataTv },
]
/** Villes de la grille des distritos de Braga et de Aveiro. */
const NOVAS = ['braga', 'aveiro', 'ovar', 'agueda']

/** Texte visible d'une page (sans JSON-LD), espaces normalisés. */
function texteVisible(c: HTMLElement): string {
  const copia = c.cloneNode(true) as HTMLElement
  copia.querySelectorAll('script').forEach((s) => s.remove())
  return (copia.textContent ?? '').replace(/\s+/g, ' ')
}

/** Suites d'au moins trois noms de concelhos de la grille séparés par des virgules ou « e » : un bloc de villes. */
function listasDeConcelhos(texte: string): string[] {
  const nomes = CITIES.map((c) => c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length).join('|')
  const motif = new RegExp(`(?:${nomes})(?:(?:, | e )(?:${nomes})){2,}`, 'g')
  return texte.match(motif) ?? []
}

describe('modèle : trois distritos, une seule zone', () => {
  it('les trois pages de district couvrent les distritos do Porto, de Braga et de Aveiro, sans changer d’URL', () => {
    expect(DISTRITOS_EQUIPA).toEqual(['Porto', 'Braga', 'Aveiro'])
    expect(SERVICOS_DISTRITO.map(caminho)).toEqual(['/pt/servicos/limpeza-de-telhados/', '/pt/servicos/renovacao-de-fachadas/', '/pt/servicos/trabalhos-verticais/'])
    for (const s of SERVICOS_DISTRITO) {
      expect(s.distritos, s.slug).toEqual(DISTRITOS_EQUIPA)
      expect(Object.keys(s.dataLigacoesGrelha).sort(), s.slug).toEqual([...s.distritos].sort())
      for (const d of ['Porto', 'Braga', 'Aveiro']) expect(cobreDistrito(s, d), `${s.slug} ${d}`).toBe(true)
      expect(cobreDistrito(s, 'Lisboa'), s.slug).toBe(false)
    }
    // Les 22 villes de la grille sont dans la zone : 18 concelhos du distrito do Porto, Braga, Aveiro, Ovar et Águeda.
    expect(CITIES.filter((c) => DISTRITOS_EQUIPA.includes(c.distrito))).toHaveLength(22)
  })

  it('zone dite en clair : formes pt-PT, distritos seulement', () => {
    expect(zonaDistritos(DISTRITOS_EQUIPA)).toBe('distritos do Porto, Braga e Aveiro')
    expect(nosDistritos(DISTRITOS_EQUIPA)).toBe(ZONA)
    expect(dosDistritos(DISTRITOS_EQUIPA)).toBe('dos distritos do Porto, Braga e Aveiro')
    expect(enumerar(DISTRITOS_EQUIPA)).toBe('Porto, Braga e Aveiro')
    expect(zonaDistritos(['Porto'])).toBe('distrito do Porto')
    expect(nosDistritos(['Braga'])).toBe('no distrito de Braga')
    expect(enumerar(['Porto', 'Braga'])).toBe('Porto e Braga')
  })

  it('titre, H1 et résumé nomment la zone ; plus aucun « distrito do Porto » dans les textes des pages', () => {
    for (const s of SERVICOS_DISTRITO) {
      expect(s.titulo, s.slug).toMatch(/: Porto, Braga e Aveiro$/)
      // Titre sans la zone : texte des liens sous un intertitre ou une phrase qui dit déjà la zone.
      expect(s.titulo, s.slug).toBe(`${s.tituloSemZona}: ${enumerar(s.distritos)}`)
      expect(s.tituloSemZona, s.slug).not.toMatch(/Porto|Braga|Aveiro|distrito/)
      expect(s.h1, s.slug).toContain(ZONA)
      expect(s.resumo, s.slug).toContain(`${ZONA}.`)
      expect(s.intro, s.slug).toContain('todos os concelhos destes três distritos')
      const textes = JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !k.startsWith('data'))))
      expect(textes, s.slug).not.toMatch(/distrito do Porto|todo o distrito/i)
      expect(listasDeConcelhos(textes.replaceAll('Porto, Braga e Aveiro', '')), s.slug).toEqual([])
    }
  })
})

describe.each(PAGINAS)('$servico.slug : titre, description, HTML rendu', ({ servico, Pagina, metadata }) => {
  it('titre sans marque, service en tête, 65 caractères au plus avec « | VITFIX » ; description 120-155 avec la zone et le numéro', () => {
    const titre = String(metadata.title)
    expect(titre).toBe(servico.titulo)
    expect(titre).not.toMatch(/vitfix/i)
    expect(titre.length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    // Le service d'abord, la zone ensuite (« Limpeza de telhados e caleiras: Porto, Braga e Aveiro »).
    expect(titre.endsWith(': Porto, Braga e Aveiro')).toBe(true)
    expect(titre.split(':')[0].length).toBeGreaterThanOrEqual(25)
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d).toContain(ZONA)
    expect(d).toContain(TELEFONE_PT_TEXTE)
  })

  it('HTML : un seul H1 avec la zone, section « Onde trabalhamos » (tous les concelhos, 48 h, même prix), appel final sans lieu répété', () => {
    const c = render(Pagina()).container
    const h1 = c.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(servico.h1)
    expect(h1[0].textContent).toContain(ZONA)
    const zona = (c.querySelector('#zona')?.textContent ?? '').replace(/\s+/g, ' ')
    expect(zona).toContain('Onde trabalhamos')
    expect(zona).toContain('A equipa parte de Marco de Canaveses e trabalha em todos os concelhos dos distritos do Porto, Braga e Aveiro, com visita em 48 horas, no máximo, em qualquer um deles.')
    expect(zona).toContain('O preço não depende do concelho.')
    const texte = texteVisible(c)
    expect(texte).toContain('Grátis e sem compromisso, em qualquer concelho onde trabalhamos.')
    expect(texte).toContain(`${servico.nome} · Porto, Braga e Aveiro`)
    expect(texte).not.toMatch(/distrito do Porto|todo o distrito/)
    expect(listasDeConcelhos(texte.replaceAll('Porto, Braga e Aveiro', ''))).toEqual([])
    expect(c.querySelector('#prazos')?.textContent).toContain('Visita em 48 horas, no máximo.')
  })

  it('JSON-LD : areaServed = les trois distritos (AdministrativeArea), description = celle de la page', () => {
    const c = render(Pagina()).container
    const graphe = JSON.parse(c.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@graph'] as Array<Record<string, unknown>>
    expect(graphe[0].areaServed).toEqual([
      { '@type': 'AdministrativeArea', name: 'Distrito do Porto' },
      { '@type': 'AdministrativeArea', name: 'Distrito de Braga' },
      { '@type': 'AdministrativeArea', name: 'Distrito de Aveiro' },
    ])
    expect(graphe[0].description).toBe(metadata.description)
  })
})

describe('délai de visite : une entrée de zone pour les trois distritos et les quatre services', () => {
  type Prazo = { cidade?: string; distritos?: string[]; metiers?: string[]; visita_horas_max?: number }
  const prazos = (provas as unknown as { prazos: Prazo[] }).prazos

  it('48 heures au plus pour limpeza de telhados, fachadas, trabalhos verticais et capoto, dans les trois distritos', () => {
    for (const metier of [...SERVICOS_DISTRITO.map((s) => s.slug), 'capoto']) {
      expect(prazoDistritoPara(DISTRITOS_EQUIPA, metier)?.visita_horas_max, metier).toBe(48)
      for (const d of DISTRITOS_EQUIPA) expect(prazoDistritoPara([d], metier)?.visita_horas_max, `${metier} ${d}`).toBe(48)
    }
    // Une page dont un distrito n'est pas couvert par l'entrée n'affiche aucun délai.
    expect(prazoDistritoPara(['Porto', 'Lisboa'], LIMPEZA_DE_TELHADOS.slug)).toBeNull()
    expect(prazoDistritoPara([], LIMPEZA_DE_TELHADOS.slug)).toBeNull()
    expect(prazoDistritoPara(DISTRITOS_EQUIPA, 'eletricista')).toBeNull()
  })

  it('aucune donnée dupliquée : une seule entrée de zone, plus de clé « distrito-porto », rien sur la grille', () => {
    expect(prazos.filter((p) => p.distritos)).toHaveLength(1)
    expect(prazos.some((p) => p.cidade?.startsWith('distrito-'))).toBe(false)
    // L'entrée de zone n'est lue par aucune page métier x ville (clé cidade absente).
    for (const city of CITIES) expect(prazoPara(city.slug, 'isolamento-termico'), city.slug).toBeNull()
  })
})

describe('liens depuis les villes des distritos de Braga et de Aveiro', () => {
  const publiees = new Set(getAllPtSitemapUrls(BASE).map((u) => u.url))

  it.each(NOVAS)('page ville %s : cartes des trois pages de district, au nom du distrito de la ville, vers des URL publiées', async (slug) => {
    const city = CITIES.find((c) => c.slug === slug)!
    const c = render(await CidadePage(params(slug))).container
    const texte = texteVisible(c)
    for (const s of SERVICOS_DISTRITO) {
      expect(liens(c), s.slug).toContain(caminho(s))
      expect(texte, s.slug).toContain(`${s.nome} no distrito ${city.distrito === 'Porto' ? 'do Porto' : `de ${city.distrito}`}`)
    }
    for (const h of liens(c).filter((x) => x.startsWith('/pt/servicos/'))) expect(publiees.has(`${BASE}${h.split('#')[0]}`), h).toBe(true)
  })

  it.each(NOVAS)('grille de %s : chaque métier lié lie ses pages de district, les autres non', async (slug) => {
    const city = CITIES.find((c) => c.slug === slug)!
    for (const combo of getAllPageCombos().filter((x) => x.city.slug === slug)) {
      const attendus = servicosDistritoLigados(combo.service.slug, city.distrito).map(caminho)
      const presents = liens(render(await ServiceCityPage(params(combo.slug))).container).filter((h) => SERVICOS_DISTRITO.some((s) => h === caminho(s)))
      expect([...new Set(presents)].sort(), combo.slug).toEqual([...attendus].sort())
    }
  })

  it('ancres de la grille : nom du service et distrito de la ville (Braga, Aveiro) ; Porto inchangé', async () => {
    const texte = async (slug: string) => texteVisible(render(await ServiceCityPage(params(slug))).container)
    expect(await texte('telhador-braga')).toContain('Limpeza de telhados no distrito de Braga')
    expect(await texte('pintor-aveiro')).toContain('Renovação de fachadas no distrito de Aveiro')
    expect(await texte('pintor-ovar')).toContain('Trabalhos verticais no distrito de Aveiro')
    expect(await texte('impermeabilizacao-agueda')).toContain('Limpeza de telhados no distrito de Aveiro')
    expect(await texte('telhador-porto')).toContain('Limpeza de telhados no distrito do Porto')
  })

  it('/pt/servicos/, plan du site et hubs : zone dite une seule fois par bloc de liens, ancres au nom du service', async () => {
    // Relecture du 28/10/2026 (keyword stuffing ; guide § 4.5 et § 5.2, ancres sans répétition) : l'intertitre ou la phrase
    // dit la zone, les liens ne répètent pas « Porto, Braga e Aveiro ».
    const vers = (c: HTMLElement) => Array.from(c.querySelectorAll('a')).filter((a) => SERVICOS_DISTRITO.some((s) => a.getAttribute('href') === caminho(s)))
    const ancres = (c: HTMLElement) => vers(c).map((a) => (a.textContent ?? '').replace(/\s+/g, ' ').trim())
    /** Bloc des liens de district : les cartes et l'intertitre ou la phrase qui les précède. */
    const bloco = (c: HTMLElement) => texteVisible(vers(c)[0].parentElement!.parentElement!)
    const vezes = (texte: string) => texte.split('Porto, Braga e Aveiro').length - 1

    const index = render(ServicosHubPage()).container
    expect(texteVisible(index)).not.toMatch(/distrito do Porto/)
    expect(bloco(index)).toContain('Serviços da equipa VITFIX nos distritos do Porto, Braga e Aveiro')
    expect(vezes(bloco(index))).toBe(1)
    expect(ancres(index)).toEqual(SERVICOS_DISTRITO.map((s) => `${s.icon}${s.tituloSemZona}`))

    const plano = render(MapaDoSitePage()).container
    expect(ancres(plano)).toEqual(SERVICOS_DISTRITO.map((s) => s.tituloSemZona))
    expect(texteVisible(plano)).not.toMatch(/no distrito do Porto|Porto, Braga e Aveiro/)

    const metiers = [...new Set(SERVICOS_DISTRITO.flatMap((s) => s.metiersLigados))]
    for (const metier of metiers) {
      const ligadas = servicosDistritoLigados(metier)
      const hub = render(await HubMetierPage(params(metier))).container
      expect(vezes(bloco(hub)), metier).toBe(1)
      if (ligadas.length === 1) {
        // Une seule page liée : phrase propre au service, lien au titre de la page (la zone n'y est dite qu'une fois).
        expect(bloco(hub), metier).toContain(ligadas[0].chamadaHub)
        expect(ancres(hub), metier).toEqual([`${ligadas[0].icon}${ligadas[0].titulo}`])
      } else {
        expect(bloco(hub), metier).toContain('Serviços da própria equipa VITFIX nos distritos do Porto, Braga e Aveiro:')
        expect(ancres(hub), metier).toEqual(ligadas.map((s) => `${s.icon}${s.tituloSemZona}`))
      }
      // « Trabalhos feitos » pouvait se lire comme des chantiers déjà faits à Braga et à Aveiro (aucun n'est documenté).
      expect(texteVisible(hub), metier).not.toContain('Trabalhos feitos pela equipa VITFIX')
    }
    // Hubs qui lient plusieurs pages de district : impermeabilizacao (3) et pintor (2).
    expect(metiers.filter((m) => servicosDistritoLigados(m).length > 1).sort()).toEqual(['impermeabilizacao', 'pintor'])
  })
})

describe('dates : DATA_ZONA_DISTRITOS sur les seules pages dont le texte ou les liens changent', () => {
  const urls = getAllPtSitemapUrls(BASE)
  const date = (chemin: string) => urls.find((u) => u.url === `${BASE}${chemin}`)?.lastModified

  it('liste exacte des URL datées du jour de la zone (dont celles du prix du capoto, mis en production le même jour)', () => {
    const metiers = ['telhador', 'impermeabilizacao', 'pintor', 'pedreiro', 'isolamento-termico', 'limpeza-condominio']
    const attendues = [
      ...SERVICOS_DISTRITO.map(caminho),
      ...CITIES.map((c) => `/pt/cidade/${c.slug}/`),
      ...metiers.map((m) => `/pt/perto-de-mim/${m}/`),
      '/pt/servicos/', '/pt/mapa-do-site/', '/pt/precos/pintor/',
      // Grille des distritos de Braga et de Aveiro : liens ajoutés vers les pages de district.
      ...NOVAS.flatMap((v) => metiers.map((m) => `/pt/servicos/${m}-${v}/`)),
      // isolamento-termico du distrito do Porto : zone de la réponse « Quanto custa aplicar capoto por m²? ».
      ...CITIES.filter((c) => c.distrito === 'Porto').map((c) => `/pt/servicos/isolamento-termico-${c.slug}/`),
      '/pt/blog/capoto-isolamento-termico-quanto-custa/', '/pt/blog/humidade-parede-causas-reparacao/',
    ].sort((a, b) => a.localeCompare(b))
    expect(attendues).toHaveLength(78)
    const datadas = urls.filter((u) => u.lastModified === DATA_ZONA_DISTRITOS).map((u) => u.url.replace(BASE, '')).sort((a, b) => a.localeCompare(b))
    expect(datadas).toEqual(attendues)
    for (const slug of ['capoto-isolamento-termico-quanto-custa', 'humidade-parede-causas-reparacao']) {
      expect(BLOG_ARTICLES.find((a) => a.slug === slug)?.dateModified, slug).toBe(DATA_ZONA_DISTRITOS)
    }
  })

  it('grille du distrito do Porto : date des liens d’origine gardée (lien et ancre inchangés)', () => {
    for (const city of CITIES.filter((c) => c.distrito === 'Porto')) {
      expect(date(`/pt/servicos/telhador-${city.slug}/`), city.slug).toBe(DATA_LIGACOES_DISTRITO)
      for (const m of ['impermeabilizacao', 'pintor', 'pedreiro', 'limpeza-condominio']) expect(date(`/pt/servicos/${m}-${city.slug}/`), `${m}-${city.slug}`).toBe(DATA_LIGACOES_FACHADAS_TV)
    }
  })

  it('constante documentée, date réelle (AAAA-MM-JJ), à aligner sur le jour de la mise en production', () => {
    expect(DATA_ZONA_DISTRITOS).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(DATA_ZONA_DISTRITOS >= DATA_LIGACOES_FACHADAS_TV).toBe(true)
    for (const s of SERVICOS_DISTRITO) {
      expect(s.dataModificacao, s.slug).toBe(DATA_ZONA_DISTRITOS)
      expect(s.dataLigacoes, s.slug).toBe(DATA_ZONA_DISTRITOS)
      expect(s.dataLigacoesGrelha.Braga, s.slug).toBe(DATA_ZONA_DISTRITOS)
      expect(s.dataLigacoesGrelha.Aveiro, s.slug).toBe(DATA_ZONA_DISTRITOS)
    }
  })
})
