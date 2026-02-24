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
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // ── Stratégie 1 : requête SQL directe sur auth.users (la plus fiable)
  // Le service role a accès à auth.users via rpc ou raw SQL
  try {
    const { data: rawUsers, error: sqlError } = await supabaseAdmin
      .rpc('get_user_by_email', { p_email: email })

    if (!sqlError && rawUsers && rawUsers.length > 0) {
      const u = rawUsers[0]
      const userId = u.id

      // Enrichir avec profiles_artisan
      let metier = u.raw_user_meta_data?.metier || ''
      let telephone = u.raw_user_meta_data?.telephone || ''
      let siret = ''

      if (u.raw_user_meta_data?.role === 'artisan') {
        const { data: profile } = await supabaseAdmin
          .from('profiles_artisan')
          .select('metier, telephone, siret')
          .eq('user_id', userId)
          .maybeSingle()
        if (profile) {
          metier = profile.metier || metier
          telephone = profile.telephone || telephone
          siret = profile.siret || ''
        }
      }

      return NextResponse.json({
        found: true,
        name: u.raw_user_meta_data?.full_name || u.email,
        role: u.raw_user_meta_data?.role || 'inconnu',
        userId,
        metier,
        telephone,
        siret,
      })
    }
  } catch {
    // La fonction RPC n'existe peut-être pas — on continue avec le fallback
  }

  // ── Stratégie 2 : getUserById via admin API après lookup dans auth.users par SQL
  // Utiliser une requête sur la vue auth.users accessible avec service role
  try {
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('auth.users' as any)
      .select('id, email, raw_user_meta_data')
      .eq('email', email)
      .maybeSingle()

    if (!adminError && adminData) {
      const userId = adminData.id
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (authUser?.user) {
        const u = authUser.user
        let metier = u.user_metadata?.metier || ''
        let telephone = u.user_metadata?.telephone || ''
        let siret = ''

        if (u.user_metadata?.role === 'artisan') {
          const { data: profile } = await supabaseAdmin
            .from('profiles_artisan')
            .select('metier, telephone, siret')
            .eq('user_id', u.id)
            .maybeSingle()
          if (profile) {
            metier = profile.metier || metier
            telephone = profile.telephone || telephone
            siret = profile.siret || ''
          }
        }

        return NextResponse.json({
          found: true,
          name: u.user_metadata?.full_name || u.email,
          role: u.user_metadata?.role || 'inconnu',
          userId: u.id,
          metier,
          telephone,
          siret,
        })
      }
    }
  } catch {
    // Continuer vers le fallback pagination
  }

  // ── Stratégie 3 (fallback fiable) : listUsers paginé
  let page = 1
  const perPage = 1000
  let foundUser = null

  while (page <= 10) {
    const { data: pageData, error: pageErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (pageErr || !pageData?.users?.length) break

    const match = pageData.users.find((u: { email?: string }) => u.email?.toLowerCase() === email)
    if (match) { foundUser = match; break }

    if (pageData.users.length < perPage) break
    page++
  }

  if (!foundUser) {
    return NextResponse.json({ found: false })
  }

  const u = foundUser
  let metier = u.user_metadata?.metier || ''
  let telephone = u.user_metadata?.telephone || ''
  let siret = ''

  if (u.user_metadata?.role === 'artisan') {
    const { data: profile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('metier, telephone, siret')
      .eq('user_id', u.id)
      .maybeSingle()
    if (profile) {
      metier = profile.metier || metier
      telephone = profile.telephone || telephone
      siret = profile.siret || ''
    }
  }

  return NextResponse.json({
    found: true,
    name: u.user_metadata?.full_name || u.email,
    role: u.user_metadata?.role || 'inconnu',
    userId: u.id,
    metier,
    telephone,
    siret,
  })
}
