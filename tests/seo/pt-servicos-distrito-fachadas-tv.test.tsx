// Pages de district renovação de fachadas et trabalhos verticais (lib/data/pt-servicos-distrito.ts, gel A0 levé par le
// propriétaire le 20/10/2026, faits confirmés du 20 au 23/10/2026). Garde-fous :
// - seuls les faits confirmés (équipe VITFIX, andaime ou acesso por corda IRATA, prestations confirmées) : rien sur ce
//   qui ne l'est pas (linhas de vida, drone, graffitis, vidros, fachada ventilada, ANETVA, ISO, assurances, garanties), ni
//   les détails de méthode retirés à la relecture du 23/10/2026 tant que le propriétaire ne les a pas validés ;
// - une page par requête (plan, section 4) : lavagem et capoto sur fachadas, pas sur trabalhos verticais ;
// - aucun prix (devis gratuit, facteurs sans chiffre), délai de visite seulement depuis data/seo/local-proof.json ;
// - titre et description dans les longueurs, un seul H1, JSON-LD Service + BreadcrumbList seulement ;
// - liens croisés entre les trois pages de district, et depuis les hubs, la grille et les pages ville des metiersLigados ;
// - lastmod propre : seules les pages qui gagnent un lien changent de date.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { Metadata } from 'next'
import type { JSX } from 'react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import RenovacaoDeFachadasPage, { metadata as metadataFachadas } from '@/app/pt/servicos/renovacao-de-fachadas/page'
import TrabalhosVerticaisPage, { metadata as metadataTv } from '@/app/pt/servicos/trabalhos-verticais/page'
import LimpezaDeTelhadosPage from '@/app/pt/servicos/limpeza-de-telhados/page'
import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import HubMetierPage from '@/app/pt/perto-de-mim/[slug]/page'
import CidadePage from '@/app/pt/cidade/[slug]/page'
import ServicosHubPage from '@/app/pt/servicos/page'
import MapaDoSitePage from '@/app/pt/mapa-do-site/page'
import {
  LIMPEZA_DE_TELHADOS, RENOVACAO_DE_FACHADAS, SERVICOS_DISTRITO, TRABALHOS_VERTICAIS, dataModificacaoDistrito, servicosDistritoLigados, type ServicoDistrito,
} from '@/lib/data/pt-servicos-distrito'
import { CITIES } from '@/lib/data/seo-pages-data'
import { DESCRICAO_MAX, SUFIXO_MARCA, TITULO_MAX } from '@/lib/seo/pt-meta'
import { ENTITE_PT, TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { comPrecoCapoto, getAllPtSitemapUrls, sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DATA_LIGACOES_DISTRITO, DATA_LIGACOES_FACHADAS_TV, DATA_PAGINAS_DISTRITO, DATA_PAGINAS_FACHADAS_TV } from '@/lib/seo/pt-datas'
import { precosPara, prazoDistritoPara } from '@/lib/seo/pt-provas-locais'
import { classer } from '../../scripts/seo/pt-audit/lib/classer.mjs'

const BASE = 'https://vitfix.io'
const PAGINAS: Array<{ servico: ServicoDistrito; Pagina: () => JSX.Element; metadata: Metadata }> = [
  { servico: RENOVACAO_DE_FACHADAS, Pagina: RenovacaoDeFachadasPage, metadata: metadataFachadas },
  { servico: TRABALHOS_VERTICAIS, Pagina: TrabalhosVerticaisPage, metadata: metadataTv },
]
const caminho = (s: { slug: string }) => `/pt/servicos/${s.slug}/`
const liens = (c: HTMLElement) => Array.from(c.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })
const textes = (s: ServicoDistrito) =>
  JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !['dataModificacao', 'dataLigacoes', 'metiersLigados', 'slug'].includes(k))))

describe('données : faits confirmés seulement', () => {
  it('ordre des pages de district et slugs connus de l’audit', () => {
    expect(SERVICOS_DISTRITO.map((s) => s.slug)).toEqual(['limpeza-de-telhados', 'renovacao-de-fachadas', 'trabalhos-verticais'])
    for (const { servico } of PAGINAS) expect(classer(caminho(servico))).toEqual({ groupe: 'servicos-distrito', metier: servico.slug, ville: '' })
  })

  it('prestations confirmées par le propriétaire (20 au 23/10/2026)', () => {
    expect(RENOVACAO_DE_FACHADAS.prestacoes.map((p) => p.titulo)).toEqual([
      'Fissuras e reboco', 'Betão das varandas', 'Infiltrações e impermeabilização', 'Limpeza e lavagem de fachadas', 'Capoto existente', 'Pintura de fachadas',
    ])
    expect(TRABALHOS_VERTICAIS.prestacoes.map((p) => p.titulo)).toEqual([
      'Pintura em altura', 'Selagem de juntas de dilatação', 'Fissuras, reboco e betão das varandas', 'Infiltrações nos andares altos', 'Caleiras inacessíveis',
    ])
    for (const { servico } of PAGINAS) {
      expect(servico.intro, servico.slug).toMatch(/IRATA/)
      expect(servico.intro, servico.slug).toMatch(/andaime/)
      expect(servico.intro, servico.slug).toMatch(/prédios e (de )?moradias/)
    }
  })

  it('rien de ce qui n’est pas confirmé : linhas de vida, drone, graffitis, vidros, fachada ventilada, certifications et garanties', () => {
    for (const { servico } of PAGINAS) {
      expect(textes(servico), servico.slug).not.toMatch(/linhas? de vida|drone|graffit|vidros?\b|ventilada|estruturas metálicas|ANETVA|\bISO\b|seguradora|apólice|garantia|inspeç|relatório|anos de experiência/i)
    }
  })

  it('détails de méthode non validés par le propriétaire (relecture du 23/10/2026) : absents tant qu’il ne les a pas validés', () => {
    for (const { servico } of PAGINAS) {
      expect(textes(servico), servico.slug).not.toMatch(/tratamos o ferro|compatível|pressão baixa|contra as algas|primavera|outono|engenheiro|delimitamos|elástico|vento|moradores|prumada/i)
    }
    expect(TRABALHOS_VERTICAIS.faqs.map((f) => f.pergunta)).not.toContain('O que deve o condomínio preparar antes do trabalho?')
  })

  it('une page par requête : lavagem et capoto sur fachadas seulement ; « pintura de fachadas em altura » une fois sur fachadas', () => {
    const propres = (s: ServicoDistrito) => textes({ ...s, ligacoes: [] })
    expect(TRABALHOS_VERTICAIS.prestacoes.some((p) => /capoto|lavagem/i.test(`${p.titulo} ${p.texto}`))).toBe(false)
    expect(propres(TRABALHOS_VERTICAIS)).not.toMatch(/capoto/i)
    expect(propres(RENOVACAO_DE_FACHADAS).match(/pintura de fachadas em altura/gi)).toHaveLength(1)
    // Question du plan « fachada degradada : reparar ou reabilitar », vocabulaire des clients (reabilitação, recuperação).
    expect(RENOVACAO_DE_FACHADAS.faqs.map((f) => f.pergunta)).toContain('A fachada está degradada: reparar ou reabilitar?')
    expect(propres(RENOVACAO_DE_FACHADAS)).toMatch(/reabilitação/)
    expect(propres(RENOVACAO_DE_FACHADAS)).toMatch(/recuperação/)
  })

  it('orthographe pt-PT : « mástique », jamais « mastique »', () => {
    for (const { servico } of PAGINAS) expect(textes(servico), servico.slug).not.toMatch(/mastique/i)
  })

  it('aucun prix, pourcentage ni délai chiffré ; seule année citée : 2005 (DL 50/2005) sur trabalhos verticais', () => {
    for (const { servico } of PAGINAS) {
      const t = textes(servico)
      expect(t, servico.slug).not.toMatch(/€|\beuros?\b|%/i)
      expect(t, servico.slug).not.toMatch(/\b\d+\s*(h|horas?|dias?|semanas?|minutos?|anos?|m2|m²|metros?)\b/i)
      expect(servico.faqs.some((f) => f.preco), servico.slug).toBe(false)
      expect(precosPara(servico.slug), servico.slug).toEqual([])
    }
    expect(textes(RENOVACAO_DE_FACHADAS).match(/\b(19|20)\d{2}\b/g)).toBeNull()
    expect(textes(TRABALHOS_VERTICAIS).match(/\b(19|20)\d{2}\b/g)).toEqual(['2005'])
  })

  it('règles légales citées avec leur référence (RJUE, Código Civil, DL 268/94, DL 50/2005), jamais sans', () => {
    const f = textes(RENOVACAO_DE_FACHADAS)
    for (const ref of ['artigo 89.º, n.º 1', 'artigo 2.º, alínea f)', 'artigo 6.º, n.º 1, alínea a)', 'artigo 2.º, alínea d)', 'artigo 4.º, n.º 2, alínea i)', 'artigo 1436.º, n.º 2', 'Decreto-Lei n.º 268/94, artigo 4.º, n.º 1']) {
      expect(f).toContain(ref)
    }
    // Obras de conservação no exterior, mesmo isentas : informação à câmara e aviso no local até cinco dias antes (RJUE em
    // vigor desde 01/10/2026, artigo 80.º-A, n.os 1, 3 e 5, e artigo 6.º, n.º 12).
    const licenca = RENOVACAO_DE_FACHADAS.faqs.find((q) => q.pergunta === 'As obras na fachada precisam de licença da câmara?')?.resposta ?? ''
    expect(licenca).toContain('artigo 80.º-A, n.os 1, 3 e 5')
    expect(licenca).toMatch(/informar a câmara municipal até cinco dias antes do início dos trabalhos/)
    expect(licenca).toMatch(/aviso/)
    const tv = textes(TRABALHOS_VERTICAIS)
    expect(tv).toContain('Decreto-Lei n.º 50/2005 (artigo 39.º)')
    expect(tv).toContain('(artigo 36.º)')
    // Ni la licença d'ocupação da via pública (règlements municipaux non vérifiés), ni « parte comum » (non vérifié).
    expect(f + tv).not.toMatch(/ocupação da via pública|parte comum|partes comuns|maioria/i)
  })

  it('aucune phrase de plus de huit mots commune à deux pages de district (contenu propre à chaque page)', () => {
    const phrases = (s: ServicoDistrito) =>
      new Set(textes(s).split(/(?<=[.!?:;])\s+|","|":"|\\n/).map((p) => p.replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase()).filter((p) => p.split(/\s+/).length > 8))
    const [a, b, c] = [phrases(LIMPEZA_DE_TELHADOS), phrases(RENOVACAO_DE_FACHADAS), phrases(TRABALHOS_VERTICAIS)]
    expect([...b].filter((p) => a.has(p) || c.has(p))).toEqual([])
    expect([...c].filter((p) => a.has(p))).toEqual([])
  })
})

describe.each(PAGINAS)('$servico.slug : métadonnées et rendu', ({ servico, Pagina, metadata }) => {
  it('titre sans marque (65 caractères au plus avec « | VITFIX »), description de 120 à 155 caractères avec le numéro, canonical', () => {
    expect(metadata.title).toBe(servico.titulo)
    expect(String(metadata.title)).not.toMatch(/vitfix/i)
    expect(String(metadata.title).length + SUFIXO_MARCA.length).toBeLessThanOrEqual(TITULO_MAX)
    const d = String(metadata.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d).toContain(TELEFONE_PT_TEXTE)
    expect(d).not.toMatch(/24 ?h|24\/7|urg[êe]nc|€/i)
    expect(metadata.alternates).toEqual({ canonical: `${BASE}${caminho(servico)}` })
    expect(metadata.openGraph).toMatchObject({ locale: 'pt_PT', siteName: 'VITFIX', title: metadata.title })
  })

  it('un seul h1 ; sections attendues ; aucun prix ; visite en 48 heures tirée de local-proof.json', () => {
    const c = render(Pagina()).container
    const h1 = c.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(servico.h1)
    for (const id of ['servicos', 'preco', 'metodo', 'quando', 'zona', 'relacionados', 'perguntas', 'prazos']) expect(c.querySelector(`#${id}`), id).not.toBeNull()
    expect(c.querySelector('#fibrocimento')).toBeNull()
    expect(c.querySelector('#precos')).toBeNull()
    expect(c.querySelector('#chantiers')).toBeNull()
    expect(c.textContent).not.toMatch(/€/)
    expect(prazoDistritoPara('Porto', servico.slug)?.visita_horas_max).toBe(48)
    expect(c.querySelector('#prazos')?.textContent).toContain('Visita em 48 horas, no máximo.')
    expect(c.textContent).toContain(`Orçamento grátis`)
    expect(c.textContent).toContain(TELEFONE_PT_TEXTE)
  })

  it('JSON-LD : Service fourni par #business sur le Distrito do Porto et fil d’Ariane, rien d’interdit', () => {
    const c = render(Pagina()).container
    const scripts = c.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(1)
    const graphe = JSON.parse(scripts[0].textContent ?? '{}')['@graph'] as Array<Record<string, unknown>>
    expect(graphe.map((n) => n['@type'])).toEqual(['Service', 'BreadcrumbList'])
    expect(graphe[0]).toMatchObject({ provider: { '@id': ENTITE_PT.id }, url: `${BASE}${caminho(servico)}`, name: servico.h1, serviceType: servico.tipoServico })
    expect(graphe[0].areaServed).toEqual({ '@type': 'AdministrativeArea', name: 'Distrito do Porto' })
    expect(JSON.stringify(graphe)).not.toMatch(/FAQPage|HowTo|LocalBusiness|EmergencyService|AggregateRating|"Review"|Offer|PriceSpecification/)
    const fil = graphe[1] as { itemListElement: Array<{ item: string }> }
    expect(fil.itemListElement.map((i) => i.item)).toEqual([`${BASE}/pt/`, `${BASE}/pt/servicos/`, `${BASE}${caminho(servico)}`])
  })

  it('FAQ visible (details) sans balisage, une question par entrée ; aucune liste de concelhos', () => {
    const c = render(Pagina()).container
    const questions = Array.from(c.querySelectorAll('#perguntas details summary span:first-child')).map((q) => q.textContent)
    expect(questions).toEqual(servico.faqs.map((f) => f.pergunta))
    expect(new Set(questions).size).toBe(questions.length)
    const cites = CITIES.filter((city) => (c.textContent ?? '').includes(city.name)).map((city) => city.name)
    expect(cites.sort()).toEqual(['Marco de Canaveses', 'Porto'])
  })

  it('liens croisés : les deux autres pages de district, et seulement des pages publiées', () => {
    const l = liens(render(Pagina()).container)
    for (const autre of SERVICOS_DISTRITO.filter((s) => s.slug !== servico.slug)) expect(l, autre.slug).toContain(caminho(autre))
    expect(l).toContain('/pt/servicos/')
    expect(l).toContain('/pt/cidade/')
    // Chaque lien interne rendu (fil d'Ariane, zone, cartes, chantiers) vise une URL du sitemap PT, qui exclut les URL
    // redirigées (data/seo/pt-redirects.csv, middleware) et noindex.
    const publiees = new Set(getAllPtSitemapUrls(BASE).map((u) => u.url))
    const internes = l.filter((h) => h.startsWith('/pt/'))
    expect(internes.length).toBeGreaterThan(5)
    for (const h of internes) expect(publiees.has(`${BASE}${h.split('#')[0]}`), h).toBe(true)
  })

  it('sitemap : fichier servicos seulement, lastmod = date du contenu des deux pages', () => {
    const g = sitemapsPt(BASE)
    const cible = `${BASE}${caminho(servico)}`
    expect(Object.entries(g).filter(([, urls]) => urls.some((u) => u.url === cible)).map(([k]) => k)).toEqual(['servicos'])
    expect(g.servicos.find((u) => u.url === cible)?.lastModified).toBe(DATA_PAGINAS_FACHADAS_TV)
    expect(dataModificacaoDistrito(servico)).toBe(DATA_PAGINAS_FACHADAS_TV)
  })
})

describe('maillage et dates des pages qui lient les nouvelles pages', () => {
  const g = sitemapsPt(BASE)
  const date = (chemin: string) => Object.values(g).flat().find((u) => u.url === `${BASE}${chemin}`)?.lastModified
  const PORTO = CITIES.filter((c) => c.distrito === 'Porto')

  it('metiersLigados : fachadas sur pintor, impermeabilizacao, pedreiro, isolamento-termico, limpeza-condominio ; trabalhos verticais sur pintor et impermeabilizacao', () => {
    expect(RENOVACAO_DE_FACHADAS.metiersLigados).toEqual(['pintor', 'impermeabilizacao', 'pedreiro', 'isolamento-termico', 'limpeza-condominio'])
    expect(TRABALHOS_VERTICAIS.metiersLigados).toEqual(['pintor', 'impermeabilizacao'])
    expect(servicosDistritoLigados('telhador', 'Porto').map((s) => s.slug)).toEqual(['limpeza-de-telhados'])
    expect(servicosDistritoLigados('impermeabilizacao', 'Porto').map((s) => s.slug)).toEqual(['limpeza-de-telhados', 'renovacao-de-fachadas', 'trabalhos-verticais'])
    expect(servicosDistritoLigados('pintor', 'Braga')).toEqual([])
  })

  it('/pt/servicos/ et le plan du site lient les deux pages', () => {
    const index = liens(render(ServicosHubPage()).container)
    const plano = liens(render(MapaDoSitePage()).container)
    for (const { servico } of PAGINAS) {
      expect(index, servico.slug).toContain(caminho(servico))
      expect(plano, servico.slug).toContain(caminho(servico))
    }
  })

  it('la page limpeza de telhados lie les deux pages ; son lastmod avance par la date de ses cartes de liens, pas celle de ses textes', () => {
    const l = liens(render(LimpezaDeTelhadosPage()).container)
    for (const { servico } of PAGINAS) expect(l).toContain(caminho(servico))
    // Date des textes repris sur les pages concelho inchangée ; les cartes ont leur propre date (lastmod de la page de district).
    expect(LIMPEZA_DE_TELHADOS.dataModificacao).toBe(DATA_PAGINAS_DISTRITO)
    expect(LIMPEZA_DE_TELHADOS.dataModificacaoLigacoes).toBe(DATA_LIGACOES_FACHADAS_TV)
    expect(date('/pt/servicos/limpeza-de-telhados/')).toBe([DATA_PAGINAS_DISTRITO, DATA_LIGACOES_FACHADAS_TV].sort((a, b) => a.localeCompare(b)).at(-1))
  })

  it('fachadas : liens du plan et du guide (pintor, obras), aucun article de blog (prix non sourcés), carte trabalhos verticais fidèle', () => {
    const hrefs = RENOVACAO_DE_FACHADAS.ligacoes.map((x) => x.href)
    expect(hrefs).toContain('/pt/perto-de-mim/pintor/')
    expect(hrefs).toContain('/pt/perto-de-mim/obras-remodelacao/')
    // Articles proposés par le plan écartés (journal du 23/10/2026) : prix non sourcés (humidade, capoto), règle périmée
    // (licença), question ouverte (IVA). « Não publicamos preços » serait faux sur le site : tournure exacte.
    for (const { servico } of PAGINAS) expect(servico.ligacoes.filter((x) => x.href.startsWith('/pt/blog/')), servico.slug).toEqual([])
    expect(textes(RENOVACAO_DE_FACHADAS)).not.toMatch(/não publicamos preços/i)
    const carteTv = RENOVACAO_DE_FACHADAS.ligacoes.find((x) => x.href === caminho(TRABALHOS_VERTICAIS))?.texto ?? ''
    expect(carteTv).toMatch(/corda/)
    expect(carteTv).toMatch(/andaime/)
    expect(carteTv).not.toMatch(/sem andaime/)
  })

  it('hubs : pintor, impermeabilizacao, pedreiro, isolamento-termico et limpeza-condominio lient fachadas ; phrase propre à chaque service', async () => {
    const hub = async (slug: string) => render(await HubMetierPage(params(slug))).container
    for (const slug of RENOVACAO_DE_FACHADAS.metiersLigados) {
      const c = await hub(slug)
      expect(liens(c), slug).toContain('/pt/servicos/renovacao-de-fachadas/')
      expect(c.textContent, slug).not.toContain('Lavagem do telhado, tratamento antimusgo e limpeza de caleiras feitos pela equipa VITFIX:')
      // Hub isolamento-termico : prix réel du capoto dans sa réponse « Quanto custa… », plus récent que les liens.
      expect(date(`/pt/perto-de-mim/${slug}/`), slug).toBe(comPrecoCapoto(slug, DATA_LIGACOES_FACHADAS_TV))
    }
    expect(liens(await hub('pintor'))).toContain('/pt/servicos/trabalhos-verticais/')
    expect(liens(await hub('pedreiro'))).not.toContain('/pt/servicos/trabalhos-verticais/')
    expect((await hub('pedreiro')).textContent).toContain(RENOVACAO_DE_FACHADAS.chamadaHub)
    expect((await hub('impermeabilizacao')).textContent).toContain('Trabalhos feitos pela equipa VITFIX no distrito do Porto:')
    // Le hub telhador ne lie que limpeza de telhados : texte et date inchangés.
    const telhador = await hub('telhador')
    expect(telhador.textContent).toContain('Lavagem do telhado, tratamento antimusgo e limpeza de caleiras feitos pela equipa VITFIX:')
    expect(liens(telhador)).not.toContain('/pt/servicos/renovacao-de-fachadas/')
    expect(date('/pt/perto-de-mim/telhador/')).toBe(DATA_LIGACOES_DISTRITO)
    const eletricista = await hub('eletricista')
    expect(liens(eletricista).some((h) => SERVICOS_DISTRITO.some((s) => h === caminho(s)))).toBe(false)
  })

  it('grille du distrito do Porto : pages des metiersLigados liées et datées du jour des liens ; autres pages et autres distritos inchangés', async () => {
    const lienVers = async (slug: string, cible: string) => liens(render(await ServiceCityPage(params(slug))).container).includes(cible)
    expect(await lienVers('pintor-penafiel', '/pt/servicos/renovacao-de-fachadas/')).toBe(true)
    expect(await lienVers('pintor-penafiel', '/pt/servicos/trabalhos-verticais/')).toBe(true)
    expect(await lienVers('pedreiro-porto', '/pt/servicos/renovacao-de-fachadas/')).toBe(true)
    expect(await lienVers('pedreiro-porto', '/pt/servicos/trabalhos-verticais/')).toBe(false)
    expect(await lienVers('limpeza-condominio-matosinhos', '/pt/servicos/renovacao-de-fachadas/')).toBe(true)
    expect(await lienVers('telhador-porto', '/pt/servicos/renovacao-de-fachadas/')).toBe(false)
    expect(await lienVers('pintor-braga', '/pt/servicos/renovacao-de-fachadas/')).toBe(false)
    expect(await lienVers('pintor-aveiro', '/pt/servicos/trabalhos-verticais/')).toBe(false)
    let liees = 0
    for (const city of PORTO) {
      for (const metier of ['pintor', 'impermeabilizacao', 'pedreiro', 'isolamento-termico', 'limpeza-condominio']) {
        expect(date(`/pt/servicos/${metier}-${city.slug}/`), `${metier}-${city.slug}`).toBe(comPrecoCapoto(metier, DATA_LIGACOES_FACHADAS_TV))
        liees++
      }
      expect(date(`/pt/servicos/telhador-${city.slug}/`), `telhador-${city.slug}`).toBe(DATA_LIGACOES_DISTRITO)
    }
    expect(liees).toBe(90)
    // Métiers sans lien de district dans le distrito do Porto, et métiers liés hors du distrito : date inchangée.
    for (const chemin of ['/pt/servicos/canalizador-porto/', '/pt/servicos/eletricista-penafiel/', '/pt/servicos/pintor-braga/', '/pt/servicos/pedreiro-aveiro/']) {
      expect(date(chemin), chemin).not.toBe(DATA_LIGACOES_FACHADAS_TV)
    }
  })

  it('pages ville du distrito do Porto : les trois pages de district, date des nouveaux liens ; Braga sans lien', async () => {
    const lousada = liens(render(await CidadePage(params('lousada'))).container)
    for (const s of SERVICOS_DISTRITO) expect(lousada, s.slug).toContain(caminho(s))
    const braga = liens(render(await CidadePage(params('braga'))).container)
    expect(braga.some((h) => SERVICOS_DISTRITO.some((s) => h === caminho(s)))).toBe(false)
    for (const city of PORTO) expect(date(`/pt/cidade/${city.slug}/`), city.slug).toBe(DATA_LIGACOES_FACHADAS_TV)
    expect(date('/pt/cidade/braga/')).not.toBe(DATA_LIGACOES_FACHADAS_TV)
  })
})
