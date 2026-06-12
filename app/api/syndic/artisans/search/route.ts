import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

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
  if (!(await checkRateLimit(`artisan_search_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // ── Isolation multi-tenant : résoudre le cabinet_id du syndic ──
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // ── Stratégie 0 : vérifier d'abord dans syndic_artisans du cabinet ──
  // Limite la recherche au périmètre du syndic connecté
  const { data: existingArtisan } = await supabaseAdmin
    .from('syndic_artisans')
    .select('id, nom, email, artisan_user_id, metier, telephone, siret')
    .eq('cabinet_id', cabinetId)
    .eq('email', email)
    .maybeSingle()

  if (existingArtisan) {
    return NextResponse.json({
      found: true,
      name: existingArtisan.nom || email,
      role: 'artisan',
      userId: existingArtisan.artisan_user_id || null,
      telephone: existingArtisan.telephone || '',
      siret: existingArtisan.siret || '',
      metier: existingArtisan.metier || '',
      already_in_cabinet: true,
    })
  }

  // ── Stratégie 1 (unique recherche auth) : listUsers paginé ──────────────────
  // Les deux anciennes stratégies étaient mortes (TSQ-06 / FNC-07) :
  //   - .rpc('get_user_by_email') : la fonction n'existe dans aucune migration ni en live ;
  //   - .from('auth.users') : PostgREST n'expose pas le schéma auth — erreur systématique.
  // ⚠️ Plafond connu : 10 pages × 1000 = 10 000 comptes parcourus au maximum.
  // Au-delà de 10 000 comptes auth, un email existant peut être déclaré
  // « found: false » à tort — logger.warn ci-dessous le signale.
  let page = 1
  const perPage = 1000
  const maxPages = 10
  let foundUser = null
  let listExhausted = false // true si on a vu la fin réelle de la liste (ou une erreur)

  while (page <= maxPages) {
    const { data: pageData, error: pageErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (pageErr || !pageData?.users?.length) { listExhausted = true; break }

    const match = pageData.users.find((u) => u.email?.toLowerCase() === email)
    if (match) { foundUser = match; break }

    if (pageData.users.length < perPage) { listExhausted = true; break }
    page++
  }

  if (!foundUser) {
    if (!listExhausted) {
      logger.warn('[syndic/artisans/search] listUsers : plafond de pagination atteint (10 000 comptes) sans trouver l\'email — le found:false peut être un faux négatif')
    }
    return NextResponse.json({ found: false })
  }

  const u = foundUser
  const meta = u.user_metadata || {}

  const telephone = meta.phone || meta.telephone || ''
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
