import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/syndic/artisans/search?email=xxx ─────────────────────────────────
// Vérifier si un email correspond à un compte VitFix existant
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`artisan_search_${ip}`, 20, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // Chercher dans auth.users via admin API
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json({ found: false })
  }

  const found = users.find(u => u.email?.toLowerCase() === email)

  if (!found) {
    return NextResponse.json({ found: false })
  }

  // Enrichir avec le profil artisan si disponible
  let metier = found.user_metadata?.metier || ''
  let telephone = found.user_metadata?.telephone || ''
  let siret = ''

  if (found.user_metadata?.role === 'artisan') {
    const { data: profile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('metier, telephone, siret')
      .eq('user_id', found.id)
      .maybeSingle()
    if (profile) {
      metier = profile.metier || metier
      telephone = profile.telephone || telephone
      siret = profile.siret || ''
    }
  }

  return NextResponse.json({
    found: true,
    name: found.user_metadata?.full_name || found.email,
    role: found.user_metadata?.role || 'inconnu',
    userId: found.id,
    metier,
    telephone,
    siret,
  })
}
