import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getProfilePath } from '@/lib/utils'
import { formatSitemapXml, parseSitemapId, SITEMAP_HEADERS, type SitemapUrl } from '@/lib/sitemap-helpers'
import { ptProgrammaticPages } from '@/lib/sitemap-pt-pages'
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
// Et — confirmation John Mueller 2023 — un <lastmod> factice (date du jour
// systématique) est PIRE qu'un sitemap sans <lastmod> du tout : Google
// détecte le pattern et ignore le signal entièrement, voire dégrade la
// priorité de crawl. Politique : on émet `<lastmod>` UNIQUEMENT quand on
// a une vraie date par URL (city.contentUpdatedAt, article.dateModified).
// Sinon, on omet le tag.
// Source : developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
// ────────────────────────────────────────────────────────────────────────────

const SIM_CITIES = [
  'marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis',
  'martigues', 'allauch', 'salon-de-provence', 'saint-cyr-sur-mer',
  'bandol', 'gemenos', 'sanary-sur-mer', 'six-fours-les-plages',
  'ceyreste', 'la-seyne-sur-mer',
] as const

// ────────────────────────────────────────────────────────────────────────────
// Helpers de résolution lastmod (retourne undefined si pas de vraie date)
// ────────────────────────────────────────────────────────────────────────────

function resolveDateOrUndefined(input: string | undefined): Date | undefined {
  if (!input) return undefined
  const d = new Date(input)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** Lastmod pour un article de blog : dateModified > datePublished. */
function articleLastMod(article: { dateModified?: string, datePublished: string }): Date | undefined {
  return resolveDateOrUndefined(article.dateModified ?? article.datePublished)
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 0 : pages statiques + hubs (pas de lastmod — éditorial)
// ────────────────────────────────────────────────────────────────────────────

function staticAndHubPages(baseUrl: string): SitemapUrl[] {
  const url = (path: string): SitemapUrl => ({ url: `${baseUrl}${path}` })
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
// (fonction `ptProgrammaticPages` extraite vers `lib/sitemap-pt-pages.ts`
// pour être partagée avec le sitemap PT dédié `app/pt/sitemap.xml/route.ts`)
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 2 : pages programmatiques FR
// ────────────────────────────────────────────────────────────────────────────

function frProgrammaticPages(baseUrl: string): SitemapUrl[] {
  const result: SitemapUrl[] = []

  for (const combo of getAllFrPageCombos()) {
    result.push({ url: `${baseUrl}/fr/services/${combo.slug}/` })
  }

  for (const combo of getAllFrUrgencyCombos()) {
    result.push({ url: `${baseUrl}/fr/urgence/${combo.slug}/` })
  }

  for (const city of FR_CITIES) {
    result.push({ url: `${baseUrl}/fr/ville/${city.slug}/` })
  }

  for (const service of FR_SERVICES) {
    result.push({ url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}/` })
  }

  for (const service of FR_SERVICES) {
    for (const city of FR_CITIES) {
      result.push({ url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}-${city.slug}/` })
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
    result.push({ url: `${baseUrl}${path}` })
  }

  for (const city of SIM_CITIES) {
    result.push({ url: `${baseUrl}/fr/simulateur-devis/${city}/` })
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
// Sub-sitemap 3 : pages investisseurs + EN/NL/ES (pas de lastmod)
// ────────────────────────────────────────────────────────────────────────────

function investorAndIntlPages(baseUrl: string): SitemapUrl[] {
  const result: SitemapUrl[] = []

  result.push({ url: `${baseUrl}/en/` })
  for (const page of EN_SERVICE_PAGES) {
    result.push({ url: `${baseUrl}/en/${page.slug}/` })
  }
  result.push({ url: `${baseUrl}/en/emergency-home-repair-porto/` })

  for (const page of FR_INVESTOR_PAGES) {
    result.push({ url: `${baseUrl}/fr/${page.slug}/` })
  }

  result.push({ url: `${baseUrl}/nl/` })
  for (const page of NL_INVESTOR_PAGES) {
    result.push({ url: `${baseUrl}/nl/${page.slug}/` })
  }

  result.push({ url: `${baseUrl}/es/` })
  for (const page of ES_INVESTOR_PAGES) {
    result.push({ url: `${baseUrl}/es/${page.slug}/` })
  }

  return result
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-sitemap 4 : profils artisans vérifiés (Supabase)
// ────────────────────────────────────────────────────────────────────────────

// Formes juridiques « société » — même heuristique que la redirection canonique
// /societe|/empresa de app/fr/artisan/[id]/page.tsx (les URLs émises ici doivent
// pointer vers la même cible canonique).
const COMPANY_LEGAL_FORMS = ['sarl', 'sas', 'sasu', 'eurl', 'sa', 'lda', 'unipessoal']

async function artisanProfilePages(baseUrl: string): Promise<SitemapUrl[]> {
  try {
    const supabase = await createServerSupabaseClient()
    // ⚠️ Audit P2 : les colonnes org_role / country / is_verified n'existent pas
    // dans le schéma live de profiles_artisan — l'ancienne requête échouait en
    // silence (400 PostgREST) et le sub-sitemap 4 était toujours vide.
    // Colonnes réelles : verified (filtre), language ('fr'|'pt') pour la locale,
    // legal_form pour distinguer sociétés et artisans individuels.
    const { data: artisans } = await supabase
      .from('profiles_artisan')
      .select('id, slug, updated_at, language, legal_form')
      .eq('verified', true)
    return (artisans || []).map((a) => {
      const locale = a.language === 'pt' ? 'pt' : 'fr'
      const legalFormNorm = String(a.legal_form || '').replace(/[\s.]/g, '').toLowerCase()
      const isCompany = COMPANY_LEGAL_FORMS.some((f) => legalFormNorm === f || legalFormNorm.startsWith(f))
      const profilePath = getProfilePath(
        { slug: a.slug, id: a.id, org_role: isCompany ? 'pro_societe' : null },
        locale,
      )
      // lastmod uniquement si updated_at présent en DB (vrai signal),
      // sinon on omet le tag.
      const lastModified = a.updated_at ? new Date(a.updated_at) : undefined
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

  let urls: SitemapUrl[]
  switch (id) {
    case 0:
      urls = staticAndHubPages(baseUrl)
      break
    case 1:
      urls = ptProgrammaticPages(baseUrl)
      break
    case 2:
      urls = frProgrammaticPages(baseUrl)
      break
    case 3:
      urls = investorAndIntlPages(baseUrl)
      break
    case 4:
      urls = await artisanProfilePages(baseUrl)
      break
    default:
      urls = []
  }

  return new Response(formatSitemapXml(urls), { headers: SITEMAP_HEADERS })
}
