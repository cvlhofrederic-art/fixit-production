// Page limpeza de telhados : demande du propriétaire du 28/10/2026 (toucher Águeda, Aveiro et « toutes les villes et villages »
// du distrito de Aveiro). Décision : ni liste de villes ou de villages (keyword stuffing), ni page satellite (doorway), guide
// docs/seo/porto-palavras-chave/consignes-google-2026-10-19.md, section 2. À la place :
// - titre gardé, H1 et description avec « lavagem » et « impermeabilização » (requêtes de l'autocomplétion du 28/10/2026),
//   sans perdre « limpeza de telhados » ;
// - section « O que muda no telhado de uma zona para outra » dans « Onde trabalhamos » : faits sourcés (IPMA, normais
//   1991-2020 ; APA, Plano Nacional da Água ; ISO 9223 ; Regulamento Delegado (UE) 2017/1475 ; PMDFCI de Águeda), concelhos
//   nommés en exemples, jamais plus de deux d'affilée, fréquence conforme à la FAQ et à « Quando limpar » ;
// - liens depuis les trois pages d'Águeda par leurs blocs de liens existants, date DATA_LIGACOES_AGUEDA_TELHADOS.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import LimpezaDeTelhadosPage, { metadata as metadataLimpeza } from '@/app/pt/servicos/limpeza-de-telhados/page'
import LimpezaDeTerrenosPage from '@/app/pt/servicos/limpeza-de-terrenos-agueda/page'
import TerraplanagemPage from '@/app/pt/servicos/terraplanagem-agueda/page'
import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import { LIMPEZA_DE_TELHADOS, RENOVACAO_DE_FACHADAS, TRABALHOS_VERTICAIS, servicosDistritoRelacionados } from '@/lib/data/pt-servicos-distrito'
import { LIMPEZA_DE_TERRENOS_AGUEDA, TERRAPLANAGEM_AGUEDA } from '@/lib/data/pt-servicos-concelho'
import { CITIES } from '@/lib/data/seo-pages-data'
import { DESCRICAO_MAX } from '@/lib/seo/pt-meta'
import { TELEFONE_PT_TEXTE } from '@/lib/seo/entite-pt'
import { getAllPtSitemapUrls } from '@/lib/sitemap-pt-pages'
import { DATA_LIGACOES_AGUEDA_TELHADOS, DATA_PAGINAS_AGUEDA, DATA_ZONA_DISTRITOS } from '@/lib/seo/pt-datas'

const BASE = 'https://vitfix.io'
const TELHADOS = '/pt/servicos/limpeza-de-telhados/'
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })
const espacos = (t: string | null | undefined) => (t ?? '').replace(/\s+/g, ' ').trim()

// Concelhos des trois distritos (18 + 14 + 19) : ceux de la grille pour Porto, la liste officielle pour Braga et Aveiro.
const CONCELHOS = [
  ...CITIES.filter((c) => c.distrito === 'Porto').map((c) => c.name),
  'Amares', 'Barcelos', 'Braga', 'Cabeceiras de Basto', 'Celorico de Basto', 'Esposende', 'Fafe', 'Guimarães', 'Póvoa de Lanhoso',
  'Terras de Bouro', 'Vieira do Minho', 'Vila Nova de Famalicão', 'Vila Verde', 'Vizela',
  'Águeda', 'Albergaria-a-Velha', 'Anadia', 'Arouca', 'Aveiro', 'Castelo de Paiva', 'Espinho', 'Estarreja', 'Ílhavo', 'Mealhada',
  'Murtosa', 'Oliveira de Azeméis', 'Oliveira do Bairro', 'Ovar', 'Santa Maria da Feira', 'São João da Madeira', 'Sever do Vouga',
  'Vagos', 'Vale de Cambra',
]
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const NOMES = [...CONCELHOS].sort((a, b) => b.length - a.length).map(escapar).join('|')

/** Suites de trois noms de concelhos ou plus (« A, B e C », « em A, em B ou em C ») : une énumération. */
function enumeracoes(texte: string): string[] {
  const motif = new RegExp(`(?:${NOMES})(?:(?:, | e | ou )(?:(?:em|de|do|da|no|na) )?(?:${NOMES})){2,}`, 'g')
  return texte.match(motif) ?? []
}

/** Concelhos nommés dans un texte (mot entier). */
function concelhosCitados(texte: string): string[] {
  return CONCELHOS.filter((n) => new RegExp(`(^|[^\\p{L}])${escapar(n)}(?![\\p{L}-])`, 'u').test(texte)).sort((a, b) => a.localeCompare(b))
}

const condicoes = LIMPEZA_DE_TELHADOS.condicoesLocais!
const textoCondicoes = [condicoes.titulo, condicoes.intro, ...condicoes.zonas.flatMap((z) => [z.titulo, z.texto])].join(' ')

describe('limpeza de telhados : H1 et description avec lavagem et impermeabilização', () => {
  it('titre inchangé ; H1 et description gardent « limpeza de telhados » et portent « lavagem » et « impermeabilização »', () => {
    expect(String(metadataLimpeza.title)).toBe('Limpeza de telhados e caleiras: Porto, Braga e Aveiro')
    for (const texte of [LIMPEZA_DE_TELHADOS.h1, String(metadataLimpeza.description)]) {
      expect(texte).toMatch(/limpeza de telhados/i)
      expect(texte).toMatch(/lavagem/i)
      expect(texte).toMatch(/impermeabilização/i)
      expect(texte).toContain('nos distritos do Porto, Braga e Aveiro')
    }
    const d = String(metadataLimpeza.description)
    expect(d.length).toBeGreaterThanOrEqual(120)
    expect(d.length).toBeLessThanOrEqual(DESCRICAO_MAX)
    expect(d).toContain(TELEFONE_PT_TEXTE)
  })

  it('HTML : un seul H1, celui des données', () => {
    const h1 = render(LimpezaDeTelhadosPage()).container.querySelectorAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].textContent).toBe(LIMPEZA_DE_TELHADOS.h1)
  })
})

describe('limpeza de telhados : ce qui change d’une zone à l’autre', () => {
  it('section rendue dans « Onde trabalhamos » : intertitre, introduction et trois cartes ; seulement sur limpeza de telhados', () => {
    const c = render(LimpezaDeTelhadosPage()).container
    const bloco = c.querySelector('#zona #condicoes')
    expect(bloco).not.toBeNull()
    expect(espacos(bloco?.querySelector('h3')?.textContent)).toBe(condicoes.titulo)
    expect(Array.from(bloco?.querySelectorAll('article h4') ?? []).map((h) => h.textContent)).toEqual(condicoes.zonas.map((z) => z.titulo))
    expect(condicoes.zonas.map((z) => z.titulo)).toEqual(['Junto ao mar e à Ria de Aveiro', 'No interior: mais geada e mais chuva', 'Na serra e entre árvores'])
    for (const z of condicoes.zonas) expect(espacos(bloco?.textContent)).toContain(z.texto)
    // Gabarit existant : même grille et mêmes cartes que « O que fazemos » (aucune grille nouvelle).
    const grelhaServicos = c.querySelector('#servicos article')?.parentElement
    const grelhaCondicoes = bloco?.querySelector('article')?.parentElement
    expect(grelhaCondicoes?.className).toBe(grelhaServicos?.className)
    // Fond de carte mis à part : il alterne avec celui de la section (cartao() du gabarit).
    const semFundo = (e: Element | null | undefined) => e?.className.replace(/\bbg-[\w-]+/, '')
    expect(semFundo(bloco?.querySelector('article'))).toBe(semFundo(c.querySelector('#servicos article')))
    expect(bloco?.querySelector('article h4')?.className).toBe(c.querySelector('#servicos article h3')?.className)
    // La zone de l'équipe reste dite d'abord, et le lien vers les pages ville reste en fin de section.
    const zona = espacos(c.querySelector('#zona')?.textContent)
    expect(zona.indexOf('A equipa parte de Marco de Canaveses')).toBeLessThan(zona.indexOf(condicoes.titulo))
    expect(zona.indexOf(condicoes.titulo)).toBeLessThan(zona.indexOf('Outros serviços VITFIX, por concelho'))
    expect(RENOVACAO_DE_FACHADAS.condicoesLocais).toBeUndefined()
    expect(TRABALHOS_VERTICAIS.condicoesLocais).toBeUndefined()
  })

  it('seuls chiffres : ceux des sources vérifiées le 28/10/2026 (IPMA 1991-2020, PNA, ISO 9223, règlement 2017/1475)', () => {
    const verificados = new Set(['1991', '2020', '0', '0,3', '1,4', '24,3', '1387,3', '975,5', '9223', '2017', '1475', '4000'])
    const citados: string[] = [...(textoCondicoes.match(/\d+(?:[.,]\d+)*/g) ?? [])]
    expect(citados.filter((n) => !verificados.has(n))).toEqual([])
    expect([...verificados].filter((n) => !citados.includes(n))).toEqual([])
    // Valeurs rattachées à leur station.
    expect(textoCondicoes).toContain('0,3 dias de geada por ano na estação da Universidade de Aveiro')
    expect(textoCondicoes).toContain('1,4 na de Pedras Rubras')
    expect(textoCondicoes).toContain('a normal 1991-2020 do IPMA para Braga (Merelim) dá 24,3 dias de geada e 1387,3 mm de chuva por ano, contra 0,3 dias e 975,5 mm em Aveiro')
    expect(textoCondicoes).toContain('em alguns locais da serra do Gerês, o Plano Nacional da Água indica médias perto de 4000 mm por ano')
    // Normales calculées (séries hybrides) : jamais « regista » ; l'introduction ne date que les valeurs des stations de
    // l'IPMA, la valeur du Gerês (Plano Nacional da Água, 2002) étant attribuée à part.
    expect(textoCondicoes).not.toMatch(/regist/i)
    expect(condicoes.intro).toContain('Os valores das estações do IPMA são médias anuais das normais climatológicas 1991-2020')
    // ISO 9223 : l'exemple du tableau C.1 (« coastal areas without spray of salt water »), sans la distance de l'adaptation
    // de la HDGASA.
    expect(textoCondicoes).toContain('(ISO 9223) dá as zonas costeiras sem salpicos de água do mar como exemplo de corrosividade alta para os metais, em clima temperado')
    expect(textoCondicoes).not.toMatch(/quil[óo]metro|\bkm\b|metros do/i)
    // Humidité du littoral : aucune tendance claire (PNA 2002), donc ni comparaison ni conclusion sur le musgo près de la costa.
    expect(textoCondicoes).not.toMatch(/humidade|secam devagar|voltam mais depressa/i)
    // Conseil au propriétaire, pas un contrôle de l'équipe à chaque limpeza ; corrosion des seules caleiras metálicas.
    expect(textoCondicoes).toContain('vale a pena vigiar as caleiras metálicas, os rufos e os remates de chapa: corrosão, furos e uniões abertas')
    expect(textoCondicoes).not.toMatch(/em cada limpeza|ferrugem/i)
    // Ni prix, ni pourcentage, ni délai ou promesse de l'équipe ; brouillard non vérifié, donc absent.
    expect(textoCondicoes).not.toMatch(/€|\beuros?\b|%|\bhoras?\b|garant|promet|nevoeiro/i)
  })

  it('concelhos nommés seulement en exemples, des trois distritos, Aveiro et Águeda compris ; jamais plus de deux d’affilée', () => {
    expect(concelhosCitados(textoCondicoes)).toEqual(['Águeda', 'Aveiro', 'Braga', 'Espinho', 'Porto', 'Vila do Conde'])
    expect(enumeracoes(textoCondicoes)).toEqual([])
    // Le détecteur repère bien une énumération de trois noms.
    expect(enumeracoes('em Ovar, em Espinho ou em Aveiro')).toHaveLength(1)
    expect(enumeracoes('Braga, Barcelos e Fafe')).toHaveLength(1)
    // Page entière (hors JSON-LD), la zone de l'équipe mise à part : aucune énumération non plus.
    const c = render(LimpezaDeTelhadosPage()).container.cloneNode(true) as HTMLElement
    c.querySelectorAll('script').forEach((s) => s.remove())
    expect(enumeracoes(espacos(c.textContent).replaceAll('Porto, Braga e Aveiro', ''))).toEqual([])
  })

  it('fréquence : la même que la FAQ et « Quando limpar » (tous les ans, avant les pluies d’automne), sans nouvelle promesse', () => {
    const faq = LIMPEZA_DE_TELHADOS.faqs.find((f) => f.pergunta === 'De quanto em quanto tempo se deve limpar o telhado?')?.resposta ?? ''
    expect(faq).toContain('todos os anos, antes das chuvas de outono')
    expect(LIMPEZA_DE_TELHADOS.frequencia).toMatch(/todos os anos, de preferência antes das chuvas de outono/)
    expect(textoCondicoes).toContain('a verificação de todos os anos, antes das chuvas de outono')
    expect(textoCondicoes).not.toMatch(/\d+\s*(vezes|meses)|duas vezes|semestral|mensal|trimestral/i)
    // Le conseil sur les tuiles cassées reprend la FAQ : le hidrofugante ne répare pas.
    expect(LIMPEZA_DE_TELHADOS.faqs.some((f) => /Não repara telhas partidas/.test(f.resposta))).toBe(true)
    expect(textoCondicoes).toContain('a lavagem e o hidrofugante não as reparam')
  })
})

describe('liens depuis les trois pages d’Águeda vers limpeza de telhados', () => {
  /** Liens vers la page de district et texte de la section qui les contient. */
  const versTelhados = (c: HTMLElement) => Array.from(c.querySelectorAll(`a[href="${TELHADOS}"]`)) as HTMLAnchorElement[]

  it('limpeza de terrenos et terraplanagem : une carte dans « Serviços relacionados em Águeda », données des liens', () => {
    for (const { servico, Pagina } of [
      { servico: LIMPEZA_DE_TERRENOS_AGUEDA, Pagina: LimpezaDeTerrenosPage },
      { servico: TERRAPLANAGEM_AGUEDA, Pagina: TerraplanagemPage },
    ]) {
      expect(servico.ligacoes.filter((l) => l.href === TELHADOS), servico.slug).toHaveLength(1)
      const liens = versTelhados(render(Pagina()).container)
      expect(liens, servico.slug).toHaveLength(1)
      expect(espacos(liens[0].closest('section')?.textContent), servico.slug).toContain('Serviços relacionados em Águeda')
      expect(espacos(liens[0].textContent), servico.slug).toContain('Lavagem e impermeabilização de telhados')
      expect(liens[0].textContent, servico.slug).not.toMatch(/Porto, Braga e Aveiro/)
    }
  })

  it('poda-arvores-agueda : une carte dans « Serviços relacionados em Águeda », au nom du distrito ; ni les autres villes ni les autres métiers d’Águeda', async () => {
    const agueda = CITIES.find((c) => c.slug === 'agueda')!
    expect(servicosDistritoRelacionados(agueda.serviceCityOverrides?.['poda-arvores']?.servicosDistrito, agueda.distrito).map((s) => s.slug)).toEqual(['limpeza-de-telhados'])
    const liens = versTelhados(render(await ServiceCityPage(params('poda-arvores-agueda'))).container)
    expect(liens).toHaveLength(1)
    expect(espacos(liens[0].closest('section')?.textContent)).toContain('Serviços relacionados em Águeda')
    expect(espacos(liens[0].textContent)).toBe('🏠Limpeza de telhadosno distrito de Aveiro')
    for (const slug of ['poda-arvores-aveiro', 'poda-arvores-porto', 'jardineiro-agueda']) {
      expect(versTelhados(render(await ServiceCityPage(params(slug))).container), slug).toHaveLength(0)
    }
    // Hors de son distrito, le même réglage ne lierait rien.
    expect(servicosDistritoRelacionados(['limpeza-de-telhados'], 'Lisboa')).toEqual([])
    expect(servicosDistritoRelacionados(undefined, 'Aveiro')).toEqual([])
  })
})

describe('dates des pages touchées', () => {
  const urls = getAllPtSitemapUrls(BASE)
  const date = (chemin: string) => urls.find((u) => u.url === `${BASE}${chemin}`)?.lastModified

  it('les trois pages d’Águeda prennent DATA_LIGACOES_AGUEDA_TELHADOS ; limpeza de telhados garde DATA_ZONA_DISTRITOS', () => {
    expect(DATA_LIGACOES_AGUEDA_TELHADOS).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Même lot que la zone des trois distritos : les deux dates se reportent ensemble au jour de la fusion.
    expect(DATA_LIGACOES_AGUEDA_TELHADOS).toBe(DATA_ZONA_DISTRITOS)
    for (const slug of ['limpeza-de-terrenos-agueda', 'terraplanagem-agueda', 'poda-arvores-agueda']) {
      expect(date(`/pt/servicos/${slug}/`), slug).toBe(DATA_LIGACOES_AGUEDA_TELHADOS)
    }
    expect(date(TELHADOS)).toBe(DATA_ZONA_DISTRITOS)
    expect(LIMPEZA_DE_TELHADOS.dataModificacao).toBe(DATA_ZONA_DISTRITOS)
  })

  it('rien d’autre ne bouge à Águeda : page ville et pages métier sans lien nouveau', () => {
    expect(date('/pt/cidade/agueda/')).toBe([DATA_PAGINAS_AGUEDA, DATA_ZONA_DISTRITOS].sort((a, b) => a.localeCompare(b)).at(-1))
    for (const m of ['jardineiro', 'canalizador', 'limpeza-espacos', 'eletricista']) expect(date(`/pt/servicos/${m}-agueda/`), m).toBe(DATA_PAGINAS_AGUEDA)
    expect(date('/pt/servicos/poda-arvores-aveiro/')).not.toBe(DATA_LIGACOES_AGUEDA_TELHADOS)
  })
})
