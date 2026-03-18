import { MetadataRoute } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getAllPageCombos, getAllUrgencyCombos, BLOG_ARTICLES, CITIES, SERVICES } from '@/lib/data/seo-pages-data'
import { FR_BLOG_ARTICLES } from '@/lib/data/fr-blog-data'
import { EN_SERVICE_PAGES } from '@/lib/data/en-services-data'
import { FR_INVESTOR_PAGES, NL_INVESTOR_PAGES, ES_INVESTOR_PAGES } from '@/lib/data/investor-pages-data'
import { FR_CITIES, FR_SERVICES, getAllFrPageCombos, getAllFrUrgencyCombos } from '@/lib/data/fr-seo-pages-data'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.io'

  // Pages statiques (avec prefixe locale)
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: new Date('2026-03-01'), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/pt/`, lastModified: new Date('2026-03-01'), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/recherche/`, lastModified: new Date('2026-03-01'), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/avis/`, lastModified: new Date('2026-03-16'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/blog/`, lastModified: new Date('2026-03-01'), changeFrequency: 'weekly', priority: 0.7 },
    // Pages contenu FR — relation client/professionnel
    { url: `${baseUrl}/fr/comment-ca-marche/`, lastModified: new Date('2026-03-16'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/devenir-partenaire/`, lastModified: new Date('2026-03-16'), changeFrequency: 'monthly', priority: 0.85 },
    { url: `${baseUrl}/fr/artisans-verifies/`, lastModified: new Date('2026-03-16'), changeFrequency: 'monthly', priority: 0.85 },
  ]

  // Hub pages PT
  const seoHubPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/pt/servicos/`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pt/blog/`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/pt/urgencia/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pt/perto-de-mim/`,
      lastModified: new Date('2026-03-17'),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    // Pages contenu PT — relation client/professionnel
    {
      url: `${baseUrl}/pt/como-funciona/`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pt/torne-se-parceiro/`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pt/profissionais-verificados/`,
      lastModified: new Date('2026-03-16'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pt/especialidades/`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pt/condominio/`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pt/simulador-orcamento/`,
      lastModified: new Date('2026-03-18'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
  ]

  // Pages SEO programmatiques — services x villes (9 services x 8 cities = 72 pages)
  const seoServicePages: MetadataRoute.Sitemap = getAllPageCombos().map(combo => ({
    url: `${baseUrl}/pt/servicos/${combo.slug}/`,
    lastModified: new Date('2026-03-18'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Pages urgence (9 services x 8 cities = 72 pages)
  const seoUrgencyPages: MetadataRoute.Sitemap = getAllUrgencyCombos().map(combo => ({
    url: `${baseUrl}/pt/urgencia/${combo.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Pages ville (8 pages)
  const seoCityPages: MetadataRoute.Sitemap = CITIES.map(city => ({
    url: `${baseUrl}/pt/cidade/${city.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // Pages "perto de mim" :
  //   4 génériques (service)
  //  32 service × ville
  //   1 picheleiro générique
  //   8 picheleiro × ville
  // = 45 pages
  const seoPertoPages: MetadataRoute.Sitemap = [
    // Generic service pages (4)
    ...SERVICES.map(service => ({
      url: `${baseUrl}/pt/perto-de-mim/${service.slug}/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    // Service × city (32)
    ...SERVICES.flatMap(service =>
      CITIES.map(city => ({
        url: `${baseUrl}/pt/perto-de-mim/${service.slug}-${city.slug}/`,
        lastModified: new Date('2026-03-15'),
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      }))
    ),
    // Picheleiro generic (1)
    {
      url: `${baseUrl}/pt/perto-de-mim/picheleiro/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    },
    // Picheleiro × city (8)
    ...CITIES.map(city => ({
      url: `${baseUrl}/pt/perto-de-mim/picheleiro-${city.slug}/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'weekly' as const,
      priority: 0.82,
    })),
  ]

  // Pages preços (hub + 3 guides)
  const seoPrecosPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/pt/precos/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    },
    ...['canalizador', 'eletricista', 'pintor'].map(slug => ({
      url: `${baseUrl}/pt/precos/${slug}/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ]

  // Pages blog PT
  const seoBlogPages: MetadataRoute.Sitemap = BLOG_ARTICLES.map(article => ({
    url: `${baseUrl}/pt/blog/${article.slug}/`,
    lastModified: new Date(article.datePublished),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Pages EN — service pages for Porto expats (hub + 8 services + ads landing = 10 pages)
  const enHubPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/en/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  const enServicePages: MetadataRoute.Sitemap = EN_SERVICE_PAGES.map(page => ({
    url: `${baseUrl}/en/${page.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  const enAdsPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/en/emergency-home-repair-porto/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }]

  // Pages FR investisseurs (4 pages — accessible via /fr/slug/ grâce au rewrite)
  const frInvestorPages: MetadataRoute.Sitemap = FR_INVESTOR_PAGES.map(page => ({
    url: `${baseUrl}/fr/${page.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Pages NL investisseurs (hub + 4 services = 5 pages)
  const nlHubPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/nl/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  const nlServicePages: MetadataRoute.Sitemap = NL_INVESTOR_PAGES.map(page => ({
    url: `${baseUrl}/nl/${page.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // Pages ES investisseurs (hub + 4 services = 5 pages)
  const esHubPage: MetadataRoute.Sitemap = [{
    url: `${baseUrl}/es/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }]

  const esServicePages: MetadataRoute.Sitemap = ES_INVESTOR_PAGES.map(page => ({
    url: `${baseUrl}/es/${page.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // ── Pages FR Marseille (hub + services + urgence + ville + près de chez moi) ──
  const frMarseilleHub: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fr/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/fr/services/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${baseUrl}/fr/urgence/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.9 },
  ]

  // 32 service × ville pages
  const frMarseilleServicePages: MetadataRoute.Sitemap = getAllFrPageCombos().map(combo => ({
    url: `${baseUrl}/fr/services/${combo.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // 32 urgence × ville pages
  const frMarseilleUrgencePages: MetadataRoute.Sitemap = getAllFrUrgencyCombos().map(combo => ({
    url: `${baseUrl}/fr/urgence/${combo.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.85,
  }))

  // 8 ville pages
  const frMarseilleVillePages: MetadataRoute.Sitemap = FR_CITIES.map(city => ({
    url: `${baseUrl}/fr/ville/${city.slug}/`,
    lastModified: new Date('2026-03-15'),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // 4 génériques + 32 service×ville = 36 "près de chez moi" pages
  const frMarseillePresPages: MetadataRoute.Sitemap = [
    ...FR_SERVICES.map(service => ({
      url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}/`,
      lastModified: new Date('2026-03-15'),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
    ...FR_SERVICES.flatMap(service =>
      FR_CITIES.map(city => ({
        url: `${baseUrl}/fr/pres-de-chez-moi/${service.slug}-${city.slug}/`,
        lastModified: new Date('2026-03-15'),
        changeFrequency: 'weekly' as const,
        priority: 0.82,
      }))
    ),
  ]

  // Pages copropriété FR (hub + 3 services = 4 pages)
  const frCoproprietePages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fr/copropriete/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.88 },
    { url: `${baseUrl}/fr/copropriete/nettoyage-encombrants/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/copropriete/espaces-verts/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/copropriete/plomberie/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.85 },
  ]

  // Pages blog FR (6 articles)
  const frBlogPages: MetadataRoute.Sitemap = FR_BLOG_ARTICLES.map(article => ({
    url: `${baseUrl}/fr/blog/${article.slug}/`,
    lastModified: new Date(article.datePublished),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // Page simulateur devis FR (hub + 15 villes = 16 pages)
  const frSimulateurPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fr/simulateur-devis/`, lastModified: new Date('2026-03-17'), changeFrequency: 'weekly' as const, priority: 0.88 },
    ...['marseille', 'aix-en-provence', 'aubagne', 'la-ciotat', 'cassis', 'martigues', 'allauch', 'salon-de-provence', 'saint-cyr-sur-mer', 'bandol', 'gemenos', 'sanary-sur-mer', 'six-fours-les-plages', 'ceyreste', 'la-seyne-sur-mer'].map(city => ({
      url: `${baseUrl}/fr/simulateur-devis/${city}/`,
      lastModified: new Date('2026-03-17'),
      changeFrequency: 'weekly' as const,
      priority: 0.85,
    })),
  ]

  // Page blog FR hub
  const frBlogHubPage: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fr/blog/`, lastModified: new Date('2026-03-17'), changeFrequency: 'weekly' as const, priority: 0.8 },
  ]

  // Pages spécialités ultra-niche FR (hub + 6 pages = 7 pages)
  const frSpecialitesPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/fr/specialites/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.88 },
    { url: `${baseUrl}/fr/specialites/elagage-palmier/`, lastModified: new Date('2026-03-15'), changeFrequency: 'monthly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/debroussaillage-paca/`, lastModified: new Date('2026-03-15'), changeFrequency: 'monthly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/debarras-succession/`, lastModified: new Date('2026-03-15'), changeFrequency: 'monthly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/chauffe-eau/`, lastModified: new Date('2026-03-15'), changeFrequency: 'monthly' as const, priority: 0.85 },
    { url: `${baseUrl}/fr/specialites/fuite-eau-urgence/`, lastModified: new Date('2026-03-15'), changeFrequency: 'weekly' as const, priority: 0.88 },
    { url: `${baseUrl}/fr/specialites/renovation-salle-de-bain/`, lastModified: new Date('2026-03-15'), changeFrequency: 'monthly' as const, priority: 0.85 },
  ]

  // Pages artisans dynamiques
  try {
    const supabase = await createServerSupabaseClient()
    const { data: artisans } = await supabase
      .from('profiles_artisan')
      .select('id, slug, updated_at')
      .eq('is_verified', true)
      .limit(500)

    const artisanPages: MetadataRoute.Sitemap = (artisans || []).map((a) => ({
      url: `${baseUrl}/artisan/${a.slug || a.id}/`,
      lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    return [...staticPages, ...seoHubPages, ...seoServicePages, ...seoUrgencyPages, ...seoCityPages, ...seoPertoPages, ...seoPrecosPages, ...seoBlogPages, ...enHubPage, ...enServicePages, ...enAdsPage, ...frInvestorPages, ...nlHubPage, ...nlServicePages, ...esHubPage, ...esServicePages, ...frMarseilleHub, ...frMarseilleServicePages, ...frMarseilleUrgencePages, ...frMarseilleVillePages, ...frMarseillePresPages, ...frCoproprietePages, ...frSimulateurPages, ...frBlogHubPage, ...frSpecialitesPages, ...frBlogPages, ...artisanPages]
  } catch {
    return [...staticPages, ...seoHubPages, ...seoServicePages, ...seoUrgencyPages, ...seoCityPages, ...seoPertoPages, ...seoPrecosPages, ...seoBlogPages, ...enHubPage, ...enServicePages, ...enAdsPage, ...frInvestorPages, ...nlHubPage, ...nlServicePages, ...esHubPage, ...esServicePages, ...frMarseilleHub, ...frMarseilleServicePages, ...frMarseilleUrgencePages, ...frMarseilleVillePages, ...frMarseillePresPages, ...frCoproprietePages, ...frSimulateurPages, ...frBlogHubPage, ...frSpecialitesPages, ...frBlogPages]
  }
}
