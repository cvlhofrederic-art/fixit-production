// Pages de service du concelho d'Águeda (lib/data/pt-servicos-concelho.ts, demande du propriétaire du 21/10/2026 :
// limpeza de terrenos e desmatação, terraplanagem e desaterro ; zone desservie = tout le concelho, équipe VITFIX,
// aucun prix publié). Garde-fous tirés du guide docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md :
// - une page par service pour la zone desservie, jamais une page par freguesia (doorway) ; chaque freguesia citée
//   une seule fois, dans un groupe qui dit ce qui change pour le travail (pas de liste de villes : keyword stuffing) ;
// - aucun prix dans les textes de service (règle 0.2) : fourchette seulement depuis data/seo/local-proof.json ;
// - JSON-LD : Service fourni par #business dans le concelho + fil d'Ariane, jamais FAQPage, LocalBusiness ni avis ;
// - la page est dans un seul sitemap avec un lastmod réel, et liée depuis la page ville et les pages métier x ville
//   des métiers liés, dans le même concelho seulement.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Metadata } from 'next'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import LimpezaPage, { metadata as metadataLimpeza } from '@/app/pt/servicos/limpeza-de-terrenos-agueda/page'
import TerraplanagemPage, { metadata as metadataTerraplanagem } from '@/app/pt/servicos/terraplanagem-agueda/page'
import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import CityPage from '@/app/pt/cidade/[slug]/page'
import {
  LIMPEZA_DE_TERRENOS_AGUEDA,
  SERVICOS_CONCELHO,
  TERRAPLANAGEM_AGUEDA,
  servicosConcelhoLigados,
} from '@/lib/data/pt-servicos-concelho'
import { BLOG_ARTICLES, CITIES, SERVICES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX } from '@/lib/seo/pt-meta'
import { ENTITE_PT, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DATA_PAGINAS_AGUEDA } from '@/lib/seo/pt-datas'
import { classer, SERVICOS_CONCELHO_CIDADES } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const PAGINAS = [
  { servico: LIMPEZA_DE_TERRENOS_AGUEDA, pagina: LimpezaPage, metadata: metadataLimpeza as Metadata },
  { servico: TERRAPLANAGEM_AGUEDA, pagina: TerraplanagemPage, metadata: metadataTerraplanagem as Metadata },
]

function jsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]')
  expect(script).not.toBeNull()
  return JSON.parse(script?.textContent ?? '{}') as { '@graph': Array<Record<string, unknown>> }
}

const liens = (container: HTMLElement) => Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')

/** Textes de service : tout sauf les règles légales et la FAQ (qui citent des coimas en euros). */
function textesService(s: (typeof SERVICOS_CONCELHO)[number]) {
  return JSON.stringify([s.titulo, s.h1, s.resumo, s.intro, s.servicos, s.equipamento, s.naoFazemos, s.metodo, s.preco, s.zona.intro, s.zona.grupos, s.ligacoes, s.mensagemWhatsapp, s.ctaFinal, s.quemFaz])
}

describe('données des pages de concelho', () => {
  it('chaque slug est unique, a sa route statique, est absent de la grille et connu de l’outillage d’audit', () => {
    const slugs = SERVICOS_CONCELHO.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    expect(SERVICOS_CONCELHO_CIDADES).toEqual(Object.fromEntries(SERVICOS_CONCELHO.map((s) => [s.slug, s.cidade])))
    for (const s of SERVICOS_CONCELHO) {
      // Sans dossier app/pt/servicos/{slug}/, la route [slug] répondrait 404 à une URL déclarée dans le sitemap.
      expect(existsSync(join(process.cwd(), 'app', 'pt', 'servicos', s.slug, 'page.tsx')), s.slug).toBe(true)
      expect(getAllPageCombos().some((c) => c.slug === s.slug), s.slug).toBe(false)
      expect(CITIES.some((c) => c.slug === s.cidade), s.cidade).toBe(true)
      expect(classer(`/pt/servicos/${s.slug}/`)).toEqual({ groupe: 'servicos-concelho', metier: s.slug, ville: s.cidade })
      for (const m of s.metiersLigados) expect(SERVICES.some((x) => x.slug === m), m).toBe(true)
      expect(s.dataModificacao).toBe(DATA_PAGINAS_AGUEDA)
    }
  })

  it('aucun prix ni pourcentage dans les textes de service (règle 0.2 : le propriétaire ne publie pas de prix)', () => {
    for (const s of SERVICOS_CONCELHO) {
      expect(textesService(s), s.slug).not.toMatch(/€|\beuros?\b|%|\d\s*\/\s*m[²23]/i)
      expect(s.titulo, s.slug).not.toMatch(/preço|barato|24 ?h|urgente/i)
    }
  })

  it('chaque freguesia du concelho (CityData.freguesias) apparaît une fois et une seule dans les groupes de lieux de chaque page', () => {
    for (const s of SERVICOS_CONCELHO) {
      const citees = s.zona.grupos.flatMap((g) => g.freguesias)
      const officielles = CITIES.find((c) => c.slug === s.cidade)?.freguesias ?? []
      expect(officielles.length).toBe(15)
      expect([...citees].sort(), s.slug).toEqual([...officielles].sort())
      for (const g of s.zona.grupos) expect(g.texto.length, g.titulo).toBeGreaterThan(120)
    }
  })

  it('les règles et les lieux sont datés et sourcés par des sites officiels', () => {
    const officiel = /^https:\/\/(\S+\.)?(gov\.pt|diariodarepublica\.pt|pgdlisboa\.pt|cm-agueda\.pt|icnf\.pt|apambiente\.pt|e-redes\.pt|gnr\.pt)\//
    for (const s of SERVICOS_CONCELHO) {
      expect(s.regras.verificadoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(s.regras.fontes.length).toBeGreaterThan(0)
      expect(s.zona.fontes.length).toBeGreaterThan(0)
      for (const f of [...s.regras.fontes, ...s.zona.fontes]) expect(f.url, f.nome).toMatch(officiel)
    }
    const poda = CITIES.find((c) => c.slug === 'agueda')?.serviceCityOverrides?.['poda-arvores']
    expect(poda?.fontes?.length).toBeGreaterThan(0)
    for (const f of poda?.fontes ?? []) expect(f.url, f.nome).toMatch(officiel)
  })

  it('chaque lien de la page vise une page publiée (grille, page de concelho, page ville ou article)', () => {
    const publiees = new Set([
      ...getAllPageCombos().map((c) => `/pt/servicos/${c.slug}/`),
      ...SERVICOS_CONCELHO.map((s) => `/pt/servicos/${s.slug}/`),
      ...CITIES.map((c) => `/pt/cidade/${c.slug}/`),
      ...BLOG_ARTICLES.map((a) => `/pt/blog/${a.slug}/`),
    ])
    for (const s of SERVICOS_CONCELHO) {
      for (const l of s.ligacoes) {
        expect(publiees.has(l.href), l.href).toBe(true)
        expect(l.href, 'pas de lien vers soi-même').not.toBe(`/pt/servicos/${s.slug}/`)
      }
    }
  })
})

describe.each(PAGINAS)('/pt/servicos/$servico.slug/', ({ servico, pagina, metadata }) => {
  it('titre sans marque, 65 caractères au plus marque comprise ; canonical seule ; Open Graph pt_PT', () => {
    expect(metadata.title).toBe(servico.titulo)
    expect(String(metadata.title)).not.toMatch(/vitfix/i)
    expect(String(metadata.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    expect(metadata.alternates).toEqual({ canonical: `${BASE}/pt/servicos/${servico.slug}/` })
    expect(metadata.openGraph).toMatchObject({ locale: 'pt_PT', siteName: 'VITFIX', title: metadata.title })
  })

  it('description de 120 à 155 caractères, avec Águeda et le numéro portugais, sans « 24h »', () => {
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d).toContain('Águeda')
    expect(d).toContain(TELEFONE_PT_TEXTE)
    expect(d).not.toMatch(/24 ?h|24\/7|urg[êe]nc/i)
  })

  it('un seul h1 ; FAQ visible en h3 (pas d’accordéon fermé) ; contact téléphone et WhatsApp', () => {
    const { container } = render(pagina())
    const h1 = container.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(servico.h1)
    const h3 = Array.from(container.querySelectorAll('#perguntas h3')).map((h) => h.textContent)
    expect(h3).toEqual(servico.faqs.map((f) => f.pergunta))
    expect(container.querySelector('#perguntas details')).toBeNull()
    expect(liens(container)).toContain(`tel:${ENTITE_PT.telephone}`)
    expect(liens(container).some((h) => h.startsWith('https://wa.me/351'))).toBe(true)
    expect(container.textContent).toContain('equipa VITFIX')
  })

  it('sans donnée dans local-proof.json : ni chantiers, ni fourchette de prix, ni délai affichés', () => {
    const { container } = render(pagina())
    expect(container.querySelector('#chantiers')).toBeNull()
    expect(container.querySelector('#precos')).toBeNull()
    expect(container.textContent).not.toMatch(/Primeira visita em/)
  })

  it('JSON-LD : Service fourni par #business, servi dans Águeda, et fil d’Ariane ; rien d’interdit', () => {
    const { container } = render(pagina())
    const grafo = jsonLd(container)['@graph']
    const tipos = grafo.map((n) => n['@type'])
    expect(tipos).toEqual(['Service', 'BreadcrumbList'])
    const service = grafo[0]
    expect(service.provider).toEqual({ '@id': ENTITE_PT.id })
    expect(service.areaServed).toMatchObject({ '@type': 'City', name: 'Águeda' })
    expect(service.url).toBe(`${BASE}/pt/servicos/${servico.slug}/`)
    expect(JSON.stringify(grafo)).not.toMatch(/FAQPage|HowTo|LocalBusiness|AggregateRating|"Review"|"Offer"/)
    const fil = grafo[1].itemListElement as Array<{ name: string; item: string }>
    expect(fil.map((i) => i.item)).toEqual([`${BASE}/pt/`, `${BASE}/pt/servicos/`, `${BASE}/pt/servicos/${servico.slug}/`])
  })

  it('les sources officielles sont des liens externes ; les liens internes sont ceux des données', () => {
    const { container } = render(pagina())
    const hrefs = liens(container)
    for (const f of [...servico.regras.fontes, ...servico.zona.fontes]) expect(hrefs).toContain(f.url)
    for (const l of servico.ligacoes) expect(hrefs).toContain(l.href)
    expect(hrefs).toContain(`/pt/cidade/${servico.cidade}/`)
  })
})

describe('sitemap et liens entrants', () => {
  it('chaque page de concelho est dans le fichier servicos avec sa date ; la page ville et les 21 pages métier du concelho en prennent la date', () => {
    const { servicos, cidades } = sitemapsPt(BASE)
    for (const s of SERVICOS_CONCELHO) {
      const entrees = Object.values(sitemapsPt(BASE)).flat().filter((u) => u.url === `${BASE}/pt/servicos/${s.slug}/`)
      expect(entrees).toHaveLength(1)
      expect(servicos.find((u) => u.url === `${BASE}/pt/servicos/${s.slug}/`)?.lastModified).toBe(s.dataModificacao)
      for (const m of SERVICES) {
        expect(servicos.find((u) => u.url === `${BASE}/pt/servicos/${m.slug}-${s.cidade}/`)?.lastModified, m.slug).toBe(DATA_PAGINAS_AGUEDA)
      }
      expect(cidades.find((u) => u.url === `${BASE}/pt/cidade/${s.cidade}/`)?.lastModified).toBe(DATA_PAGINAS_AGUEDA)
    }
  })

  it('servicosConcelhoLigados : seulement le même concelho et un métier lié', () => {
    expect(servicosConcelhoLigados('jardineiro', 'agueda').map((s) => s.slug)).toContain('limpeza-de-terrenos-agueda')
    expect(servicosConcelhoLigados('jardineiro', 'aveiro')).toEqual([])
    expect(servicosConcelhoLigados('eletricista', 'agueda')).toEqual([])
  })

  it('les pages métier x ville liées d’Águeda lient la page ; la même page dans une autre ville ne la lie pas', async () => {
    for (const s of SERVICOS_CONCELHO) {
      for (const m of s.metiersLigados) {
        const { container } = render(await ServiceCityPage({ params: Promise.resolve({ slug: `${m}-${s.cidade}` }) }))
        expect(liens(container), `${m}-${s.cidade}`).toContain(`/pt/servicos/${s.slug}/`)
      }
      const { container } = render(await ServiceCityPage({ params: Promise.resolve({ slug: `${s.metiersLigados[0]}-aveiro` }) }))
      expect(liens(container)).not.toContain(`/pt/servicos/${s.slug}/`)
    }
  })

  it('la page ville d’Águeda lie les deux pages ; celle d’Aveiro non', async () => {
    const agueda = render(await CityPage({ params: Promise.resolve({ slug: 'agueda' }) })).container
    for (const s of SERVICOS_CONCELHO) expect(liens(agueda)).toContain(`/pt/servicos/${s.slug}/`)
    const aveiro = render(await CityPage({ params: Promise.resolve({ slug: 'aveiro' }) })).container
    for (const s of SERVICOS_CONCELHO) expect(liens(aveiro)).not.toContain(`/pt/servicos/${s.slug}/`)
  })
})

describe('poda e abate de árvores em Águeda : contenu local', () => {
  it('la page rend les sections locales (#local) avec leurs titres, et pas les autres villes', async () => {
    const agueda = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-agueda' }) })).container
    const secoes = CITIES.find((c) => c.slug === 'agueda')?.serviceCityOverrides?.['poda-arvores']?.secoes ?? []
    expect(secoes.length).toBeGreaterThan(0)
    const h2 = Array.from(agueda.querySelectorAll('#local h2')).map((h) => h.textContent)
    expect(h2).toEqual(secoes.map((s) => s.titulo))
    const aveiro = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-aveiro' }) })).container
    expect(aveiro.querySelector('#local')).toBeNull()
  })

  it('les réponses propres à Águeda remplacent celles du métier, et seulement à Águeda ; les sources sont rendues', async () => {
    const poda = CITIES.find((c) => c.slug === 'agueda')?.serviceCityOverrides?.['poda-arvores']
    const respostas = Object.entries(poda?.respostas ?? {})
    expect(respostas.length).toBeGreaterThan(0)
    const metier = SERVICES.find((s) => s.slug === 'poda-arvores')
    const agueda = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-agueda' }) })).container
    const aveiro = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-aveiro' }) })).container
    for (const [pergunta, resposta] of respostas) {
      expect(metier?.faqs.some((f) => f.question === pergunta), pergunta).toBe(true)
      expect(agueda.textContent).toContain(resposta)
      expect(aveiro.textContent).not.toContain(resposta)
    }
    for (const f of poda?.fontes ?? []) expect(liens(agueda)).toContain(f.url)
  })
})

describe('hubs métier : la question « Quanto custa… » affiche la réponse de prix du métier', () => {
  it('poda-arvores et faz-tudo, dont la première FAQ ne porte pas sur le prix', async () => {
    const { default: HubMetierPage } = await import('@/app/pt/perto-de-mim/[slug]/page')
    for (const slug of ['poda-arvores', 'faz-tudo']) {
      const metier = SERVICES.find((s) => s.slug === slug)
      const prix = metier?.faqs.find((f) => /quanto custa/i.test(f.question))
      expect(prix, slug).toBeDefined()
      expect(metier?.faqs[0].question, slug).not.toMatch(/quanto custa/i)
      const { container } = render(await HubMetierPage({ params: Promise.resolve({ slug }) }))
      const bloc = Array.from(container.querySelectorAll('details')).find((d) => /Quanto custa um/.test(d.querySelector('summary')?.textContent ?? ''))
      expect(bloc?.textContent, slug).toContain((prix?.answer ?? '').replace(/\{city\}/g, 'Portugal'))
      expect(bloc?.textContent, slug).not.toContain(metier?.faqs[0].answer.slice(0, 60))
    }
  })
})

describe('poda-arvores-agueda : travail de l’équipe VITFIX, avec le numéro (décision du propriétaire du 22/10/2026)', () => {
  it('« Equipa VITFIX » et boutons WhatsApp + téléphone, sans « profissionais verificados » ni lien vers /pt/pesquisar/ ; les autres villes ne changent pas', async () => {
    const agueda = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-agueda' }) })).container
    expect(agueda.textContent).toContain('Equipa VITFIX')
    expect(agueda.textContent).not.toMatch(/profissionais verificados/i)
    expect(liens(agueda)).not.toContain('/pt/pesquisar/')
    expect(agueda.textContent).toContain(TELEFONE_PT_TEXTE)
    // Boutons de l'en-tête et du bas de page (BotoesContacto), plus ceux du bloc d'urgence.
    expect(liens(agueda).filter((h) => h === `tel:${ENTITE_PT.telephone}`).length).toBeGreaterThanOrEqual(2)
    expect(liens(agueda).filter((h) => h.startsWith('https://wa.me/351')).length).toBeGreaterThanOrEqual(2)

    for (const slug of ['poda-arvores-aveiro', 'jardineiro-agueda']) {
      const outra = render(await ServiceCityPage({ params: Promise.resolve({ slug }) })).container
      expect(outra.textContent, slug).toMatch(/Profissionais verificados/)
      expect(liens(outra), slug).toContain('/pt/pesquisar/')
    }
  })
})

describe('poda-arvores-agueda : prestations confirmées seulement ; plan du site', () => {
  it('la liste de prestations d’Águeda remplace celle du métier, sans « plataforma », « fitossanitário » ni « relatório técnico » ; Aveiro garde la liste du métier', async () => {
    const agueda = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-agueda' }) })).container
    expect(agueda.textContent).toContain('Abate por partes com acesso por corda (IRATA), sem grua')
    expect(agueda.textContent).not.toMatch(/Poda em altura com plataforma|Tratamento fitossanitário|Relatório técnico para câmara/)
    const aveiro = render(await ServiceCityPage({ params: Promise.resolve({ slug: 'poda-arvores-aveiro' }) })).container
    expect(aveiro.textContent).toContain('Tratamento fitossanitário')
  })

  it('/pt/mapa-do-site/ lie les deux pages de service d’Águeda', async () => {
    const { default: MapaDoSitePage } = await import('@/app/pt/mapa-do-site/page')
    const { container } = render(MapaDoSitePage())
    for (const s of SERVICOS_CONCELHO) expect(liens(container)).toContain(`/pt/servicos/${s.slug}/`)
  })
})
