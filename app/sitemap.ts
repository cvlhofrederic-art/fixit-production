// Revalidate sitemap every hour (avoid DB hit on every crawl request)
export const revalidate = 3600

import { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getProfilePath } from '@/lib/utils'
import { getAllPageCombos, getAllUrgencyCombos, BLOG_ARTICLES, CITIES, SERVICES } from '@/lib/data/seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'
import { EN_SERVICE_PAGES } from '@/lib/data/en-services-data'
import { FR_INVESTOR_PAGES, NL_INVESTOR_PAGES, ES_INVESTOR_PAGES } from '@/lib/data/investor-pages-data'
import { FR_CITIES, FR_SERVICES, getAllFrPageCombos, getAllFrUrgencyCombos } from '@/lib/data/fr-seo-pages-data'

// Split sitemap into 5 sub-sitemaps for better crawl efficiency
// Next.js auto-generates a sitemap index at /sitemap.xml
export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'
  const now = new Date()

  // ── ID 0: Static pages + hub pages (all locales) ──
  if (id === 0) {
    return [
      // Homepages
      { url: `${baseUrl}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
      { url: `${baseUrl}/pt/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
      { url: `${baseUrl}/fr/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${baseUrl}/fr/recherche/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
      { url: `${baseUrl}/pt/pesquisar/`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
      { url: `${baseUrl}/pt/avaliacoes/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
      // FR content pages
      { url: `${baseUrl}/fr/comment-ca-marche/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
      { url: `${baseUrl}/fr/devenir-partenaire/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
      { url: `${baseUrl}/fr/artisans-verifies/`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
      // PT hub pages
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
      // FR hub pages
      { url: `${baseUrl}/fr/services/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${baseUrl}/fr/urgence/`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
      { url: `${baseUrl}/fr/blog/`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    ]
  }

  // ── ID 1: PT programmatic pages ──
  if (id === 1) {
    return [
      // Services × cities
      ...getAllPageCombos().map(combo => ({
        url: `${baseUrl}/pt/servicos/${combo.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Urgency × cities
      ...getAllUrgencyCombos().map(combo => ({
        url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // City pages
      ...CITIES.map(city => ({
        url: `${baseUrl}/pt/cidade/${city.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      // Perto de mim — generic services
      ...SERVICES.map(service => ({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Perto de mim — service × city
      ...SERVICES.flatMap(service =>
        CITIES.map(city => ({
          url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.82,
        }))
      ),
      // Picheleiro
      { url: `${baseUrl}/pt/perto-de-mim/picheleiro/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.85 },
      ...CITIES.map(city => ({
        url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      })),
      // Preços
      { url: `${baseUrl}/pt/precos/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      ...['canalizador', 'eletricista', 'pintor'].map(slug => ({
        url: `${baseUrl}/pt/precos/${slug}/`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
      // Blog PT
      ...BLOG_ARTICLES.map(article => ({
        url: `${baseUrl}/pt/blog/${article.slug}/`,
        lastModified: new Date(article.datePublished),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ]
  }

  // ── ID 2: FR programmatic pages (Marseille market) ──
  if (id === 2) {
    return [
      // Services × cities
      ...getAllFrPageCombos().map(combo => ({
        url: `${baseUrl}/fr/services/${combo.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Urgence × cities
      ...getAllFrUrgencyCombos().map(combo => ({
        url: `${baseUrl}/fr/urgence/${combo.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Ville pages
      ...FR_CITIES.map(city => ({
        url: `${baseUrl}/fr/ville/${city.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })),
      // Près de chez moi — generic services
      ...FR_SERVICES.map(service => ({
        url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Près de chez moi — service × city
      ...FR_SERVICES.flatMap(service =>
        FR_CITIES.map(city => ({
          url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}-${city.slug}/`,
          lastModified: now,
          changeFrequency: 'weekly' as const,
          priority: 0.82,
        }))
      ),
      // Copropriété
      { url: `${baseUrl}/fr/copropriete/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.88 },
      { url: `${baseUrl}/fr/copropriete/nettoyage-encombrants/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/copropriete/espaces-verts/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/copropriete/plomberie/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.85 },
      // Simulateur devis
      { url: `${baseUrl}/fr/simulateur-devis/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.88 },
      ...['marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis', 'martigues', 'allauch', 'salon-de-provence', 'saint-cyr-sur-mer', 'bandol', 'gemenos', 'sanary-sur-mer', 'six-fours-les-plages', 'ceyreste', 'la-seyne-sur-mer'].map(city => ({
        url: `${baseUrl}/fr/simulateur-devis/${city}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // Spécialités
      { url: `${baseUrl}/fr/specialites/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.88 },
      { url: `${baseUrl}/fr/specialites/elagage-palmier/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/specialites/debroussaillage-paca/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/specialites/debarras-succession/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/specialites/chauffe-eau/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      { url: `${baseUrl}/fr/specialites/fuite-eau-urgence/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.88 },
      { url: `${baseUrl}/fr/specialites/renovation-salle-de-bain/`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.85 },
      // Blog FR
      ...FR_BLOG_ARTICLES.map(article => ({
        url: `${baseUrl}/fr/blog/${article.slug}/`,
        lastModified: new Date(article.datePublished),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      })),
    ]
  }

  // ── ID 3: EN + NL + ES + FR investor pages ──
  if (id === 3) {
    return [
      // EN
      { url: `${baseUrl}/en/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 },
      ...EN_SERVICE_PAGES.map(page => ({
        url: `${baseUrl}/en/${page.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      { url: `${baseUrl}/en/emergency-home-repair-porto/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.7 },
      // FR investor
      ...FR_INVESTOR_PAGES.map(page => ({
        url: `${baseUrl}/fr/${page.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // NL
      { url: `${baseUrl}/nl/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 },
      ...NL_INVESTOR_PAGES.map(page => ({
        url: `${baseUrl}/nl/${page.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
      // ES
      { url: `${baseUrl}/es/`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 },
      ...ES_INVESTOR_PAGES.map(page => ({
        url: `${baseUrl}/es/${page.slug}/`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.85,
      })),
    ]
  }

  // ── ID 4: Artisan profiles (dynamic, no limit) ──
  try {
    const supabase = await createServerSupabaseClient()
    const { data: artisans } = await supabase
      .from('profiles_artisan')
      .select('id, slug, updated_at, org_role, country')
      .eq('is_verified', true)

    return (artisans || []).map((a) => {
      const isPT = a.country === 'PT' || a.country === 'Portugal'
      const locale = isPT ? 'pt' : 'fr'
      const profilePath = getProfilePath({ slug: a.slug, id: a.id, org_role: a.org_role }, locale)
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
