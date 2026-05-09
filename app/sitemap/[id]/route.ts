import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getProfilePath } from '@/lib/utils'
import { formatSitemapXml, parseSitemapId, SITEMAP_HEADERS, type SitemapUrl } from '@/lib/sitemap-helpers'
import {
  getAllPageCombos,
  getAllUrgencyCombos,
  BLOG_ARTICLES,
  CITIES,
  SERVICES,
} from '@/lib/data/seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'
import { EN_SERVICE_PAGES } from '@/lib/data/en-services-data'
import {
  FR_INVESTOR_PAGES,
  NL_INVESTOR_PAGES,
  ES_INVESTOR_PAGES,
} from '@/lib/data/investor-pages-data'
import {
  FR_CITIES,
  FR_SERVICES,
  getAllFrPageCombos,
  getAllFrUrgencyCombos,
} from '@/lib/data/fr-seo-pages-data'

// runtime='nodejs' aligné avec le reste du codebase (cf. app/sitemap.xml/route.ts).
// 'edge' causait un 500 Internal Server Error sur OpenNext + Cloudflare Workers.
export const runtime = 'nodejs'

// ────────────────────────────────────────────────────────────────────────────
// Pro SEO 2026 : lastmod précis par URL, pas de changefreq/priority.
//
// Google ignore <changefreq> et <priority> depuis 2017 (Gary Illyes confirmed).
// Ne fournir QUE des <lastmod> précis et fiables — Google les utilise pour
// prioriser le crawl. Lastmod erronés répétés = signal ignoré entièrement.
// Source : developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
// ────────────────────────────────────────────────────────────────────────────

// Date de dernière refonte majeure du contenu programmatique fallback.
// Bumper manuellement lors d'un refactor structurel (services, villes,
// lexique). Surchargé par city.contentUpdatedAt si disponible (Aveiro pilot).
const CONTENT_LAST_UPDATED = new Date('2026-05-09T00:00:00Z')

const SIM_CITIES = [
  'marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis',
  'martigues', 'allauch', 'salon-de-provence', 'saint-cyr-sur-mer',
  'bandol', 'gemenos', 'sanary-sur-mer', 'six-fours-les-plages',
  'ceyreste', 'la-seyne-sur-mer',
] as const

// ────────────────────────────────────────────────────────────────────────────
// Helpers de résolution lastmod
// ────────────────────────────────────────────────────────────────────────────

/** Résout une date ISO optionnelle vers Date, fallback si absente ou invalide. */
function resolveDate(input: string | undefined, fallback: Date): Date {
  if (!input) return fallback
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? fallback : d
}

/** Lastmod pour un article de blog : dateModified > datePublished. */
function articleLastMod(article: { dateModified?: string, datePublished: string }): Date {
  return resolveDate(article.dateModified ?? article.datePublished, new Date())
}

/** Lastmod pour un combo service × ville PT (utilise city.contentUpdatedAt si présent). */
function ptComboLastMod(citySlug: string, fallback: Date): Date {
  const city = CITIES.find((c) => c.slug === citySlug)
  return resolveDate(city?.contentUpdatedAt, fallback)
}

/** Lastmod pour un combo service × ville FR (FrCityData n'a pas encore contentUpdatedAt). */
function frComboLastMod(_citySlug: string, fallback: Date): Date {
  return fallback
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 0 : pages statiques + hubs
// ────────────────────────────────────────────────────────────────────────────

function staticAndHubPages(baseUrl: string, lastMod: Date): SitemapUrl[] {
  const url = (path: string): SitemapUrl => ({
    url: `${baseUrl}${path}`,
    lastModified: lastMod,
  })
  return [
    url('/'),
    url('/pt/'),
    url('/fr/'),
    url('/fr/recherche/'),
    url('/pt/pesquisar/'),
    url('/pt/avaliacoes/'),
    url('/fr/comment-ca-marche/'),
    url('/fr/devenir-partenaire/'),
    url('/fr/artisans-verifies/'),
    url('/pt/servicos/'),
    url('/pt/blog/'),
    url('/pt/urgencia/'),
    url('/pt/perto-de-mim/'),
    url('/pt/como-funciona/'),
    url('/pt/torne-se-parceiro/'),
    url('/pt/profissionais-verificados/'),
    url('/pt/especialidades/'),
    url('/pt/condominio/'),
    url('/pt/simulador-orcamento/'),
    url('/pt/mercados/publicar/'),
    url('/pt/mercados/gerir/'),
    url('/fr/services/'),
    url('/fr/urgence/'),
    url('/fr/blog/'),
    url('/fr/plan-du-site/'),
    url('/pt/mapa-do-site/'),
    url('/fr/a-propos/'),
    url('/pt/sobre/'),
  ]
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 1 : pages programmatiques PT
// ────────────────────────────────────────────────────────────────────────────

function ptProgrammaticPages(baseUrl: string, fallback: Date): SitemapUrl[] {
  const result: SitemapUrl[] = []

  // Services × cidade combos
  for (const combo of getAllPageCombos()) {
    result.push({
      url: `${baseUrl}/pt/servicos/${combo.slug}/`,
      lastModified: ptComboLastMod(combo.city.slug, fallback),
    })
  }

  // Urgência combos
  for (const combo of getAllUrgencyCombos()) {
    result.push({
      url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
      lastModified: ptComboLastMod(combo.city.slug, fallback),
    })
  }

  // Cidade hubs
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/cidade/${city.slug}/`,
      lastModified: resolveDate(city.contentUpdatedAt, fallback),
    })
  }

  // Perto de mim génériques (par service)
  for (const service of SERVICES) {
    result.push({
      url: `${baseUrl}/pt/perto-de-mim/${service.slug}/`,
      lastModified: fallback,
    })
  }

  // Perto de mim service × cidade
  for (const service of SERVICES) {
    for (const city of CITIES) {
      result.push({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
        lastModified: resolveDate(city.contentUpdatedAt, fallback),
      })
    }
  }

  // Picheleiro alias canalizador
  result.push({
    url: `${baseUrl}/pt/perto-de-mim/picheleiro/`,
    lastModified: fallback,
  })
  for (const city of CITIES) {
    result.push({
      url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
      lastModified: resolveDate(city.contentUpdatedAt, fallback),
    })
  }

  // Preços
  result.push({ url: `${baseUrl}/pt/precos/`, lastModified: fallback })
  for (const slug of ['canalizador', 'eletricista', 'pintor']) {
    result.push({
      url: `${baseUrl}/pt/precos/${slug}/`,
      lastModified: fallback,
    })
  }

  // Blog articles avec dateModified ou datePublished
  for (const article of BLOG_ARTICLES) {
    result.push({
      url: `${baseUrl}/pt/blog/${article.slug}/`,
      lastModified: articleLastMod(article),
    })
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 2 : pages programmatiques FR
// ────────────────────────────────────────────────────────────────────────────

function frProgrammaticPages(baseUrl: string, fallback: Date): SitemapUrl[] {
  const result: SitemapUrl[] = []

  for (const combo of getAllFrPageCombos()) {
    result.push({
      url: `${baseUrl}/fr/services/${combo.slug}/`,
      lastModified: frComboLastMod(combo.city.slug, fallback),
    })
  }

  for (const combo of getAllFrUrgencyCombos()) {
    result.push({
      url: `${baseUrl}/fr/urgence/${combo.slug}/`,
      lastModified: frComboLastMod(combo.city.slug, fallback),
    })
  }

  for (const city of FR_CITIES) {
    result.push({
      url: `${baseUrl}/fr/ville/${city.slug}/`,
      lastModified: fallback,
    })
  }

  for (const service of FR_SERVICES) {
    result.push({
      url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}/`,
      lastModified: fallback,
    })
  }

  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      result.push({
        url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}-${city.slug}/`,
        lastModified: fallback,
      })
    }
  }

  // Hubs spécialisés FR
  for (const path of [
    '/fr/copropriete/',
    '/fr/copropriete/nettoyage-encombrants/',
    '/fr/copropriete/espaces-verts/',
    '/fr/copropriete/plomberie/',
    '/fr/simulateur-devis/',
    '/fr/specialites/',
    '/fr/specialites/elagage-palmier/',
    '/fr/specialites/debroussaillage-paca/',
    '/fr/specialites/debarras-succession/',
    '/fr/specialites/chauffe-eau/',
    '/fr/specialites/fuite-eau-urgence/',
    '/fr/specialites/renovation-salle-de-bain/',
  ]) {
    result.push({ url: `${baseUrl}${path}`, lastModified: fallback })
  }

  for (const city of SIM_CITIES) {
    result.push({
      url: `${baseUrl}/fr/simulateur-devis/${city}/`,
      lastModified: fallback,
    })
  }

  for (const article of FR_BLOG_ARTICLES) {
    result.push({
      url: `${baseUrl}/fr/blog/${article.slug}/`,
      lastModified: articleLastMod(article),
    })
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 3 : pages investisseurs + EN/NL/ES
// ────────────────────────────────────────────────────────────────────────────

function investorAndIntlPages(baseUrl: string, lastMod: Date): SitemapUrl[] {
  const result: SitemapUrl[] = []

  result.push({ url: `${baseUrl}/en/`, lastModified: lastMod })
  for (const page of EN_SERVICE_PAGES) {
    result.push({
      url: `${baseUrl}/en/${page.slug}/`,
      lastModified: lastMod,
    })
  }
  result.push({
    url: `${baseUrl}/en/emergency-home-repair-porto/`,
    lastModified: lastMod,
  })

  for (const page of FR_INVESTOR_PAGES) {
    result.push({
      url: `${baseUrl}/fr/${page.slug}/`,
      lastModified: lastMod,
    })
  }

  result.push({ url: `${baseUrl}/nl/`, lastModified: lastMod })
  for (const page of NL_INVESTOR_PAGES) {
    result.push({
      url: `${baseUrl}/nl/${page.slug}/`,
      lastModified: lastMod,
    })
  }

  result.push({ url: `${baseUrl}/es/`, lastModified: lastMod })
  for (const page of ES_INVESTOR_PAGES) {
    result.push({
      url: `${baseUrl}/es/${page.slug}/`,
      lastModified: lastMod,
    })
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 4 : profils artisans vérifiés (Supabase)
// ────────────────────────────────────────────────────────────────────────────

async function artisanProfilePages(baseUrl: string, fallback: Date): Promise<SitemapUrl[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: artisans } = await supabase
      .from('profiles_artisan')
      .select('id, slug, updated_at, org_role, country')
      .eq('is_verified', true)
    return (artisans || []).map((a) => {
      const isPT = a.country === 'PT' || a.country === 'Portugal'
      const locale = isPT ? 'pt' : 'fr'
      const profilePath = getProfilePath(
        { slug: a.slug, id: a.id, org_role: a.org_role },
        locale,
      )
      const lastModified = a.updated_at ? new Date(a.updated_at) : fallback
      return {
        url: `${baseUrl}${profilePath}/`,
        lastModified,
      }
    })
  } catch {
    return []
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params
  const id = parseSitemapId(idParam)
  if (id === null) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const fallback = CONTENT_LAST_UPDATED

  let urls: SitemapUrl[]
  switch (id) {
    case 0:
      urls = staticAndHubPages(baseUrl, fallback)
      break
    case 1:
      urls = ptProgrammaticPages(baseUrl, fallback)
      break
    case 2:
      urls = frProgrammaticPages(baseUrl, fallback)
      break
    case 3:
      urls = investorAndIntlPages(baseUrl, fallback)
      break
    case 4:
      urls = await artisanProfilePages(baseUrl, fallback)
      break
    default:
      urls = []
  }

  return new Response(formatSitemapXml(urls), { headers: SITEMAP_HEADERS })
}
