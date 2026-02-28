import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vitfix.fr'

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/recherche`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/inscription`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/connexion`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  // Pages artisans dynamiques (profils publics)
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: artisans } = await supabase
      .from('profiles_artisan')
      .select('id, updated_at')
      .eq('is_verified', true)
      .limit(500)

    const artisanPages: MetadataRoute.Sitemap = (artisans || []).map((a) => ({
      url: `${baseUrl}/artisan/${a.id}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

    return [...staticPages, ...artisanPages]
  } catch {
    // Si erreur DB, retourner seulement les pages statiques
    return staticPages
  }
}
