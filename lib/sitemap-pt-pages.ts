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
import { DATAS_PT, DATA_CORRECOES_FAQ, DATA_FASE_2, DATA_FASE_3, DATA_FASE_3_LOT_1, DATA_LIGACOES_DISTRITO, DATA_PAGINAS_AGUEDA } from './seo/pt-datas'
import { METIERS_URGENCIA } from './seo/pt-meta'
import { getAllPageCombos, BLOG_ARTICLES, CITIES, SERVICES } from './data/seo-pages-data'
import { SERVICOS_DISTRITO, servicosDistritoLigados, paginasConcelhoDistrito, dataModificacaoDistrito } from './data/pt-servicos-distrito'
import { SERVICOS_CONCELHO, dataModificacaoConcelho } from './data/pt-servicos-concelho'

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

/** Concelhos qui ont des pages de service propres (Águeda) : leurs pages métier x ville et leur page ville ont changé avec elles. */
const CIDADES_PAGINAS_CONCELHO = new Set(SERVICOS_CONCELHO.map(s => s.cidade))

/** Date d'une page métier x ville hors Águeda et hors liens de district : FAQ poda-arvores corrigée, sinon lot 1 ou groupe. */
function dataMetier(metier: string, dataGrupo: string): string {
  return metier === 'poda-arvores' ? DATA_CORRECOES_FAQ : dataLote1(metier, dataGrupo)
}

/** Hubs dont la réponse « Quanto custa… » a changé (DATA_CORRECOES_FAQ). */
const HUBS_FAQ_CORRIGIDA = new Set(['poda-arvores', 'faz-tudo'])

/** Date d'un hub métier : liens vers une page de district, sinon FAQ corrigée, sinon lot 1 ou date du groupe. */
function dataHub(metier: string): string {
  if (servicosDistritoLigados(metier).length) return DATA_LIGACOES_DISTRITO
  if (HUBS_FAQ_CORRIGIDA.has(metier)) return DATA_CORRECOES_FAQ
  return dataLote1(metier, DATAS_PT.hubs)
}

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

/**
 * Date d'une page métier x ville : celle des pages de service du concelho quand la ville en a (Águeda) ; la date des liens
 * quand la page lie une page de district (même métier lié, même distrito) ; sinon correction poda-arvores, lot 1 ou groupe.
 */
function dataPaginaServico(metier: string, cidade: string, distrito: string): string {
  if (CIDADES_PAGINAS_CONCELHO.has(cidade)) return DATA_PAGINAS_AGUEDA
  const ligados = servicosDistritoLigados(metier, distrito)
  return ligados.length ? dataLigacoesConcelho(cidade, ligados.map((s) => s.slug)) : dataMetier(metier, DATAS_PT.servicos)
}

/**
 * Date d'une page statique : /pt/mapa-do-site/ lie les pages de district et celles d'Águeda (la plus récente des deux
 * dates), /pt/servicos/ les pages de district ; sinon la phase qui l'a réécrite.
 */
function dataPaginaEstatica(path: string): string {
  if (path === '/pt/mapa-do-site/') return [DATA_LIGACOES_DISTRITO, DATA_PAGINAS_AGUEDA].sort((a, b) => a.localeCompare(b)).at(-1) ?? DATA_LIGACOES_DISTRITO
  if (PAGINAS_LIGACOES_DISTRITO.has(path)) return DATA_LIGACOES_DISTRITO
  if (PAGINAS_FASE_3.has(path)) return DATA_FASE_3
  return PAGINAS_FASE_2.has(path) ? DATA_FASE_2 : DATAS_PT.paginas
}

/** Sitemaps PT par groupe. */
export function sitemapsPt(baseUrl: string): Record<GroupeSitemapPt, SitemapUrl[]> {
  const url = (path: string, lastModified: string): SitemapUrl => ({ url: `${baseUrl}${path}`, lastModified })
  const ligaDistrito = (distrito: string) => SERVICOS_DISTRITO.some((s) => s.distrito === distrito)

  // Lot 1 (phase 3) : les pages des métiers d'urgence (toutes depuis la décision du 14/10) changent de titre,
  // de description et d'en-tête et portent la date du lot 1 ; un métier retiré de la liste garderait la date du lot 0.
  // Pages de district (lib/data/pt-servicos-distrito.ts) et pages de service d'un concelho (lib/data/pt-servicos-concelho.ts,
  // Águeda) : même fichier que la grille, date propre à chaque page.
  const servicos = [
    ...getAllPageCombos().map(combo => url(`/pt/servicos/${combo.slug}/`, dataPaginaServico(combo.service.slug, combo.city.slug, combo.city.distrito))),
    // Page de district : sa date, ou celle du dernier chantier ajouté ; pages concelho ouvertes par des chantiers réels.
    ...SERVICOS_DISTRITO.map(servico => url(`/pt/servicos/${servico.slug}/`, dataModificacaoDistrito(servico))),
    ...paginasConcelhoDistrito().map(pagina => url(`/pt/servicos/${pagina.slug}/`, pagina.dataModificacao)),
    // Page de service d'un concelho : sa date, ou celle du dernier chantier publié.
    ...SERVICOS_CONCELHO.map(servico => url(`/pt/servicos/${servico.slug}/`, dataModificacaoConcelho(servico))),
  ]

  // Hubs telhador et impermeabilizacao : liens vers les pages de district ; hubs poda-arvores et faz-tudo : FAQ corrigée.
  const hubs = SERVICES.map(service => url(`/pt/perto-de-mim/${service.slug}/`, dataHub(service.slug)))

  // La page ville d'un concelho qui a des pages de service propres (freguesias corrigées, section qui les lie) en prend la
  // date ; les pages ville d'un distrito qui a des services de district les lient (carte « Serviços disponíveis ») : date des liens.
  const dataCidade = (city: { slug: string; distrito: string }): string => {
    if (CIDADES_PAGINAS_CONCELHO.has(city.slug)) return DATA_PAGINAS_AGUEDA
    return ligaDistrito(city.distrito) ? dataLigacoesConcelho(city.slug) : DATAS_PT.cidades
  }
  const cidades = [url('/pt/cidade/', DATAS_PT.cidades), ...CITIES.map(city => url(`/pt/cidade/${city.slug}/`, dataCidade(city)))]

  // Articles : date propre à chaque article (dateModified, sinon datePublished) ; l'index /pt/blog/ porte
  // la date de la phase 1 (title et description changés). Jamais une date unique pour tout le blog.
  const blog = [url('/pt/blog/', DATAS_PT.blog), ...BLOG_ARTICLES.map(article => url(`/pt/blog/${article.slug}/`, article.dateModified ?? article.datePublished))]

  const paginas = PAGINAS_ESTATICAS_PT.map(path => url(path, dataPaginaEstatica(path)))

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
