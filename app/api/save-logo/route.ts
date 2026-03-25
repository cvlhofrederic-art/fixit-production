import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { validateBody, saveLogoSchema } from '@/lib/validation'

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
    const body = await request.json()
    const v = validateBody(saveLogoSchema, body)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    const { base64, field } = v.data

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
