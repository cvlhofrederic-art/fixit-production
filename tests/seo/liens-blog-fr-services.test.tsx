// tests/seo/liens-blog-fr-services.test.tsx
//
// Les articles du blog FR (app/fr/blog/[slug]) lient les pages services
// /fr/services/<métier>-<ville>/. Les données des articles portent d'anciennes
// clés (plomberie, electricite, peinture) : les liens visaient donc
// /fr/services/plomberie-marseille/…, que next.config.ts redirige en 308
// (« FR services slug rename: noun → trade name »). Chaque lien doit viser
// une page services publiée (combinaison métier × ville de FR_SERVICES et
// FR_CITIES), sans passer par une redirection.

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.stubEnv('__NEXT_TRAILING_SLASH', 'true')

import FrBlogArticlePage, { generateStaticParams } from '@/app/fr/blog/[slug]/page'
import { getFrPageCombo } from '@/lib/data/fr-seo-pages-data'

async function liensServices(slug: string): Promise<string[]> {
  const { container } = render(await FrBlogArticlePage({ params: Promise.resolve({ slug }) }))
  return Array.from(container.querySelectorAll('a[href^="/fr/services/"]')).map((a) => a.getAttribute('href') ?? '')
}

describe('blog FR : liens vers les pages services', () => {
  const articles = generateStaticParams().map(({ slug }) => slug)

  it('le blog FR publie des articles', () => {
    expect(articles.length).toBeGreaterThan(0)
  })

  it.each(articles)('article %s : chaque lien services vise une page publiée', async (slug) => {
    const hrefs = await liensServices(slug)
    expect(hrefs.length).toBeGreaterThan(0)
    const invalides = hrefs.filter((href) => {
      const m = /^\/fr\/services\/([^/]+)\/$/.exec(href)
      return !m || getFrPageCombo(m[1]) === null
    })
    expect(invalides).toEqual([])
  })

  it('urgence-plomberie : les liens Marseille et villes visent plombier-<ville>', async () => {
    const hrefs = await liensServices('urgence-plomberie')
    expect(hrefs).toEqual(expect.arrayContaining([
      '/fr/services/plombier-marseille/',
      '/fr/services/plombier-aix-en-provence/',
      '/fr/services/plombier-martigues/',
    ]))
  })
})
