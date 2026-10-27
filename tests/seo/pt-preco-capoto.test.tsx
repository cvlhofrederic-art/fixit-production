// tests/seo/pt-preco-capoto.test.tsx
//
// Prix réel du capoto (27/10/2026). Le propriétaire confirme que son équipe pose du capoto neuf (isolamento térmico pelo
// exterior, sistema ETICS, pose complète) pour 53 à 58 € par m², matériel et main-d'œuvre compris, sans IVA. Ce prix
// remplace les fourchettes de référence non sourcées (40-80 €/m² et les totaux qui en découlaient) dans la FAQ « Quanto
// custa aplicar capoto por m²? » du métier isolamento-termico (22 pages métier x ville et hub), l'article
// capoto-isolamento-termico-quanto-custa et l'article humidade-parede-causas-reparacao.
//
// Affichage au consommateur, vérifié le 27/10/2026 sur les textes en vigueur :
// - DL 138/90 (redação do DL 162/99), art. 1.º n.º 5 : le prix inclut « todos os impostos, taxas e outros encargos » ;
//   art. 6.º n.º 1 : la publicité qui mentionne un prix indique « o preço total […], incluindo taxas e impostos » ;
// - DL 57/2008, art. 10.º c) (redação do DL 109-G/2021) : dans un convite a contratar, le prix « incluindo impostos e
//   taxas » ou, s'il ne peut être calculé à l'avance, « o modo como o preço é calculado » ;
// - Código do IVA, art. 18.º n.º 1 : 6 % pour la Lista I, 23 % sinon (continent) ; verba 2.27 : la taxa reduzida ne couvre
//   pas les materiais incorporados au-delà de 20 % du valor global ; verba 2.23 : reabilitação de edifícios em ARU.
// Le taux dépend donc de l'obra : chaque mention donne le prix sans IVA, ce qu'il comprend, la règle d'IVA et le prix avec
// IVA entre ses deux bornes (53 × 1,06 et 58 × 1,23), sans affirmer quel taux s'applique.

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import ServiceCityPage from '@/app/pt/servicos/[slug]/page'
import HubMetierPage from '@/app/pt/perto-de-mim/[slug]/page'
import BlogArticlePage from '@/app/pt/blog/[slug]/page'
import { BLOG_ARTICLES, SERVICES, getAllPageCombos } from '@/lib/data/seo-pages-data'
import { comPrecoCapoto, sitemapsPt } from '@/lib/sitemap-pt-pages'
import { DATA_PRECO_CAPOTO } from '@/lib/seo/pt-datas'
import { precoPara } from '@/lib/seo/pt-provas-locais'

const BASE = 'https://vitfix.io'
const params = (slug: string) => ({ params: Promise.resolve({ slug }) })

/** Le prix tel que le propriétaire l'a donné, dit en entier à chaque mention. */
const PRECO = '53 a 58 € por m², sem IVA, com material e mão de obra'
/** Prix avec IVA entre ses deux bornes : taxa reduzida (6 %) sur le bas, taxa normal (23 %) sur le haut. */
const COM_IVA = 'entre 56,18 € e 71,34 € por m²'
/** Exemple : simple multiplication par une surface nommée, jamais un devis. */
const EXEMPLO_150 = '7 950 a 8 700 €, sem IVA (8 427 a 10 701 € com IVA)'
const RESERVA = 'preço final depende da espessura do isolamento, do estado e do acesso da fachada'
/** Fourchettes et totaux de référence retirés. */
const ANTIGOS = ['40€ e 80€', '6 000€ e 12 000€', '2 000€ e 5 000€', '8 000€ a 10 000€', 'mais de 2 anos', 'geralmente 6 a 10 cm']

const ARTIGO_CAPOTO = 'capoto-isolamento-termico-quanto-custa'
const ARTIGO_HUMIDADE = 'humidade-parede-causas-reparacao'
const ISOLAMENTO = SERVICES.find((s) => s.slug === 'isolamento-termico')

async function renderPage(page: Promise<ReactElement>): Promise<{ texte: string; jsonLd: string }> {
  const { container } = render(await page)
  const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
  const jsonLd = scripts.map((s) => s.textContent ?? '').join('\n')
  scripts.forEach((s) => s.remove())
  return { texte: (container.textContent ?? '').replace(/\s+/g, ' '), jsonLd }
}

/** Format portugais des montants de la page (virgule décimale, espace des milliers). */
const euros = (n: number) => {
  const [inteiro, decimal] = n.toFixed(2).split('.')
  const milhares = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return decimal === '00' ? milhares : `${milhares},${decimal}`
}

describe('prix réel du capoto (27/10/2026)', () => {
  it('les montants écrits sont la simple multiplication de la fourchette réelle', () => {
    expect(COM_IVA).toBe(`entre ${euros(53 * 1.06)} € e ${euros(58 * 1.23)} € por m²`)
    expect(EXEMPLO_150).toBe(`${euros(150 * 53)} a ${euros(150 * 58)} €, sem IVA (${euros(150 * 53 * 1.06)} a ${euros(150 * 58 * 1.23)} € com IVA)`)
  })

  it('données : toute mention d’un prix du capoto au m² donne le prix réel, sans IVA, ce qu’il comprend et le prix avec IVA', () => {
    const blocs = [
      ...SERVICES.flatMap((s) => s.faqs.map((f) => ({ origem: `${s.slug} : ${f.question}`, texto: f.answer }))),
      ...BLOG_ARTICLES.flatMap((a) => [a.intro, ...a.sections.map((s) => s.content)].map((texto) => ({ origem: a.slug, texto }))),
    ]
    const precosCapoto = blocs.filter(({ texto }) => /capoto|ETICS|pelo exterior/i.test(texto) && /€\s*(?:por|\/)\s*m²/.test(texto))
    expect(precosCapoto.map((b) => b.origem).sort((a, b) => a.localeCompare(b))).toEqual([
      ARTIGO_CAPOTO,
      ARTIGO_HUMIDADE,
      'isolamento-termico : Quanto custa aplicar capoto por m²?',
    ])
    for (const { origem, texto } of precosCapoto) {
      expect(texto, origem).toContain(PRECO)
      expect(texto, origem).toMatch(/com IVA/i)
      expect(texto, origem).toContain(COM_IVA)
      expect(texto, origem).toContain(RESERVA)
      for (const antigo of ANTIGOS) expect(texto, origem).not.toContain(antigo)
    }
  })

  it('FAQ du métier isolamento-termico : prix, règle d’IVA (verbas 2.23 et 2.27), exemple de 150 m² qui n’est pas un orçamento', () => {
    const resposta = ISOLAMENTO?.faqs.find((f) => f.question === 'Quanto custa aplicar capoto por m²?')?.answer ?? ''
    expect(resposta).toContain(`A equipa VITFIX aplica capoto (sistema ETICS) por ${PRECO} (preços de outubro de 2026).`)
    expect(resposta).toContain('23% (taxa normal) ou 6% em certas obras da Lista I do Código do IVA')
    expect(resposta).toContain('com os materiais incorporados a 23% quando passam de 20% do valor global da obra')
    expect(resposta).toContain('verba 2.23 (reabilitação de edifícios em área de reabilitação urbana)')
    expect(resposta).toContain(`Para 150 m² de fachada, a simples multiplicação dá ${EXEMPLO_150}; é uma conta, não um orçamento.`)
  })

  it('les 22 pages métier x ville isolamento-termico : nouveau prix dans la FAQ, plus de 40-80 €, aucun Offer dans le JSON-LD', async () => {
    const combos = getAllPageCombos().filter((c) => c.service.slug === 'isolamento-termico')
    expect(combos).toHaveLength(22)
    for (const c of combos) {
      const { texte, jsonLd } = await renderPage(ServiceCityPage(params(c.slug)))
      expect(texte, c.slug).toContain(PRECO)
      expect(texte, c.slug).toContain(COM_IVA)
      expect(texte, c.slug).toContain(EXEMPLO_150)
      for (const antigo of ANTIGOS) expect(texte, c.slug).not.toContain(antigo)
      // JSON-LD : Service + BreadcrumbList, sans prix ni Offer (règle du schéma PT : pas d'Offer sans prix réel visible).
      expect(jsonLd, c.slug).toContain('"@type":"Service"')
      expect(jsonLd, c.slug).not.toMatch(/"offers"|"price"|40€|80€/)
    }
  })

  it('pas de bloc « Preços praticados » sur la grille : son gabarit n’afficherait ni « sem IVA » ni le prix avec IVA', async () => {
    // Le bloc lirait la fourchette de local-proof.json sous le titre du métier entier (« isolamento térmico e capoto »), sans
    // la prestation, ce qu'elle comprend ni l'IVA, sur les 22 villes : entrée non ajoutée tant que le gabarit ne change pas.
    expect(precoPara('isolamento-termico')).toBeNull()
    const { texte } = await renderPage(ServiceCityPage(params('isolamento-termico-porto')))
    expect(texte).not.toContain('Preços praticados')
  })

  it('hub /pt/perto-de-mim/isolamento-termico/ : réponse « Quanto custa… » au nouveau prix', async () => {
    const { texte, jsonLd } = await renderPage(HubMetierPage(params('isolamento-termico')))
    expect(texte).toContain(PRECO)
    expect(texte).toContain(COM_IVA)
    for (const antigo of ANTIGOS) expect(texte).not.toContain(antigo)
    expect(jsonLd).not.toMatch(/"offers"|"price"/)
  })

  it(`article ${ARTIGO_CAPOTO} : section des prix réécrite, plus de totaux de référence, IVA des incentivos alignée, JSON-LD au même prix`, async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage(params(ARTIGO_CAPOTO)))
    expect(texte).toContain(PRECO)
    expect(texte).toContain(COM_IVA)
    expect(texte).toContain(`Para uma moradia com 150 m² de fachada, a simples multiplicação dá ${EXEMPLO_150}`)
    expect(texte).toContain(RESERVA)
    expect(texte).toContain('A taxa reduzida de IVA de 6% só se aplica a certas obras')
    for (const antigo of ANTIGOS) {
      expect(texte, antigo).not.toContain(antigo)
      expect(jsonLd, antigo).not.toContain(antigo)
    }
    expect(texte).not.toContain('apartamento (fachada correspondente)')
    // articleBody (5 000 premiers caractères) : la section des prix y tient, au même prix que la page.
    expect(jsonLd).toContain(PRECO)
    expect(jsonLd).toContain('"dateModified":"2026-10-27"')
  })

  it(`article ${ARTIGO_HUMIDADE} : capoto au prix réel, autres prix de la section inchangés`, async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage(params(ARTIGO_HUMIDADE)))
    expect(texte).toContain(`Isolamento térmico pelo exterior (capoto): na VITFIX, ${PRECO}`)
    expect(texte).toContain(`(com IVA, ${COM_IVA})`)
    expect(texte).not.toContain('40€ e 80€')
    expect(texte).toContain('Tratamento de condensação (ventilação, extratores): entre 200€ e 800€.')
    expect(texte).toContain('Injeção contra capilaridade: entre 50€ e 100€ por metro linear.')
    expect(jsonLd).toContain('"dateModified":"2026-10-27"')
  })

  it('dates : DATA_PRECO_CAPOTO sur les 22 pages et le hub isolamento-termico, dateModified des deux articles, rien d’autre', () => {
    expect(DATA_PRECO_CAPOTO).toBe('2026-10-27')
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
