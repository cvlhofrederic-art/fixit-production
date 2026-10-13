// Sitemaps PT (phase 1 du plan SEO PT, point 1.1 ; phase 2, point 2.2) : source unique des URL PT,
// découpée par modèle pour suivre l'indexation dans Google Search Console sans le plafond de
// 1000 lignes.
//
// Un seul sitemap par URL : les fichiers /pt/sitemap-*.xml sont les seuls à déclarer des URL
// PT (plus de /sitemap/1.xml, plus de lignes PT dans /sitemap/0.xml). /pt/sitemap.xml est
// l'index de ces fichiers, soumis à la propriété GSC `https://vitfix.io/pt/`, et /sitemap.xml
// les référence directement (Google n'accepte pas un index dans un index).
//
// Phase 2 (consolidation, décision 1 option A) : une seule URL par couple métier x ville, le modèle
// servicos. Les 946 pages urgencia et perto-de-mim métier x ville et le hub picheleiro répondent 301
// (middleware.ts, lib/seo/pt-consolidacao.ts) et ne sont plus déclarées ; les 21 hubs métier ont leur propre fichier.
//
// Règles : jamais d'URL noindex (pages juridiques exclues), jamais d'URL redirigée, `lastmod`
// = date réelle de dernière modification significative (lib/seo/pt-datas.ts), jamais la date
// de build ; pas de changefreq ni de priority (ignorés par Google).

import { type SitemapUrl } from './sitemap-helpers'
import { DATAS_PT, DATA_FASE_2, DATA_FASE_3 } from './seo/pt-datas'
import { getAllPageCombos, BLOG_ARTICLES, CITIES, SERVICES } from './data/seo-pages-data'

export type GroupeSitemapPt = 'servicos' | 'hubs' | 'cidades' | 'blog' | 'paginas'

/** Fichiers PT, dans l'ordre de l'index. */
export const FICHIERS_SITEMAP_PT: Record<GroupeSitemapPt, string> = {
  servicos: '/pt/sitemap-servicos.xml',
  hubs: '/pt/sitemap-hubs.xml',
  cidades: '/pt/sitemap-cidades.xml',
  blog: '/pt/sitemap-blog.xml',
  paginas: '/pt/sitemap-paginas.xml',
}

/** Pages statiques PT indexables (hors sitemap : les 4 pages juridiques en noindex, /pt/mercados/gerir/). */
export const PAGINAS_ESTATICAS_PT = [
  '/pt/',
  '/pt/pesquisar/',
  '/pt/avaliacoes/',
  '/pt/servicos/',
  '/pt/urgencia/',
  '/pt/perto-de-mim/',
  '/pt/como-funciona/',
  '/pt/torne-se-parceiro/',
  '/pt/profissionais-verificados/',
  '/pt/especialidades/',
  '/pt/condominio/',
  '/pt/simulador-orcamento/',
  '/pt/mercados/publicar/',
  '/pt/mapa-do-site/',
  '/pt/sobre/',
  '/pt/contacto/',
  '/pt/precos/',
  '/pt/precos/canalizador/',
  '/pt/precos/eletricista/',
  '/pt/precos/pintor/',
] as const

/** Pages statiques dont le contenu a changé en phase 2 (hubs de section réécrits) et pas depuis. */
const PAGINAS_FASE_2 = new Set<string>(['/pt/perto-de-mim/'])

/**
 * Pages statiques dont le contenu a changé en phase 3 (lot 0) ou 4 : avis fictifs retirés, liens, plan,
 * disponibilités et temps de réponse rétablis sur /pt/urgencia/.
 */
const PAGINAS_FASE_3 = new Set<string>([
  '/pt/', '/pt/servicos/', '/pt/cidade/', '/pt/urgencia/', '/pt/mapa-do-site/', '/pt/profissionais-verificados/',
  '/pt/torne-se-parceiro/', '/pt/sobre/', '/pt/como-funciona/', '/pt/condominio/', '/pt/especialidades/',
  '/pt/precos/canalizador/', '/pt/precos/eletricista/', '/pt/precos/pintor/',
])

/** Sitemaps PT par groupe. */
export function sitemapsPt(baseUrl: string): Record<GroupeSitemapPt, SitemapUrl[]> {
  const url = (path: string, lastModified: string): SitemapUrl => ({ url: `${baseUrl}${path}`, lastModified })

  const servicos = getAllPageCombos().map(combo => url(`/pt/servicos/${combo.slug}/`, DATAS_PT.servicos))

  const hubs = SERVICES.map(service => url(`/pt/perto-de-mim/${service.slug}/`, DATAS_PT.hubs))

  const cidades = [url('/pt/cidade/', DATAS_PT.cidades), ...CITIES.map(city => url(`/pt/cidade/${city.slug}/`, DATAS_PT.cidades))]

  // Articles : date propre à chaque article (dateModified, sinon datePublished) ; l'index /pt/blog/ porte
  // la date de la phase 1 (title et description changés). Jamais une date unique pour tout le blog.
  const blog = [url('/pt/blog/', DATAS_PT.blog), ...BLOG_ARTICLES.map(article => url(`/pt/blog/${article.slug}/`, article.dateModified ?? article.datePublished))]

  const paginas = PAGINAS_ESTATICAS_PT.map(path => url(path, PAGINAS_FASE_3.has(path) ? DATA_FASE_3 : PAGINAS_FASE_2.has(path) ? DATA_FASE_2 : DATAS_PT.paginas))

  return { servicos, hubs, cidades, blog, paginas }
}

/** Toutes les URL PT indexables (union des fichiers). */
export function getAllPtSitemapUrls(baseUrl: string): SitemapUrl[] {
  const groupes = sitemapsPt(baseUrl)
  return (Object.keys(FICHIERS_SITEMAP_PT) as GroupeSitemapPt[]).flatMap(groupe => groupes[groupe])
}

/** URL absolues des fichiers PT, pour les index. */
export function urlsFichiersSitemapPt(baseUrl: string): string[] {
  return (Object.keys(FICHIERS_SITEMAP_PT) as GroupeSitemapPt[]).map(groupe => `${baseUrl}${FICHIERS_SITEMAP_PT[groupe]}`)
}
