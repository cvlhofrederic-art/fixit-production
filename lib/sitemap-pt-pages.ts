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
import { DATAS_PT, DATA_CORRECOES_FAQ, DATA_FASE_2, DATA_FASE_3, DATA_FASE_3_LOT_1, DATA_PAGINAS_AGUEDA, DATA_PRECO_CAPOTO, DATA_PRECOS_PINTOR, DATA_ZONA_DISTRITOS } from './seo/pt-datas'
import { METIERS_URGENCIA } from './seo/pt-meta'
import { getAllPageCombos, BLOG_ARTICLES, CITIES, SERVICES } from './data/seo-pages-data'
import { SERVICOS_DISTRITO, cobreDistrito, servicosDistritoLigados, servicosDistritoRelacionados, paginasConcelhoDistrito, dataModificacaoDistrito, dataLigacoesGrelha, dataLigacoesServicos } from './data/pt-servicos-distrito'
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

/**
 * Pages statiques modifiées après leur phase, avec leur propre date (prioritaire sur les ensembles ci-dessus) :
 * /pt/precos/pintor/, prix de façade retirés (décision du propriétaire du 23/10/2026), puis phrase qui situe la page
 * renovação de fachadas dans les trois distritos (DATA_ZONA_DISTRITOS) ; /pt/precos/, dont la carte pintor suit le nombre
 * de lignes du guide (9 → 8 services), inchangée depuis.
 */
const PAGINAS_DATA_PROPRIA: Readonly<Record<string, string>> = {
  '/pt/precos/pintor/': DATA_ZONA_DISTRITOS,
  '/pt/precos/': DATA_PRECOS_PINTOR,
}

/** Pages statiques qui lient les pages de district (section de /pt/servicos/, entrée du plan du site). */
const PAGINAS_LIGACOES_DISTRITO = new Set<string>(['/pt/servicos/', '/pt/mapa-do-site/'])

/** Concelhos qui ont des pages de service propres (Águeda) : leurs pages métier x ville et leur page ville ont changé avec elles. */
const CIDADES_PAGINAS_CONCELHO = new Set(SERVICOS_CONCELHO.map(s => s.cidade))

/** La plus récente de ces dates (AAAA-MM-JJ), les vides ignorées. */
const maisRecente = (datas: string[]): string => [...datas].filter(Boolean).sort((a, b) => a.localeCompare(b)).at(-1) ?? ''

/** Date d'une page métier x ville hors Águeda et hors liens de district : FAQ poda-arvores corrigée, sinon lot 1 ou groupe. */
function dataMetier(metier: string, dataGrupo: string): string {
  return metier === 'poda-arvores' ? DATA_CORRECOES_FAQ : dataLote1(metier, dataGrupo)
}

/** Hubs dont la réponse « Quanto custa… » a changé (DATA_CORRECOES_FAQ). */
const HUBS_FAQ_CORRIGIDA = new Set(['poda-arvores', 'faz-tudo'])

/**
 * Date d'un hub métier : liens vers des pages de district (date des liens de la plus récente qu'il lie), sinon FAQ
 * corrigée, sinon lot 1 ou date du groupe.
 */
function dataHub(metier: string): string {
  const ligados = servicosDistritoLigados(metier)
  if (ligados.length) return dataLigacoesServicos(ligados)
  if (HUBS_FAQ_CORRIGIDA.has(metier)) return DATA_CORRECOES_FAQ
  return dataLote1(metier, DATAS_PT.hubs)
}

/**
 * Métier isolamento-termico : sa réponse « Quanto custa aplicar capoto por m²? » porte le prix réel du capoto
 * (DATA_PRECO_CAPOTO) et la zone de l'équipe (DATA_ZONA_DISTRITOS : « Nos distritos do Porto, Braga e Aveiro »), affichée sur
 * ses pages métier x ville et sur son hub. La date la plus récente l'emporte.
 */
export function comPrecoCapoto(metier: string, data: string): string {
  return metier === 'isolamento-termico' ? maisRecente([data, DATA_PRECO_CAPOTO, DATA_ZONA_DISTRITOS]) : data
}

/** Lot 1 (phase 3) : date du lot 1 pour une page d'un métier d'urgence, sinon la date du groupe. */
export function dataLote1(metier: string, dataGrupo: string): string {
  return METIERS_URGENCIA.has(metier) ? DATA_FASE_3_LOT_1 : dataGrupo
}

/** Dates d'OUVERTURE des pages concelho de ces services dans ce concelho : les liens pointent alors vers elles. */
function aberturasConcelho(cidade: string, servicos?: string[]): string[] {
  return paginasConcelhoDistrito()
    .filter((p) => p.city.slug === cidade && (!servicos || servicos.includes(p.servico.slug)))
    .map((p) => p.dataAbertura)
}

/**
 * Date d'une page ville qui lie des services de district (tous par défaut ; en pratique ceux qui couvrent son distrito) :
 * la dernière modification de ces liens ou de leur texte (titre et résumé des pages, champ `dataLigacoes`), ou la date
 * d'OUVERTURE de la page concelho vers laquelle le lien pointe désormais. Un chantier ajouté plus tard à une page concelho
 * ouverte ne change pas ces pages : leur lien et son ancre restent les mêmes.
 */
export function dataLigacoesConcelho(cidade: string, servicos?: string[]): string {
  const escolhidos = SERVICOS_DISTRITO.filter((s) => !servicos || servicos.includes(s.slug))
  return maisRecente([dataLigacoesServicos(escolhidos), ...aberturasConcelho(cidade, servicos)])
}

/**
 * Date d'une page métier x ville qui lie ces services de district : le jour où ces liens sont apparus sur les pages de la
 * grille du distrito de la ville (champ `dataLigacoesGrelha`, le plus récent des services liés), ou la date d'ouverture de la
 * page concelho visée. L'ancre ne reprend que le nom du service et le distrito de la ville : un changement de titre ou de
 * zone des pages de district ne change pas ces pages (celles du distrito do Porto gardent leur date le 28/10/2026). Une page
 * qui ne lie que limpeza de telhados garde sa date quand une autre page de district est publiée.
 */
export function dataLigacoesGrelhaConcelho(cidade: string, servicos: string[]): string {
  const distrito = CITIES.find((c) => c.slug === cidade)?.distrito ?? ''
  const escolhidos = SERVICOS_DISTRITO.filter((s) => servicos.includes(s.slug))
  return maisRecente([dataLigacoesGrelha(escolhidos, distrito), ...aberturasConcelho(cidade, servicos)])
}

/**
 * Date d'une page métier x ville : la date des liens quand la page lie une page de district (métier lié, distrito couvert par
 * la page) ; à Águeda, la plus récente de cette date et de celle des pages de service du concelho ; sinon correction
 * poda-arvores, lot 1 ou groupe. Les liens de district propres à la page (poda-arvores-agueda, 28/10/2026) l'emportent
 * s'ils sont plus récents.
 */
function dataPaginaServico(metier: string, cidade: string, distrito: string): string {
  const ligados = servicosDistritoLigados(metier, distrito)
  const ligacoes = ligados.length ? dataLigacoesGrelhaConcelho(cidade, ligados.map((s) => s.slug)) : ''
  const proprias = dataLigacoesDistritoProprias(metier, cidade, distrito)
  if (CIDADES_PAGINAS_CONCELHO.has(cidade)) return maisRecente([DATA_PAGINAS_AGUEDA, ligacoes, proprias])
  return maisRecente([ligacoes || dataMetier(metier, DATAS_PT.servicos), proprias])
}

/**
 * Liens propres à un couple métier x ville vers des pages de district (CityData.serviceCityOverrides[métier].servicosDistrito,
 * ex. poda-arvores-agueda → limpeza de telhados) : jour de leur ajout (`dataServicosDistrito`), ou date d'ouverture de la page
 * concelho visée. Vide sans tels liens.
 */
function dataLigacoesDistritoProprias(metier: string, cidade: string, distrito: string): string {
  const override = CITIES.find((c) => c.slug === cidade)?.serviceCityOverrides?.[metier]
  const servicos = servicosDistritoRelacionados(override?.servicosDistrito, distrito).map((s) => s.slug)
  return servicos.length ? maisRecente([override?.dataServicosDistrito ?? '', ...aberturasConcelho(cidade, servicos)]) : ''
}

/**
 * Date d'une page statique : /pt/mapa-do-site/ lie les pages de district et celles d'Águeda (la plus récente des dates),
 * /pt/servicos/ les pages de district (date des liens de la plus récente) ; une page de PAGINAS_DATA_PROPRIA, sa date ;
 * sinon la phase qui l'a réécrite.
 */
function dataPaginaEstatica(path: string): string {
  const propria = PAGINAS_DATA_PROPRIA[path]
  if (propria) return propria
  const ligacoes = dataLigacoesServicos(SERVICOS_DISTRITO)
  if (path === '/pt/mapa-do-site/') return maisRecente([ligacoes, DATA_PAGINAS_AGUEDA])
  if (PAGINAS_LIGACOES_DISTRITO.has(path)) return ligacoes
  if (PAGINAS_FASE_3.has(path)) return DATA_FASE_3
  return PAGINAS_FASE_2.has(path) ? DATA_FASE_2 : DATAS_PT.paginas
}

/** Sitemaps PT par groupe. */
export function sitemapsPt(baseUrl: string): Record<GroupeSitemapPt, SitemapUrl[]> {
  const url = (path: string, lastModified: string): SitemapUrl => ({ url: `${baseUrl}${path}`, lastModified })

  // Lot 1 (phase 3) : les pages des métiers d'urgence (toutes depuis la décision du 14/10) changent de titre,
  // de description et d'en-tête et portent la date du lot 1 ; un métier retiré de la liste garderait la date du lot 0.
  // Pages de district (lib/data/pt-servicos-distrito.ts) et pages de service d'un concelho (lib/data/pt-servicos-concelho.ts,
  // Águeda) : même fichier que la grille, date propre à chaque page.
  const servicos = [
    ...getAllPageCombos().map(combo => url(`/pt/servicos/${combo.slug}/`, comPrecoCapoto(combo.service.slug, dataPaginaServico(combo.service.slug, combo.city.slug, combo.city.distrito)))),
    // Page de district : sa date, ou celle du dernier chantier ajouté ; pages concelho ouvertes par des chantiers réels.
    ...SERVICOS_DISTRITO.map(servico => url(`/pt/servicos/${servico.slug}/`, dataModificacaoDistrito(servico))),
    ...paginasConcelhoDistrito().map(pagina => url(`/pt/servicos/${pagina.slug}/`, pagina.dataModificacao)),
    // Page de service d'un concelho : sa date, ou celle du dernier chantier publié.
    ...SERVICOS_CONCELHO.map(servico => url(`/pt/servicos/${servico.slug}/`, dataModificacaoConcelho(servico))),
  ]

  // Hubs des metiersLigados : liens vers les pages de district ; hubs poda-arvores et faz-tudo : FAQ corrigée ; hub
  // isolamento-termico : prix réel du capoto dans sa réponse « Quanto custa… ».
  const hubs = SERVICES.map(service => url(`/pt/perto-de-mim/${service.slug}/`, comPrecoCapoto(service.slug, dataHub(service.slug))))

  // Les pages ville d'un distrito couvert par des services de district les lient (carte « Serviços disponíveis ») : date des
  // liens ; la page ville d'un concelho qui a des pages de service propres (Águeda : freguesias corrigées, section qui les
  // lie) prend la plus récente de cette date et de celle de ses pages.
  const dataCidade = (city: { slug: string; distrito: string }): string => {
    const doDistrito = SERVICOS_DISTRITO.filter((s) => cobreDistrito(s, city.distrito)).map((s) => s.slug)
    const ligacoes = doDistrito.length ? dataLigacoesConcelho(city.slug, doDistrito) : ''
    if (CIDADES_PAGINAS_CONCELHO.has(city.slug)) return maisRecente([DATA_PAGINAS_AGUEDA, ligacoes])
    return ligacoes || DATAS_PT.cidades
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
