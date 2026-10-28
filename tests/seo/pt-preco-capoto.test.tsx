// tests/seo/pt-preco-capoto.test.tsx
//
// Prix réel du capoto (27/10/2026). Le propriétaire confirme que son équipe pose du capoto neuf (isolamento térmico pelo
// exterior, sistema ETICS, pose complète) pour 53 à 58 € par m², matériel et main-d'œuvre compris, sans IVA. Ce prix
// remplace les fourchettes de référence non sourcées (40-80 €/m² et les totaux qui en découlaient) dans la FAQ « Quanto
// custa aplicar capoto por m²? » du métier isolamento-termico (pages métier x ville et hub), l'article
// capoto-isolamento-termico-quanto-custa et l'article humidade-parede-causas-reparacao.
//
// Zone : le prix est dit avec la zone de l'équipe. Le 27/10, seuls le distrito do Porto et le concelho d'Águeda étaient
// confirmés, et Braga, Aveiro et Ovar recevaient une réponse sans prix. Le 28/10/2026, le propriétaire confirme les mêmes
// prix à Braga, Aveiro et Ovar : les 22 villes de la grille affichent le prix, avec la zone élargie.
//
// Affichage au consommateur, vérifié le 27/10/2026 sur les textes en vigueur :
// - DL 138/90 (redação do DL 162/99), art. 1.º n.º 5 : le prix inclut « todos os impostos, taxas e outros encargos » ;
//   art. 6.º n.º 1 : la publicité qui mentionne un prix indique « de forma clara e perfeitamente visível o preço total […],
//   incluindo taxas e impostos » : le prix avec IVA vient dans la même phrase que le prix sans IVA ;
// - DL 57/2008, art. 10.º c) (redação do DL 109-G/2021) : dans un convite a contratar, le prix « incluindo impostos e
//   taxas » ou, s'il ne peut être calculé à l'avance, « o modo como o preço é calculado » ;
// - Código do IVA, art. 18.º n.º 1 : 6 % pour la Lista I, 23 % sinon (continent ; n.º 3 : taux propres que peuvent fixer
//   les Açores et Madère) ; verba 2.27 (empreitadas de beneficiação, remodelação, renovação, restauro, reparação ou
//   conservação de imóveis afetos à habitação ; la taxa reduzida ne couvre pas les materiais incorporados au-delà de 20 % du
//   valor global da prestação de serviços : informação vinculativa AT 29260 du 29/01/2026) ; verba 2.23 : reabilitação de
//   edifícios em ARU.
// Le taux dépend donc de l'obra : chaque mention donne le prix sans IVA, ce qu'il comprend, la règle d'IVA et le prix avec
// IVA entre ses deux bornes (53 × 1,06 et 58 × 1,23), sans affirmer quel taux s'applique.

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import HubMetierPage from '@/app/pt/perto-de-mim/[slug]/page'
import BlogArticlePage from '@/app/pt/blog/[slug]/page'
import EspecialidadesPage from '@/app/pt/especialidades/page'
import PrecosHubPage from '@/app/pt/precos/page'
import PrecosServicePage, { generateStaticParams as guiasPrecos } from '@/app/pt/precos/[slug]/page'
import { BLOG_ARTICLES, CITIES, SERVICES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { SERVICOS_DISTRITO } from '@/lib/data/pt-servicos-distrito'
import { SERVICOS_CONCELHO } from '@/lib/data/pt-servicos-concelho'
import { METODOS_METIER } from '@/lib/data/pt-metodos'
import provas from '@/data/seo/local-proof.json'
import { comPrecoCapoto, sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DATA_PRECO_CAPOTO } from '@/lib/seo/pt-datas'
import { precoPara } from '@/lib/seo/pt-provas-locais'

const BASE = 'https://vitfix.io'
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

/** Le prix tel que le propriétaire l'a donné, dit en entier à chaque mention. */
const PRECO = '53 a 58 € por m², sem IVA, com material e mão de obra'
/** Prix avec IVA entre ses deux bornes : taxa reduzida (6 %) sur le bas, taxa normal (23 %) sur le haut. */
const COM_IVA = 'entre 56,18 € e 71,34 € por m²'
/** Zone confirmée de l'équipe VITFIX, dite avec le prix. */
const ZONA = 'No distrito do Porto e nos concelhos de Braga, Aveiro, Ovar e Águeda, a equipa VITFIX aplica capoto (sistema ETICS)'
/** Première phrase de la réponse et de la section des prix : prix sans IVA, puis avec IVA, dans la même phrase. */
const PRIMEIRA_FRASE = `${ZONA} por ${PRECO}, ou seja, ${COM_IVA} com IVA, conforme a taxa aplicável à obra (preços de outubro de 2026).`
/** Verba 2.27 d'après le texte de la Lista I (informação vinculativa AT 29260). */
const VERBA_2_27 = 'verba 2.27 (empreitadas de beneficiação, remodelação, renovação, restauro, reparação ou conservação de imóveis ou partes autónomas destes afetos à habitação; os materiais incorporados pagam 23% quando excedem 20% do valor global da prestação de serviços)'
/** Exemple : simple multiplication par une surface nommée, jamais un devis. */
const EXEMPLO_150 = '7 950 a 8 700 €, sem IVA (8 427 a 10 701 € com IVA)'
const RESERVA = 'preço final depende da espessura do isolamento, do estado e do acesso da fachada'
/** Ancienne réponse sans prix de Braga, Aveiro et Ovar (27/10), retirée le 28/10/2026. */
const RESPOSTA_SEM_PRECO_RETIRADA = 'O preço do capoto (sistema ETICS) depende da área e da espessura do isolamento, do estado e do acesso da fachada. O orçamento é gratuito.'
/** Fourchettes, totaux et délais de retour de référence retirés. */
const ANTIGOS = ['40€ e 80€', '6 000€ e 12 000€', '2 000€ e 5 000€', '8 000€ a 10 000€', 'mais de 2 anos', 'geralmente 6 a 10 cm', '6 a 10 anos', 'recupera-se tipicamente']
/** Un prix au m² (ou au mètre), sous ses formes courantes : « € por m² », « €/m² », « €/m2 », « € o m² », « euros por metro ». */
const PRECO_M2 = /(?:€|euros?)\s*(?:por|\/|o)\s*(?:m²|m2|metro)/i
const FALA_DE_CAPOTO = /capoto|ETICS|pelo exterior/i

const ARTIGO_CAPOTO = 'capoto-isolamento-termico-quanto-custa'
const ARTIGO_HUMIDADE = 'humidade-parede-causas-reparacao'
const ISOLAMENTO = SERVICES.find((s) => s.slug === 'isolamento-termico')
const PERGUNTA = 'Quanto custa aplicar capoto por m²?'

async function renderPage(page: Promise<ReactElement> | ReactElement): Promise<{ texte: string; jsonLd: string }> {
  const { container } = render(await page)
  // Texte lu sur une copie : une page dont le JSON-LD est un enfant direct de la racine (/pt/especialidades/) ne doit pas
  // perdre ce nœud avant son démontage par React.
  const copia = container.cloneNode(true) as HTMLElement
  const scripts = Array.from(copia.querySelectorAll('script[type="application/ld+json"]'))
  const jsonLd = scripts.map((s) => s.textContent ?? '').join('\n')
  scripts.forEach((s) => s.remove())
  return { texte: (copia.textContent ?? '').replace(/\s+/g, ' '), jsonLd }
}

/** Format portugais des montants de la page (virgule décimale, espace des milliers). */
const euros = (n: number) => {
  const [inteiro, decimal] = n.toFixed(2).split('.')
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decimal === '00' ? milhares : `${milhares},${decimal}`
}

/**
 * Toutes les chaînes d'une source de contenu PT, avec leur chemin. Un élément de tableau est nommé par son slug, sa
 * question ou son titre quand il en a un (chemin stable si l'ordre change).
 */
function textos(valor: unknown, origem: string): { origem: string; texto: string }[] {
  if (typeof valor === 'string') return [{ origem, texto: valor }]
  if (Array.isArray(valor)) {
    return valor.flatMap((v, i) => {
      const o = (v ?? {}) as Record<string, unknown>
      const nome = [o.slug, o.question, o.pergunta, o.heading, o.titulo].find((n) => typeof n === 'string') ?? i
      return textos(v, `${origem}[${String(nome)}]`)
    })
  }
  if (valor && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => textos(v, `${origem}.${k}`))
  return []
}

/** Braga, Aveiro et Ovar : réponse sans prix le 27/10, même prix que le reste de la grille depuis le 28/10/2026. */
const BRAGA_AVEIRO_OVAR = CITIES.filter((c) => c.distrito !== 'Porto' && c.slug !== 'agueda').map((c) => c.slug)

describe('prix réel du capoto (27/10/2026, mêmes prix à Braga, Aveiro et Ovar le 28/10/2026)', () => {
  it('les montants écrits sont la simple multiplication de la fourchette réelle', () => {
    expect(COM_IVA).toBe(`entre ${euros(53 * 1.06)} € e ${euros(58 * 1.23)} € por m²`)
    expect(EXEMPLO_150).toBe(`${euros(150 * 53)} a ${euros(150 * 58)} €, sem IVA (${euros(150 * 53 * 1.06)} a ${euros(150 * 58 * 1.23)} € com IVA)`)
  })

  it('données PT : toute mention d’un prix du capoto au m² donne la zone, le prix réel, sans IVA, ce qu’il comprend et le prix avec IVA', () => {
    // Toutes les sources de texte des pages PT : métiers (FAQ, descriptions…), articles, villes (dont serviceCityOverrides :
    // intro, secoes, respostas), pages de district et de concelho, textes de méthode, preuves locales.
    const blocs = [
      ...textos(SERVICES, 'SERVICES'),
      ...textos(BLOG_ARTICLES, 'BLOG_ARTICLES'),
      ...textos(CITIES, 'CITIES'),
      ...textos(SERVICOS_DISTRITO, 'SERVICOS_DISTRITO'),
      ...textos(SERVICOS_CONCELHO, 'SERVICOS_CONCELHO'),
      ...textos(METODOS_METIER, 'METODOS_METIER'),
      ...textos(provas, 'local-proof.json'),
    ]
    expect(blocs.length).toBeGreaterThan(1000)
    // Le motif reconnaît les formes courantes d'un prix au m².
    for (const forma of ['53 € por m²', '53€/m²', '53 €/m2', '53 € o m²', '53 euros por metro quadrado']) expect(forma, forma).toMatch(PRECO_M2)
    const precosCapoto = blocs.filter(({ texto }) => FALA_DE_CAPOTO.test(texto) && PRECO_M2.test(texto))
    expect(precosCapoto.map((b) => b.origem).sort((a, b) => a.localeCompare(b))).toEqual([
      `BLOG_ARTICLES[${ARTIGO_CAPOTO}].sections[Preços do capoto em 2026].content`,
      `BLOG_ARTICLES[${ARTIGO_HUMIDADE}].sections[Custos de tratamento da humidade].content`,
      `SERVICES[isolamento-termico].faqs[${PERGUNTA}].answer`,
    ])
    for (const { origem, texto } of precosCapoto) {
      expect(texto, origem).toMatch(/no distrito do Porto e nos concelhos de Braga, Aveiro, Ovar e Águeda, a equipa VITFIX/i)
      expect(texto, origem).toContain(PRECO)
      expect(texto, origem).toMatch(/com IVA/i)
      expect(texto, origem).toContain(COM_IVA)
      expect(texto, origem).toContain(RESERVA)
      for (const antigo of ANTIGOS) expect(texto, origem).not.toContain(antigo)
    }
  })

  it('pages /pt/especialidades/ et /pt/precos/ (hub et guides) : aucun prix du capoto au m²', async () => {
    const paginas: [string, Promise<ReactElement> | ReactElement][] = [
      ['/pt/especialidades/', EspecialidadesPage()],
      ['/pt/precos/', PrecosHubPage()],
      ...guiasPrecos().map(({ slug }): [string, Promise<ReactElement>] => [`/pt/precos/${slug}/`, PrecosServicePage(params(slug))]),
    ]
    for (const [url, pagina] of paginas) {
      const { texte } = await renderPage(pagina)
      // /pt/especialidades/ parle du capoto (carte « Capoto ETICS ») : le contrôle y porte vraiment.
      if (url === '/pt/especialidades/') expect(texte).toMatch(FALA_DE_CAPOTO)
      expect(FALA_DE_CAPOTO.test(texte) && PRECO_M2.test(texte), url).toBe(false)
    }
  })

  it('FAQ du métier isolamento-termico : zone, prix avec IVA dans la première phrase, verbas 2.27 et 2.23, exemple de 150 m²', () => {
    const resposta = ISOLAMENTO?.faqs.find((f) => f.question === PERGUNTA)?.answer ?? ''
    expect(resposta.startsWith(PRIMEIRA_FRASE)).toBe(true)
    expect(resposta).toContain('A taxa é de 23% (taxa normal) ou de 6% em certas obras da Lista I do Código do IVA, como as da ' + VERBA_2_27)
    expect(resposta).toContain('ou as da verba 2.23 (reabilitação de edifícios em área de reabilitação urbana)')
    expect(resposta).toContain(`Para 150 m² de fachada, a simples multiplicação dá ${EXEMPLO_150}; é uma conta, não um orçamento.`)
    expect(resposta).not.toContain('valor global da obra')
  })

  it('FAQ « O isolamento térmico paga-se a si próprio? » : plus de délai de retour calculé sur l’ancienne fourchette', () => {
    const resposta = ISOLAMENTO?.faqs.find((f) => f.question === 'O isolamento térmico paga-se a si próprio?')?.answer ?? ''
    expect(resposta).not.toMatch(/recupera-se|anos/)
    expect(resposta).not.toContain('500€ a 1 000€')
    expect(resposta).toContain('valoriza o imóvel ao melhorar a sua classe energética')
  })

  it('pages métier x ville isolamento-termico : prix et zone sur les 22 villes, aucun Offer dans le JSON-LD', async () => {
    const combos = getAllPageCombos().filter((c) => c.service.slug === 'isolamento-termico')
    expect(combos).toHaveLength(22)
    for (const c of combos) {
      const { texte, jsonLd } = await renderPage(ServiceCityPage(params(c.slug)))
      expect(texte, c.slug).toContain(PRIMEIRA_FRASE)
      expect(texte, c.slug).toContain(EXEMPLO_150)
      expect(texte, c.slug).not.toContain(RESPOSTA_SEM_PRECO_RETIRADA)
      for (const antigo of ANTIGOS) expect(texte, c.slug).not.toContain(antigo)
      // JSON-LD : Service + BreadcrumbList, sans prix ni Offer (règle du schéma PT : pas d'Offer sans prix réel visible).
      expect(jsonLd, c.slug).toContain('"@type":"Service"')
      expect(jsonLd, c.slug).not.toMatch(/"offers"|"price"|40€|80€/)
    }
  })

  it('Braga, Aveiro et Ovar : même prix depuis le 28/10/2026, plus aucune réponse sans prix', async () => {
    expect([...BRAGA_AVEIRO_OVAR].sort((a, b) => a.localeCompare(b))).toEqual(['aveiro', 'braga', 'ovar'])
    for (const slug of BRAGA_AVEIRO_OVAR) {
      const city = CITIES.find((c) => c.slug === slug)
      expect(city?.serviceCityOverrides?.['isolamento-termico'], slug).toBeUndefined()
      const { texte } = await renderPage(ServiceCityPage(params(`isolamento-termico-${slug}`)))
      expect(texte, slug).toContain(PRIMEIRA_FRASE)
      expect(texte, slug).not.toContain(RESPOSTA_SEM_PRECO_RETIRADA)
    }
  })

  it('pas de bloc « Preços praticados » sur la grille : son gabarit n’afficherait ni « sem IVA » ni le prix avec IVA', async () => {
    // Le bloc lirait la fourchette de local-proof.json sous le titre du métier entier (« isolamento térmico e capoto »), sans
    // la prestation, ce qu'elle comprend ni l'IVA, sur les 22 villes : entrée non ajoutée tant que le gabarit ne change pas.
    expect(precoPara('isolamento-termico')).toBeNull()
    const { texte } = await renderPage(ServiceCityPage(params('isolamento-termico-porto')))
    expect(texte).not.toContain('Preços praticados')
  })

  it('hub /pt/perto-de-mim/isolamento-termico/ : réponse « Quanto custa… » au nouveau prix, avec la zone de l’équipe', async () => {
    const { texte, jsonLd } = await renderPage(HubMetierPage(params('isolamento-termico')))
    expect(texte).toContain(PRIMEIRA_FRASE)
    for (const antigo of ANTIGOS) expect(texte).not.toContain(antigo)
    expect(jsonLd).not.toMatch(/"offers"|"price"/)
  })

  it(`article ${ARTIGO_CAPOTO} : section des prix réécrite, plus de totaux de référence, IVA des incentivos alignée, JSON-LD au même prix`, async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage(params(ARTIGO_CAPOTO)))
    expect(texte).toContain(PRIMEIRA_FRASE)
    expect(texte).toContain(VERBA_2_27)
    expect(texte).toContain(`Para uma moradia com 150 m² de fachada, a simples multiplicação dá ${EXEMPLO_150}`)
    expect(texte).toContain(RESERVA)
    // Taux du continent (CIVA art. 18.º n.º 1) ; les Açores et Madère peuvent fixer les leurs (n.º 3).
    expect(texte).toContain('No continente, a taxa reduzida de IVA de 6% só se aplica a certas obras')
    expect(texte).toContain('Nos Açores e na Madeira, as Assembleias Legislativas regionais podem fixar taxas reduzidas próprias (Código do IVA, artigo 18.º, n.º 3).')
    for (const antigo of ANTIGOS) {
      expect(texte, antigo).not.toContain(antigo)
      expect(jsonLd, antigo).not.toContain(antigo)
    }
    expect(texte).not.toContain('apartamento (fachada correspondente)')
    expect(texte).not.toContain('valor global da obra')
    // articleBody (5 000 premiers caractères) : la section des prix y tient, au même prix que la page.
    expect(jsonLd).toContain(PRECO)
    expect(jsonLd).toContain(COM_IVA)
    expect(jsonLd).toContain('"dateModified":"2026-10-28"')
  })

  it(`article ${ARTIGO_HUMIDADE} : capoto au prix réel avec la zone et les trois cas d’IVA, autres prix de la section inchangés`, async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage(params(ARTIGO_HUMIDADE)))
    expect(texte).toContain(`Isolamento térmico pelo exterior (capoto): no distrito do Porto e nos concelhos de Braga, Aveiro, Ovar e Águeda, a equipa VITFIX aplica-o por ${PRECO}`)
    expect(texte).toContain(`a que acresce o IVA aplicável à obra: 23%, 6% em certas obras, ou 6% sobre a mão de obra e 23% sobre os materiais (com IVA, ${COM_IVA})`)
    expect(texte).not.toContain('40€ e 80€')
    expect(texte).toContain('Tratamento de condensação (ventilação, extratores): entre 200€ e 800€.')
    expect(texte).toContain('Injeção contra capilaridade: entre 50€ e 100€ por metro linear.')
    expect(jsonLd).toContain('"dateModified":"2026-10-28"')
  })

  it('dates : DATA_PRECO_CAPOTO sur les 22 pages et le hub isolamento-termico, dateModified des deux articles, rien d’autre', () => {
    expect(DATA_PRECO_CAPOTO).toBe('2026-10-28')
    for (const slug of [ARTIGO_CAPOTO, ARTIGO_HUMIDADE]) expect(BLOG_ARTICLES.find((a) => a.slug === slug)?.dateModified, slug).toBe(DATA_PRECO_CAPOTO)
    const urls = Object.values(sitemapsPt(BASE)).flat()
    const datadas = urls.filter((u) => u.lastModified === DATA_PRECO_CAPOTO).map((u) => u.url.replace(BASE, '')).sort((a, b) => a.localeCompare(b))
    const attendues = [
      ...getAllPageCombos().filter((c) => c.service.slug === 'isolamento-termico').map((c) => `/pt/servicos/${c.slug}/`),
      '/pt/perto-de-mim/isolamento-termico/',
      `/pt/blog/${ARTIGO_CAPOTO}/`,
      `/pt/blog/${ARTIGO_HUMIDADE}/`,
    ].sort((a, b) => a.localeCompare(b))
    expect(datadas).toEqual(attendues)
    // La date la plus récente l'emporte, pour isolamento-termico seulement.
    expect(comPrecoCapoto('isolamento-termico', '2026-10-14')).toBe(DATA_PRECO_CAPOTO)
    expect(comPrecoCapoto('isolamento-termico', '2099-01-01')).toBe('2099-01-01')
    expect(comPrecoCapoto('pintor', '2026-10-14')).toBe('2026-10-14')
  })
})
