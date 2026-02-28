import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: artisan } = await supabase
      .from('profiles_artisan')
      .select('company_name, bio, categories, city, rating_avg, rating_count')
      .eq('id', id)
      .single()

    if (!artisan) {
      return {
        title: 'Artisan non trouvé - Vitfix',
        description: 'Cet artisan n\'existe pas ou a été supprimé.',
      }
    }

    const name = artisan.company_name || 'Artisan Vitfix'
    const categories = (artisan.categories || []).join(', ')
    const city = artisan.city || 'France'
    const rating = artisan.rating_avg ? `${artisan.rating_avg.toFixed(1)}/5` : ''
    const ratingText = rating ? ` - Note : ${rating} (${artisan.rating_count} avis)` : ''

    return {
      title: `${name} - ${categories || 'Artisan'} à ${city} | Vitfix`,
      description: artisan.bio?.substring(0, 160) || `${name}, artisan ${categories} à ${city}.${ratingText} Réservez en ligne sur Vitfix.`,
      openGraph: {
        title: `${name} - ${categories || 'Artisan'} à ${city}`,
        description: artisan.bio?.substring(0, 160) || `Réservez ${name} en ligne sur Vitfix.`,
        siteName: 'Vitfix',
        locale: 'fr_FR',
        type: 'profile',
      },
    }
  } catch {
    return {
      title: 'Artisan - Vitfix',
      description: 'Consultez le profil de cet artisan vérifié sur Vitfix.',
    }
  }
}

export default function ArtisanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
