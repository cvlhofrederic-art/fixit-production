// tests/seo/pt-prix-facade-sur-devis.test.tsx
//
// Décision du propriétaire du 23/10/2026 : « Pas de prix, devis » pour la peinture et la rénovation de façade
// (pages /pt/servicos/renovacao-de-fachadas/ et /pt/servicos/trabalhos-verticais/, facteurs de prix sans chiffre).
// Ce test vérifie le HTML rendu des pages qui publiaient des fourchettes de façade : plus aucun prix de façade, les
// autres prix intacts, et la règle de couleur de façade de l'article obras-sem-licenca-portugal conforme au RJUE en
// vigueur (DL 555/99 republié par le DL 108/2026, en vigueur le 01/10/2026 : changer la cor du revestimento exterior est
// une obra de alteração, art. 2.º d), soumise à licença ou à comunicação prévia, art. 4.º, sauf obra de escassa
// relevância urbanística qualifiée par le règlement municipal, art. 6.º-A n.º 1 i)).
//
// Relecture du 23/10/2026 : le détecteur ne coupe plus les phrases après « : » (le format « libellé: prix » de
// l'article humidade passait inaperçu) ; l'articleBody du JSON-LD des articles est coupé à 5 000 caractères
// (app/pt/blog/[slug]/page.tsx) et s'arrête avant la section des coûts de l'article humidade, d'où un contrôle sur les
// données de l'article ; la carte pintor du hub /pt/precos/ suit le nombre de lignes du guide.

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import PrecosServicePage, { generateMetadata as metadataPrecos, generateStaticParams as guidesPrecos } from '@/app/pt/precos/[slug]/page'
import PrecosHubPage from '@/app/pt/precos/page'
import BlogArticlePage from '@/app/pt/blog/[slug]/page'
import { BLOG_ARTICLES } from '@/lib/data/seo-pages-data'

interface PageRendue {
  /** Conteneur rendu, sans les scripts JSON-LD. */
  container: HTMLElement
  /** Texte visible de la page, sans le JSON-LD. */
  texte: string
  /** Phrases visibles : une par ligne de tableau, et chaque élément feuille découpé en phrases. */
  frases: string[]
  /** JSON-LD de la page (articleBody compris). */
  jsonLd: string
}

/**
 * Fin de phrase. Pas de coupure après « : » : le libellé d'un prix (« Impermeabilização de fachada completa: ») serait
 * séparé de son montant (« entre 15€ e 30€ por m². ») et le prix de façade passerait inaperçu.
 */
const FIM_DE_FRASE = /(?<=[.;!?])\s+/

async function renderPage(page: Promise<ReactElement>): Promise<PageRendue> {
  const { container } = render(await page)
  const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
  const jsonLd = scripts.map((s) => s.textContent ?? '').join('\n')
  scripts.forEach((s) => s.remove())
  const blocs = Array.from(container.querySelectorAll('*'))
    .filter((el) => el.tagName === 'TR' || el.children.length === 0)
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
  return {
    container,
    texte: (container.textContent ?? '').replace(/\s+/g, ' '),
    frases: blocs.flatMap((bloc) => bloc.split(FIM_DE_FRASE)),
    jsonLd,
  }
}

/** Phrases qui citent « fachada » avec un montant en euros (« 8 - 15€/m² », « entre 15€ e 30€ »). */
function prixDeFachada(frases: string[]): string[] {
  return frases.filter((frase) => /fachada/i.test(frase) && /\d\s*€|€\s*\d/.test(frase))
}

/**
 * Phrases des données d'un article (intro, titres et textes des sections) : source du HTML rendu et de l'articleBody du
 * JSON-LD, quelle que soit la longueur à laquelle ce dernier est coupé.
 */
function frasesDoArtigo(slug: string): string[] {
  const artigo = BLOG_ARTICLES.find((a) => a.slug === slug)
  expect(artigo, slug).toBeDefined()
  return [artigo?.intro ?? '', ...(artigo?.sections ?? []).flatMap((s) => [s.heading, s.content])].flatMap((t) => t.split(FIM_DE_FRASE))
}

describe('décision du 23/10/2026 : façade sur devis', () => {
  it('le détecteur repère les prix de façade publiés avant la décision, y compris au format « libellé: prix »', () => {
    expect(prixDeFachada(['Pintura exterior fachada por m² 8 - 15€/m²'])).toHaveLength(1)
    expect(prixDeFachada('A pintura completa fica entre 800 e 1500€. Para fachadas exteriores, o custo é superior (8-15€/m²) devido à necessidade de andaimes.'.split(FIM_DE_FRASE)))
      .toEqual(['Para fachadas exteriores, o custo é superior (8-15€/m²) devido à necessidade de andaimes.'])
    expect(prixDeFachada('Injeção contra capilaridade: entre 50€ e 100€ por metro linear. Impermeabilização de fachada completa: entre 15€ e 30€ por m². Pintura de fachada: entre 10€ e 20€ por m².'.split(FIM_DE_FRASE)))
      .toEqual(['Impermeabilização de fachada completa: entre 15€ e 30€ por m².', 'Pintura de fachada: entre 10€ e 20€ por m².'])
  })

  it('/pt/precos/pintor/ : plus de ligne ni de fourchette de façade, prix intérieurs inchangés', async () => {
    const { texte, frases } = await renderPage(PrecosServicePage({ params: Promise.resolve({ slug: 'pintor' }) }))
    expect(prixDeFachada(frases)).toEqual([])
    expect(texte).not.toContain('Pintura exterior fachada')
    expect(texte).not.toContain('8-15€')
    expect(texte).not.toContain('8 - 15€')
    for (const [servico, preco] of [
      ['Pintura interior por m²', '5 - 10€/m²'],
      ['Pintura de divisão (12-15m²)', '150 - 300€'],
      ['Pintura apartamento T2 completo', '800 - 1500€'],
      ['Tratamento anti-humidade + pintura', '15 - 25€/m²'],
      ['Lacagem de portas (unidade)', '40 - 80€'],
      ['Aplicação de massa corrida', '5 - 8€/m²'],
      ['Aplicação de estuque', '10 - 18€/m²'],
      ['Pintura de teto', '6 - 12€/m²'],
    ]) {
      expect(texte).toContain(servico)
      expect(texte).toContain(preco)
    }
    expect(texte).toContain('A pintura de fachadas exteriores não tem preço de tabela')
    expect(texte).toContain('orçamento gratuito (página Renovação de fachadas, no distrito do Porto)')
    const metadata = await metadataPrecos({ params: Promise.resolve({ slug: 'pintor' }) })
    expect(metadata.description).toContain('8 serviços')
  })

  it('/pt/precos/ : chaque carte annonce autant de services que le tableau de son guide (pintor : 8), aucun prix de façade', async () => {
    const { container, frases } = await renderPage(Promise.resolve(PrecosHubPage()))
    expect(prixDeFachada(frases)).toEqual([])
    const servicos: Record<string, number> = {}
    for (const { slug } of guidesPrecos()) {
      const carte = container.querySelector(`a[href="/pt/precos/${slug}/"]`)
      expect(carte, slug).not.toBeNull()
      const rotulo = Array.from(carte?.querySelectorAll('span') ?? []).find((s) => s.textContent === 'Serviços')
      servicos[slug] = Number(rotulo?.nextElementSibling?.textContent)
      // La description du guide compte les lignes de son tableau (`${guide.prices.length} serviços`).
      const metadata = await metadataPrecos({ params: Promise.resolve({ slug }) })
      expect(metadata.description, slug).toContain(`: ${servicos[slug]} serviços`)
    }
    expect(servicos.pintor).toBe(8)
  })

  it('article humidade-parede-causas-reparacao : plus de fourchette de façade, condensação, capilaridade et capoto gardés', async () => {
    const slug = 'humidade-parede-causas-reparacao'
    const { texte, frases, jsonLd } = await renderPage(BlogArticlePage({ params: Promise.resolve({ slug }) }))
    expect(prixDeFachada(frases)).toEqual([])
    // L'articleBody du JSON-LD s'arrête à 5 000 caractères, avant la section des coûts : contrôle sur les données.
    const donnees = frasesDoArtigo(slug)
    expect(prixDeFachada(donnees)).toEqual([])
    for (const corpus of [texte, donnees.join(' ')]) {
      expect(corpus).not.toContain('Impermeabilização de fachada completa')
      expect(corpus).not.toContain('Reparação de infiltrações pontuais')
      expect(corpus).not.toContain('Reparação e pintura de paredes danificadas')
    }
    expect(texte).toContain('Tratamento de condensação (ventilação, extratores): entre 200€ e 800€.')
    expect(texte).toContain('Injeção contra capilaridade: entre 50€ e 100€ por metro linear.')
    // Capoto : prix réel de l'équipe VITFIX depuis le 27/10/2026 (tests/seo/pt-preco-capoto.test.tsx), plus de fourchette 40-80 €.
    expect(texte).not.toContain('entre 40€ e 80€')
    expect(texte).toContain('Isolamento térmico pelo exterior (capoto): no distrito do Porto e nos concelhos de Braga, Aveiro, Ovar e Águeda, a equipa VITFIX aplica-o por 53 a 58 € por m², sem IVA, com material e mão de obra')
    expect(texte).toContain('Na fachada, a reparação de fissuras e de infiltrações, a impermeabilização e a pintura não têm preço de tabela')
    expect(jsonLd).toContain('"dateModified":"2026-10-28"')
  })

  it('article obras-sem-licenca-portugal : couleur de façade = obra de alteração, coimas du RJUE en vigueur', async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage({ params: Promise.resolve({ slug: 'obras-sem-licenca-portugal' }) }))
    expect(texte).not.toContain('Pintar a fachada com cor diferente: comunicação prévia')
    expect(texte).toContain('Pintar a fachada com uma cor diferente: mudar a cor do revestimento exterior é uma obra de alteração, que pode precisar de licença ou de comunicação prévia')
    // Section « Licença » : réserve du règlement municipal (art. 6.º-A n.º 1 i)). Elle tient dans l'articleBody du JSON-LD
    // (coupé à 5 000 caractères), que reçoivent les moteurs de réponse sans l'exemple prudent de la dernière section.
    for (const corpus of [texte, jsonLd]) {
      expect(corpus).toContain('mudar a cor da fachada, salvo se o regulamento municipal qualificar a obra como de escassa relevância urbanística (artigo 6.º-A, n.º 1, alínea i))')
    }
    // Obras de conservação : peinture à l'identique seulement (art. 2.º d) et f)).
    expect(texte).toContain('como pintar com a mesma cor ou reparar a canalização')
    // Comunicação prévia : plateforme nationale pas vérifiable comme en service (art. 8.º-A) ; ineptidão obligatoire (art. 35.º n.º 8).
    expect(texte).not.toContain('Plataforma Eletrónica de Licenciamentos Urbanísticos')
    expect(texte).toContain('apresentada por via eletrónica (artigo 35.º, n.º 1), na plataforma que a câmara indicar')
    expect(texte).toContain('tem de declarar a comunicação inepta')
    expect(texte).not.toContain('pode declarar a comunicação inepta')
    expect(texte).toContain('artigo 80.º-A')
    // Coimas : 500 € à 200 000 € pour une pessoa singular (art. 98.º, n.º 2), plus « 500€ a 5 000€ ».
    expect(texte).not.toContain('5 000€')
    expect(texte).toContain('coima de 500€ a 200 000€ para uma pessoa singular')
    // Plus de délais de décision inventés ni d'horaires du samedi.
    expect(texte).not.toMatch(/entre 20 e 60 dias|entre 30 e 120 dias|sábados/)
    expect(jsonLd).toContain('"dateModified":"2026-10-23"')
  })

  it('dateModified des deux articles modifiés : 23/10/2026 (humidade : 28/10/2026, prix réel du capoto, zone élargie)', () => {
    expect(BLOG_ARTICLES.find((a) => a.slug === 'obras-sem-licenca-portugal')?.dateModified).toBe('2026-10-23')
    expect(BLOG_ARTICLES.find((a) => a.slug === 'humidade-parede-causas-reparacao')?.dateModified).toBe('2026-10-28')
  })
})
