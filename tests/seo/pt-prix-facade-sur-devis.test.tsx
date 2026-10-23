// tests/seo/pt-prix-facade-sur-devis.test.tsx
//
// Décision du propriétaire du 23/10/2026 : « Pas de prix, devis » pour la peinture et la rénovation de façade
// (pages /pt/servicos/renovacao-de-fachadas/ et /pt/servicos/trabalhos-verticais/, facteurs de prix sans chiffre).
// Ce test vérifie le HTML rendu des pages qui publiaient des fourchettes de façade : plus aucun prix de façade, les
// autres prix intacts, et la règle de couleur de façade de l'article obras-sem-licenca-portugal conforme au RJUE en
// vigueur (DL 555/99 republié par le DL 108/2026, en vigueur le 01/10/2026 : changer la cor du revestimento exterior est
// une obra de alteração, art. 2.º d), soumise à licença ou à comunicação prévia, art. 4.º).

import { describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import PrecosServicePage, { generateMetadata as metadataPrecos } from '@/app/pt/precos/[slug]/page'
import BlogArticlePage from '@/app/pt/blog/[slug]/page'
import { BLOG_ARTICLES } from '@/lib/data/seo-pages-data'

interface PageRendue {
  /** Texte visible de la page, sans le JSON-LD. */
  texte: string
  /** Phrases visibles : une par ligne de tableau, et chaque élément feuille découpé en phrases. */
  frases: string[]
  /** JSON-LD de la page (articleBody compris). */
  jsonLd: string
}

/** Fin de phrase dans un texte visible, ou saut de ligne échappé dans le JSON-LD. */
const FIM_DE_FRASE = /(?<=[.:;!?])\s+|\\n/

async function renderPage(page: Promise<ReactElement>): Promise<PageRendue> {
  const { container } = render(await page)
  const scripts = Array.from(container.querySelectorAll('script[type="application/ld+json"]'))
  const jsonLd = scripts.map((s) => s.textContent ?? '').join('\n')
  scripts.forEach((s) => s.remove())
  const blocs = Array.from(container.querySelectorAll('*'))
    .filter((el) => el.tagName === 'TR' || el.children.length === 0)
    .map((el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim())
  return {
    texte: (container.textContent ?? '').replace(/\s+/g, ' '),
    frases: blocs.flatMap((bloc) => bloc.split(FIM_DE_FRASE)),
    jsonLd,
  }
}

/** Phrases qui citent « fachada » avec un montant en euros (« 8 - 15€/m² », « entre 15€ e 30€ »). */
function prixDeFachada(frases: string[]): string[] {
  return frases.filter((frase) => /fachada/i.test(frase) && /\d\s*€|€\s*\d/.test(frase))
}

describe('décision du 23/10/2026 : façade sur devis', () => {
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

  it('article humidade-parede-causas-reparacao : plus de fourchette de façade, condensação, capilaridade et capoto gardés', async () => {
    const { texte, frases, jsonLd } = await renderPage(BlogArticlePage({ params: Promise.resolve({ slug: 'humidade-parede-causas-reparacao' }) }))
    expect(prixDeFachada(frases)).toEqual([])
    expect(prixDeFachada(jsonLd.split(FIM_DE_FRASE))).toEqual([])
    for (const corpus of [texte, jsonLd]) {
      expect(corpus).not.toContain('Impermeabilização de fachada completa')
      expect(corpus).not.toContain('Reparação de infiltrações pontuais')
      expect(corpus).not.toContain('Reparação e pintura de paredes danificadas')
    }
    expect(texte).toContain('Tratamento de condensação (ventilação, extratores): entre 200€ e 800€.')
    expect(texte).toContain('Injeção contra capilaridade: entre 50€ e 100€ por metro linear.')
    expect(texte).toContain('Isolamento térmico pelo exterior (capoto): entre 40€ e 80€ por m².')
    expect(texte).toContain('Na fachada, a reparação de fissuras e de infiltrações, a impermeabilização e a pintura não têm preço de tabela')
    expect(jsonLd).toContain('"dateModified":"2026-10-23"')
  })

  it('article obras-sem-licenca-portugal : couleur de façade = obra de alteração, coimas du RJUE en vigueur', async () => {
    const { texte, jsonLd } = await renderPage(BlogArticlePage({ params: Promise.resolve({ slug: 'obras-sem-licenca-portugal' }) }))
    expect(texte).not.toContain('Pintar a fachada com cor diferente: comunicação prévia')
    expect(texte).toContain('Pintar a fachada com uma cor diferente: mudar a cor do revestimento exterior é uma obra de alteração, que pode precisar de licença ou de comunicação prévia')
    expect(texte).toContain('artigo 80.º-A')
    // Coimas : 500 € à 200 000 € pour une pessoa singular (art. 98.º, n.º 2), plus « 500€ a 5 000€ ».
    expect(texte).not.toContain('5 000€')
    expect(texte).toContain('coima de 500€ a 200 000€ para uma pessoa singular')
    // Plus de délais de décision inventés ni d'horaires du samedi.
    expect(texte).not.toMatch(/entre 20 e 60 dias|entre 30 e 120 dias|sábados/)
    expect(jsonLd).toContain('"dateModified":"2026-10-23"')
  })

  it('dateModified des deux articles modifiés : 23/10/2026', () => {
    for (const slug of ['humidade-parede-causas-reparacao', 'obras-sem-licenca-portugal']) {
      expect(BLOG_ARTICLES.find((a) => a.slug === slug)?.dateModified, slug).toBe('2026-10-23')
    }
  })
})
