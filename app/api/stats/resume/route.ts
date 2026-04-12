import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getResumeActivite } from '@/lib/stats-resume'
import { genererPhrases } from '@/lib/stats-phrases'
import { logger } from '@/lib/logger'

export const maxDuration = 15

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // Trouver l'artisan
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!artisan) {
      return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const periode = (searchParams.get('periode') || 'mois_en_cours') as
      'mois_en_cours' | 'mois_precedent' | 'annee_en_cours'

    const resume = await getResumeActivite(artisan.id, periode)
    const phrases = genererPhrases(resume)

    return NextResponse.json(
      { resume, phrases },
      {
        headers: {
          'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        },
      }
    )
  } catch (err) {
    logger.error('[stats/resume] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
