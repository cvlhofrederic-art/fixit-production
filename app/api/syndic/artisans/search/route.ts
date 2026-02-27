import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── Helper : catégories artisan → libellé métier syndic ──────────────────────
function categoriesToMetier(categories: string[]): string {
  if (!categories?.length) return ''
  const map: Record<string, string> = {
    plomberie:     'Plomberie',
    electricite:   'Électricité',
    peinture:      'Peinture',
    maconnerie:    'Maçonnerie',
    menuiserie:    'Menuiserie',
    chauffage:     'Chauffage / Climatisation',
    climatisation: 'Chauffage / Climatisation',
    serrurerie:    'Serrurerie',
    carrelage:     'Carrelage',
    toiture:       'Toiture',
    jardinage:     'Jardinage / Espaces verts',
    paysagiste:    'Jardinage / Espaces verts',
    nettoyage:     'Nettoyage',
    demenagement:  'Déménagement',
    renovation:    'Multi-services',
    multi:         'Multi-services',
  }
  for (const cat of categories) {
    const found = map[cat.toLowerCase()]
    if (found) return found
  }
  return categories[0] || ''
}

// ── Helper : enrichit avec profiles_artisan (colonnes réelles du schéma) ─────
async function enrichFromProfile(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from('profiles_artisan')
    .select('siret, categories, company_name, hourly_rate')
    .eq('user_id', userId)
    .maybeSingle()
  return profile || null
}

// ── GET /api/syndic/artisans/search?email=xxx ─────────────────────────────────
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

  // ── Stratégie 1 : requête SQL directe via RPC (la plus fiable)
  try {
    const { data: rawUsers, error: sqlError } = await supabaseAdmin
      .rpc('get_user_by_email', { p_email: email })

    if (!sqlError && rawUsers && rawUsers.length > 0) {
      const u = rawUsers[0]
      const userId = u.id
      const meta = u.raw_user_meta_data || {}

      // Téléphone : user_metadata.phone OR .telephone
      let telephone = meta.phone || meta.telephone || ''
      // SIRET : user_metadata.siret en priorité
      let siret = meta.siret || ''
      // Métier : via categories du profil artisan
      let metier = meta.metier || ''

      const profile = await enrichFromProfile(userId)
      if (profile) {
        if (!telephone && profile.categories) {
          // pas de phone dans le profil, on garde vide
        }
        if (!siret && profile.siret) siret = profile.siret
        if (!metier && profile.categories) metier = categoriesToMetier(profile.categories)
      }

      return NextResponse.json({
        found: true,
        name: meta.full_name || u.email,
        role: meta.role || 'inconnu',
        userId,
        telephone,
        siret,
        metier,
      })
    }
  } catch {
    // La fonction RPC n'existe peut-être pas — on continue avec le fallback
  }

  // ── Stratégie 2 : getUserById via admin API après lookup SQL direct
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
        const meta = u.user_metadata || {}

        let telephone = meta.phone || meta.telephone || ''
        let siret = meta.siret || ''
        let metier = meta.metier || ''

        const profile = await enrichFromProfile(userId)
        if (profile) {
          if (!siret && profile.siret) siret = profile.siret
          if (!metier && profile.categories) metier = categoriesToMetier(profile.categories)
        }

        return NextResponse.json({
          found: true,
          name: meta.full_name || u.email,
          role: meta.role || 'inconnu',
          userId: u.id,
          telephone,
          siret,
          metier,
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
  const meta = u.user_metadata || {}

  let telephone = meta.phone || meta.telephone || ''
  let siret = meta.siret || ''
  let metier = meta.metier || ''

  const profile = await enrichFromProfile(u.id)
  if (profile) {
    if (!siret && profile.siret) siret = profile.siret
    if (!metier && profile.categories) metier = categoriesToMetier(profile.categories)
  }

  return NextResponse.json({
    found: true,
    name: meta.full_name || u.email,
    role: meta.role || 'inconnu',
    userId: u.id,
    telephone,
    siret,
    metier,
  })
}
