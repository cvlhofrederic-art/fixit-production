// Sitemaps PT (phase 1 du plan SEO PT, point 1.1) : source unique des URL PT, découpée par
// modèle pour suivre l'indexation dans Google Search Console sans le plafond de 1000 lignes.
//
// Un seul sitemap par URL : les fichiers /pt/sitemap-*.xml sont les seuls à déclarer des URL
// PT (plus de /sitemap/1.xml, plus de lignes PT dans /sitemap/0.xml). /pt/sitemap.xml est
// l'index de ces fichiers, soumis à la propriété GSC `https://vitfix.io/pt/`, et /sitemap.xml
// les référence directement (Google n'accepte pas un index dans un index).
//
// Règles : jamais d'URL noindex (pages juridiques exclues), jamais d'URL redirigée, `lastmod`
// = date réelle de dernière modification significative (lib/seo/pt-datas.ts), jamais la date
// de build ; pas de changefreq ni de priority (ignorés par Google).

import { type SitemapUrl } from './sitemap-helpers'
import { DATAS_PT } from './seo/pt-datas'
import {
  getAllPageCombos,
  getAllUrgencyCombos,
  BLOG_ARTICLES,
  CITIES,
  SERVICES,
} from './data/seo-pages-data'

export type GroupeSitemapPt = 'servicos' | 'urgencia' | 'perto-de-mim' | 'cidades' | 'blog' | 'paginas'

/** Fichiers PT, dans l'ordre de l'index. */
export const FICHIERS_SITEMAP_PT: Record<GroupeSitemapPt, string> = {
  servicos: '/pt/sitemap-servicos.xml',
  urgencia: '/pt/sitemap-urgencia.xml',
  'perto-de-mim': '/pt/sitemap-perto-de-mim.xml',
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

/** Sitemaps PT par groupe. */
export function sitemapsPt(baseUrl: string): Record<GroupeSitemapPt, SitemapUrl[]> {
  const url = (path: string, lastModified: string): SitemapUrl => ({ url: `${baseUrl}${path}`, lastModified })

  const servicos = getAllPageCombos().map(combo => url(`/pt/servicos/${combo.slug}/`, DATAS_PT.servicos))
  const urgencia = getAllUrgencyCombos().map(combo => url(`/pt/urgencia/${combo.slug}/`, DATAS_PT.urgencia))

  const pertoDeMim: SitemapUrl[] = []
  for (const service of SERVICES) pertoDeMim.push(url(`/pt/perto-de-mim/${service.slug}/`, DATAS_PT.pertoDeMim))
  for (const service of SERVICES) {
    for (const city of CITIES) pertoDeMim.push(url(`/pt/perto-de-mim/${service.slug}-${city.slug}/`, DATAS_PT.pertoDeMim))
  }
  // Picheleiro : alias de canalizador (variante lexicale du Nord). Doublon à consolider en phase 2.
  pertoDeMim.push(url('/pt/perto-de-mim/picheleiro/', DATAS_PT.pertoDeMim))
  for (const city of CITIES) pertoDeMim.push(url(`/pt/perto-de-mim/picheleiro-${city.slug}/`, DATAS_PT.pertoDeMim))

  const cidades = [url('/pt/cidade/', DATAS_PT.cidades), ...CITIES.map(city => url(`/pt/cidade/${city.slug}/`, DATAS_PT.cidades))]

  const blog = [url('/pt/blog/', DATAS_PT.blog), ...BLOG_ARTICLES.map(article => url(`/pt/blog/${article.slug}/`, DATAS_PT.blog))]

  const paginas = PAGINAS_ESTATICAS_PT.map(path => url(path, DATAS_PT.paginas))

  return { servicos, urgencia, 'perto-de-mim': pertoDeMim, cidades, blog, paginas }
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
