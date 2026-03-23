import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * POST /api/save-logo
 * Sauvegarde un logo (base64) directement dans profiles_artisan.logo_url
 * Bypass Storage — stocke le base64 en DB via supabaseAdmin (bypass RLS)
 */
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const { base64, field } = await request.json()
    if (!base64 || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })
    }

    // Vérifier taille (~500KB en base64 = ~375KB fichier)
    if (base64.length > 700000) {
      return NextResponse.json({ error: 'Fichier trop lourd (max 500 Ko)' }, { status: 400 })
    }

    // Trouver l'artisan par user_id
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 404 })
    }

    // Sauvegarder le base64 dans la colonne appropriée
    const col = field === 'profile_photo_url' ? 'profile_photo_url' : 'logo_url'
    const { error } = await supabaseAdmin
      .from('profiles_artisan')
      .update({ [col]: base64, updated_at: new Date().toISOString() })
      .eq('id', artisan.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erreur serveur' }, { status: 500 })
  }
}
