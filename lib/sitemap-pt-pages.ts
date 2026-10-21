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
import { DATAS_PT, DATA_FASE_2, DATA_FASE_3, DATA_FASE_3_LOT_1, DATA_LIGACOES_DISTRITO } from './seo/pt-datas'
import { METIERS_URGENCIA } from './seo/pt-meta'
import { getAllPageCombos, BLOG_ARTICLES, CITIES, SERVICES } from './data/seo-pages-data'
import { SERVICOS_DISTRITO, servicosDistritoLigados, paginasConcelhoDistrito, dataModificacaoDistrito } from './data/pt-servicos-distrito'

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

/** Pages statiques qui lient les pages de district (section de /pt/servicos/, entrée du plan du site). */
const PAGINAS_LIGACOES_DISTRITO = new Set<string>(['/pt/servicos/', '/pt/mapa-do-site/'])

/** Lot 1 (phase 3) : date du lot 1 pour une page d'un métier d'urgence, sinon la date du groupe. */
export function dataLote1(metier: string, dataGrupo: string): string {
  return METIERS_URGENCIA.has(metier) ? DATA_FASE_3_LOT_1 : dataGrupo
}

/**
 * Date d'une page qui lie des services de district dans un concelho (page métier x ville : ses services liés ; page ville :
 * tous les services du distrito) : la date d'ajout des liens, ou la date d'OUVERTURE de la page concelho vers laquelle
 * le lien pointe désormais. Un chantier ajouté plus tard à une page concelho ouverte ne change pas ces pages : leur lien
 * et son ancre restent les mêmes.
 */
export function dataLigacoesConcelho(cidade: string, servicos?: string[]): string {
  const aberturas = paginasConcelhoDistrito()
    .filter((p) => p.city.slug === cidade && (!servicos || servicos.includes(p.servico.slug)))
    .map((p) => p.dataAbertura)
  return [DATA_LIGACOES_DISTRITO, ...aberturas].sort((a, b) => a.localeCompare(b)).at(-1) ?? DATA_LIGACOES_DISTRITO
}

/** Sitemaps PT par groupe. */
export function sitemapsPt(baseUrl: string): Record<GroupeSitemapPt, SitemapUrl[]> {
  const url = (path: string, lastModified: string): SitemapUrl => ({ url: `${baseUrl}${path}`, lastModified })
  const ligaDistrito = (distrito: string) => SERVICOS_DISTRITO.some((s) => s.distrito === distrito)

  // Lot 1 (phase 3) : les pages des métiers d'urgence (toutes depuis la décision du 14/10) changent de titre,
  // de description et d'en-tête et portent la date du lot 1 ; un métier retiré de la liste garderait la date du lot 0.
  // Pages de district (lib/data/pt-servicos-distrito.ts) : même fichier que la grille, date propre à chaque page.
  const servicos = [
    // Les pages métier x ville qui lient une page de district (même métier lié, même distrito) en prennent la date.
    ...getAllPageCombos().map(combo => url(`/pt/servicos/${combo.slug}/`, servicosDistritoLigados(combo.service.slug, combo.city.distrito).length ? dataLigacoesConcelho(combo.city.slug, servicosDistritoLigados(combo.service.slug, combo.city.distrito).map((s) => s.slug)) : dataLote1(combo.service.slug, DATAS_PT.servicos))),
    // Page de district : sa date, ou celle du dernier chantier ajouté ; pages concelho ouvertes par des chantiers réels.
    ...SERVICOS_DISTRITO.map(servico => url(`/pt/servicos/${servico.slug}/`, dataModificacaoDistrito(servico))),
    ...paginasConcelhoDistrito().map(pagina => url(`/pt/servicos/${pagina.slug}/`, pagina.dataModificacao)),
  ]

  const hubs = SERVICES.map(service => url(`/pt/perto-de-mim/${service.slug}/`, servicosDistritoLigados(service.slug).length ? DATA_LIGACOES_DISTRITO : dataLote1(service.slug, DATAS_PT.hubs)))

  // Les pages ville d'un distrito qui a des services de district les lient (carte « Serviços disponíveis ») : même date.
  const cidades = [url('/pt/cidade/', DATAS_PT.cidades), ...CITIES.map(city => url(`/pt/cidade/${city.slug}/`, ligaDistrito(city.distrito) ? dataLigacoesConcelho(city.slug) : DATAS_PT.cidades))]

  // Articles : date propre à chaque article (dateModified, sinon datePublished) ; l'index /pt/blog/ porte
  // la date de la phase 1 (title et description changés). Jamais une date unique pour tout le blog.
  const blog = [url('/pt/blog/', DATAS_PT.blog), ...BLOG_ARTICLES.map(article => url(`/pt/blog/${article.slug}/`, article.dateModified ?? article.datePublished))]

  const paginas = PAGINAS_ESTATICAS_PT.map(path => url(path, PAGINAS_LIGACOES_DISTRITO.has(path) ? DATA_LIGACOES_DISTRITO : PAGINAS_FASE_3.has(path) ? DATA_FASE_3 : PAGINAS_FASE_2.has(path) ? DATA_FASE_2 : DATAS_PT.paginas))

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
