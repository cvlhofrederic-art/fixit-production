import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getProfilePath } from '@/lib/utils'
import { formatSitemapXml, SITEMAP_HEADERS, type SitemapUrl } from '@/lib/sitemap-helpers'
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

export const runtime = 'edge'
export const revalidate = 3600

const SIM_CITIES = [
  'marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis',
  'martigues', 'allauch', 'salon-de-provence', 'saint-cyr-sur-mer',
  'bandol', 'gemenos', 'sanary-sur-mer', 'six-fours-les-plages',
  'ceyreste', 'la-seyne-sur-mer',
] as const

function parseId(idParam: string): number | null {
  const cleaned = idParam.replace(/\.xml$/, '')
  const parsed = Number.parseInt(cleaned, 10)
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 4) return null
  return parsed
}

function staticAndHubPages(baseUrl: string, now: Date): SitemapUrl[] {
  return [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/pt/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/fr/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/fr/recherche/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/pt/pesquisar/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/pt/avaliacoes/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/fr/comment-ca-marche/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/devenir-partenaire/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/artisans-verifies/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/servicos/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/pt/blog/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/pt/urgencia/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/pt/perto-de-mim/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/pt/como-funciona/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/torne-se-parceiro/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/profissionais-verificados/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/especialidades/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/condominio/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/simulador-orcamento/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/pt/mercados/publicar/`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${baseUrl}/pt/mercados/gerir/`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/fr/services/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/fr/urgence/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${baseUrl}/fr/blog/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ]
}

function ptProgrammaticPages(baseUrl: string, now: Date): SitemapUrl[] {
  return [
    ...getAllPageCombos().map((combo) => ({
      url: `${baseUrl}/pt/servicos/${combo.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...getAllUrgencyCombos().map((combo) => ({
      url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...CITIES.map((city) => ({
      url: `${baseUrl}/pt/cidade/${city.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...SERVICES.map((service) => ({
      url: `${baseUrl}/pt/perto-de-mim/${service.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...SERVICES.flatMap((service) =>
      CITIES.map((city) => ({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      })),
    ),
    { url: `${baseUrl}/pt/perto-de-mim/picheleiro/`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    ...CITIES.map((city) => ({
      url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.82,
    })),
    { url: `${baseUrl}/pt/precos/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    ...['canalizador', 'eletricista', 'pintor'].map((slug) => ({
      url: `${baseUrl}/pt/precos/${slug}/`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    ...BLOG_ARTICLES.map((article) => ({
      url: `${baseUrl}/pt/blog/${article.slug}/`,
      lastModified: new Date(article.datePublished),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}

function frProgrammaticPages(baseUrl: string, now: Date): SitemapUrl[] {
  return [
    ...getAllFrPageCombos().map((combo) => ({
      url: `${baseUrl}/fr/services/${combo.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...getAllFrUrgencyCombos().map((combo) => ({
      url: `${baseUrl}/fr/urgence/${combo.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...FR_CITIES.map((city) => ({
      url: `${baseUrl}/fr/ville/${city.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...FR_SERVICES.map((service) => ({
      url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...FR_SERVICES.flatMap((service) =>
      FR_CITIES.map((city) => ({
        url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}-${city.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      })),
    ),
    { url: `${baseUrl}/fr/copropriete/`, lastModified: now, changeFrequency: 'weekly', priority: 0.88 },
    { url: `${baseUrl}/fr/copropriete/nettoyage-encombrants/`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/fr/copropriete/espaces-verts/`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/fr/copropriete/plomberie/`, lastModified: now, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${baseUrl}/fr/simulateur-devis/`, lastModified: now, changeFrequency: 'weekly', priority: 0.88 },
    ...SIM_CITIES.map((city) => ({
      url: `${baseUrl}/fr/simulateur-devis/${city}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/fr/specialites/`, lastModified: now, changeFrequency: 'weekly', priority: 0.88 },
    { url: `${baseUrl}/fr/specialites/elagage-palmier/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/debroussaillage-paca/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/debarras-succession/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/chauffe-eau/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/fuite-eau-urgence/`, lastModified: now, changeFrequency: 'weekly', priority: 0.88 },
    { url: `${baseUrl}/fr/specialites/renovation-salle-de-bain/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    ...FR_BLOG_ARTICLES.map((article) => ({
      url: `${baseUrl}/fr/blog/${article.slug}/`,
      lastModified: new Date(article.datePublished),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ]
}

function investorAndIntlPages(baseUrl: string, now: Date): SitemapUrl[] {
  return [
    { url: `${baseUrl}/en/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...EN_SERVICE_PAGES.map((page) => ({
      url: `${baseUrl}/en/${page.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/en/emergency-home-repair-porto/`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...FR_INVESTOR_PAGES.map((page) => ({
      url: `${baseUrl}/fr/${page.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/nl/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...NL_INVESTOR_PAGES.map((page) => ({
      url: `${baseUrl}/nl/${page.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    { url: `${baseUrl}/es/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...ES_INVESTOR_PAGES.map((page) => ({
      url: `${baseUrl}/es/${page.slug}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
  ]
}

async function artisanProfilePages(baseUrl: string, now: Date): Promise<SitemapUrl[]> {
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
      return {
        url: `${baseUrl}${profilePath}/`,
        lastModified: a.updated_at ? new Date(a.updated_at) : now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })
  } catch {
    return []
  }
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await ctx.params
  const id = parseId(idParam)
  if (id === null) {
    return new Response('Not Found', { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const now = new Date()

  let urls: SitemapUrl[]
  switch (id) {
    case 0:
      urls = staticAndHubPages(baseUrl, now)
      break
    case 1:
      urls = ptProgrammaticPages(baseUrl, now)
      break
    case 2:
      urls = frProgrammaticPages(baseUrl, now)
      break
    case 3:
      urls = investorAndIntlPages(baseUrl, now)
      break
    case 4:
      urls = await artisanProfilePages(baseUrl, now)
      break
    default:
      urls = []
  }

  return new Response(formatSitemapXml(urls), { headers: SITEMAP_HEADERS })
}
