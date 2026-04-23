import type { Metadata } from 'next'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { getProfilePath } from '@/lib/utils'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const fallback: Metadata = { title: 'Artisan - Vitfix', description: 'Consultez le profil de cet artisan vérifié sur Vitfix.' }

  let artisan: { company_name: string | null; bio: string | null; categories: string[] | null; company_city: string | null; rating_avg: number | null; rating_count: number; country: string | null; profile_photo_url: string | null; slug: string | null; org_role: string | null } | null = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase
      .from('profiles_artisan')
      .select('company_name, bio, categories, company_city, rating_avg, rating_count, country, profile_photo_url, slug, org_role')
      .eq('id', id)
      .single()
    artisan = data
  } catch {
    return fallback
  }

  if (!artisan) {
    return { title: 'Artisan non trouvé - Vitfix', description: 'Cet artisan n\'existe pas ou a été supprimé.' }
  }

  const isPT = artisan.country === 'PT' || artisan.country === 'Portugal'
  const name = artisan.company_name || (isPT ? 'Profissional VITFIX' : 'Artisan Vitfix')
  const categories = (artisan.categories || []).join(', ')
  const city = artisan.company_city || (isPT ? 'Portugal' : 'France')
  const ogLocale = isPT ? 'pt_PT' : 'fr_FR'
  const siteName = isPT ? 'VITFIX' : 'Vitfix'

  const rating = artisan.rating_avg ? artisan.rating_avg.toFixed(1) : null
  const ratingText = isPT
    ? (rating ? ` - Nota: ${rating}/5 (${artisan.rating_count} avaliações)` : '')
    : (rating ? ` - Note : ${rating}/5 (${artisan.rating_count} avis)` : '')

  const title = isPT
    ? `${name} - ${categories || 'Profissional'} em ${city} | VITFIX`
    : `${name} - ${categories || 'Artisan'} à ${city} | Vitfix`

  const description = isPT
    ? (artisan.bio?.substring(0, 160) || `${name}, ${categories} em ${city}.${ratingText} Reserve online no VITFIX.`)
    : (artisan.bio?.substring(0, 160) || `${name}, artisan ${categories} à ${city}.${ratingText} Réservez en ligne sur Vitfix.`)

  const locale = isPT ? 'pt' : 'fr'
  const canonicalPath = getProfilePath({ slug: artisan.slug, id, org_role: artisan.org_role }, locale)

  return {
    title,
    description,
    openGraph: {
      title: `${name} - ${categories || (isPT ? 'Profissional' : 'Artisan')} ${isPT ? 'em' : 'à'} ${city}`,
      description,
      siteName,
      locale: ogLocale,
      type: 'profile',
      ...(artisan.profile_photo_url ? { images: [{ url: artisan.profile_photo_url, width: 400, height: 400 }] } : { images: [{ url: 'https://vitfix.io/og-image.png', width: 1200, height: 630 }] }),
    },
    alternates: {
      canonical: `https://vitfix.io${canonicalPath}/`,
    },
  }
}

export default async function ArtisanLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let jsonLdString: string | null = null

  try {
    const supabase = await createServerSupabaseClient()
    const { data: artisan } = await supabase
      .from('profiles_artisan')
      .select('company_name, categories, company_city, rating_avg, rating_count, country, latitude, longitude, profile_photo_url, slug, phone, org_role')
      .eq('id', id)
      .single()

    if (artisan) {
      const isPT = artisan.country === 'PT' || artisan.country === 'Portugal'
      const name = artisan.company_name || (isPT ? 'Profissional VITFIX' : 'Artisan Vitfix')
      const categories = artisan.categories || []
      const city = artisan.company_city || ''
      const jsonLdLocale = isPT ? 'pt' : 'fr'
      const canonicalPath = getProfilePath({ slug: artisan.slug, id, org_role: artisan.org_role }, jsonLdLocale)

      const jsonLd = {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': ['Person', 'LocalBusiness'],
            name,
            jobTitle: categories[0] || (isPT ? 'Profissional' : 'Artisan'),
            description: isPT
              ? `${name}${categories.length ? ', ' + categories.join(', ') : ''} em ${city}. Profissional verificado na plataforma VITFIX.`
              : `${name}${categories.length ? ', ' + categories.join(', ') : ''} à ${city}. Artisan vérifié sur la plateforme Vitfix.`,
            url: `https://vitfix.io${canonicalPath}/`,
            ...(artisan.profile_photo_url ? { image: artisan.profile_photo_url } : {}),
            ...(artisan.phone ? { telephone: artisan.phone } : {}),
            ...(city ? {
              address: {
                '@type': 'PostalAddress',
                addressLocality: city,
                addressCountry: isPT ? 'PT' : 'FR',
              },
            } : {}),
            ...(artisan.latitude && artisan.longitude ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: artisan.latitude,
                longitude: artisan.longitude,
              },
            } : {}),
            ...(artisan.rating_avg && artisan.rating_count > 0 ? {
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: artisan.rating_avg.toFixed(1),
                reviewCount: artisan.rating_count,
                bestRating: '5',
                worstRating: '1',
              },
            } : {}),
            ...(categories.length > 0 ? {
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: isPT ? 'Serviços disponíveis' : 'Services proposés',
                itemListElement: categories.map((cat: string) => ({
                  '@type': 'Offer',
                  itemOffered: {
                    '@type': 'Service',
                    name: cat,
                  },
                })),
              },
            } : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: isPT ? 'VITFIX Portugal' : 'Vitfix',
                item: isPT ? 'https://vitfix.io/pt/' : 'https://vitfix.io/',
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: isPT ? 'Profissionais' : 'Artisans',
                item: isPT ? 'https://vitfix.io/pt/pesquisar/' : 'https://vitfix.io/recherche/',
              },
              {
                '@type': 'ListItem',
                position: 3,
                name,
                item: `https://vitfix.io${canonicalPath}/`,
              },
            ],
          },
        ],
      }

      jsonLdString = JSON.stringify(jsonLd)
    }
  } catch {
    // DB error — render children without JSON-LD
  }

  return (
    <>
      {jsonLdString && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString }}
        />
      )}
      {children}
    </>
  )
}
