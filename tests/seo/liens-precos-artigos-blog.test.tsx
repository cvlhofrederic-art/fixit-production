// tests/seo/liens-precos-artigos-blog.test.tsx
//
// Guides de prix PT (app/pt/precos/[slug]) : la section « Artigos
// relacionados » liait 9 slugs d'articles jamais publiés ou retirés
// (/pt/blog/como-desentupir-canos/ en 404, /pt/blog/seguranca-eletrica-casa/
// redirigé vers le hub…). Correctif à la cause : chaque carte vise un article
// publié du registre BLOG_ARTICLES (celui de generateStaticParams de
// /pt/blog/[slug]) ou, faute d'article proche, le hub /pt/blog/.
// Le titre affiché des cartes ne change pas (aucune modification visible).

import { describe, it, expect, vi } from 'vitest'
import { render, within } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import PrecosServicePage, { generateStaticParams } from '@/app/pt/precos/[slug]/page'
import { BLOG_ARTICLES } from '@/lib/data/seo-pages-data'

const ARTICLES_PUBLIES = new Set(BLOG_ARTICLES.map((a) => a.slug))

async function cartesArtigos(slug: string): Promise<{ href: string; titre: string }[]> {
  const { container } = render(await PrecosServicePage({ params: Promise.resolve({ slug }) }))
  const section = Array.from(container.querySelectorAll('section'))
    .find((s) => within(s as HTMLElement).queryByText('Artigos relacionados'))
  expect(section).toBeDefined()
  return Array.from((section as HTMLElement).querySelectorAll('a')).map((a) => ({
    href: a.getAttribute('href') ?? '',
    titre: a.querySelector('h3')?.textContent ?? '',
  }))
}

describe('guides de prix PT : articles liés', () => {
  const guides = generateStaticParams().map(({ slug }) => slug)

  it.each(guides)('%s : chaque carte vise un article publié ou le hub /pt/blog/', async (slug) => {
    const cartes = await cartesArtigos(slug)
    expect(cartes.length).toBe(3)
    const invalides = cartes.filter(({ href }) => {
      if (href === '/pt/blog/') return false
      const m = /^\/pt\/blog\/([^/]+)\/$/.exec(href)
      return !m || !ARTICLES_PUBLIES.has(m[1])
    })
    expect(invalides).toEqual([])
  })

  it.each([
    ['canalizador', [
      ['como desentupir canos', '/pt/blog/cano-entupido-como-resolver/'],
      ['poupar agua casa', '/pt/blog/'],
      ['sinais fuga agua', '/pt/blog/fuga-agua-como-agir/'],
    ]],
    ['eletricista', [
      ['seguranca eletrica casa', '/pt/blog/'],
      ['certificacao eletrica', '/pt/blog/'],
      ['paineis solares portugal', '/pt/blog/'],
    ]],
    ['pintor', [
      ['como escolher tinta', '/pt/blog/'],
      ['preparar paredes pintura', '/pt/blog/'],
      ['humidade paredes solucoes', '/pt/blog/humidade-parede-causas-reparacao/'],
    ]],
  ])('%s : titres inchangés, cibles finales', async (slug, attendu) => {
    const cartes = await cartesArtigos(slug)
    expect(cartes.map(({ titre, href }) => [titre, href])).toEqual(attendu)
  })
})
