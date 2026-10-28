import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit: 5 profile creations per IP per 10 minutes
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`create_profile_${ip}`, 5, 600_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const { user_id, specialty_slugs, ...profileData } = body

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 })
    }

    // Verify the user exists in auth.users and was created recently (< 10 min)
    const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id)
    if (userError || !user?.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    const createdAt = new Date(user.user.created_at).getTime()
    if (Date.now() - createdAt > 10 * 60 * 1000) {
      return NextResponse.json({ error: 'Profile creation window expired' }, { status: 403 })
    }

    // Prevent duplicate profiles
    const { data: existing } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user_id)
      .maybeSingle()
    if (existing) {
      await saveSpecialties(user_id, specialty_slugs)
      await ensureGerant(user.user)
      return NextResponse.json({ id: existing.id })
    }

    // Only allow fields that exist in profiles_artisan. verified et kyc_status ne viennent jamais du
    // corps : la route est appelée sans session, tout compte de moins de 10 minutes aurait pu créer
    // une fiche déjà « vérifiée ». Le serveur les fixe, le KYC les fait évoluer ensuite.
    const ALLOWED_FIELDS = [
      'user_id', 'company_name', 'siret', 'siren', 'bio', 'categories',
      'kyc_market', 'phone', 'email', 'language',
      'legal_form', 'naf_code', 'naf_label', 'company_address', 'company_city',
      'company_postal_code',
    ]
    const MARCHES_KYC: readonly unknown[] = ['fr_artisan', 'fr_btp', 'pt_artisan']
    const sanitized: Record<string, unknown> = { user_id, verified: false, kyc_status: 'pending' }
    for (const key of ALLOWED_FIELDS) {
      if (key in profileData) sanitized[key] = profileData[key]
    }
    if ('kyc_market' in sanitized && !MARCHES_KYC.includes(sanitized.kyc_market)) delete sanitized.kyc_market

    const { data, error } = await supabaseAdmin
      .from('profiles_artisan')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) {
      logger.error('[create-profile] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await saveSpecialties(user_id, specialty_slugs)
    await ensureGerant(user.user)

    return NextResponse.json({ id: data.id })
  } catch (err) {
    logger.error('[create-profile] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// Spécialités BTP de l'inscription (profile_specialties), écrites ici en service
// role : l'inscription n'a pas de session quand la confirmation d'e-mail est
// active, et /api/profile/specialties exige un Bearer. Toujours 'self_declared' ;
// ignoreDuplicates pour ne jamais rétrograder une source déjà promue (kbis).
// Non bloquant : la fiche est créée même si cette écriture échoue.
async function saveSpecialties(userId: string, slugs: unknown) {
  if (!Array.isArray(slugs)) return
  const clean = slugs
    .filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64)
    .slice(0, 40)
  if (clean.length === 0) return

  const { data: specialties, error } = await supabaseAdmin
    .from('specialties')
    .select('id, slug')
    .in('slug', clean)
  if (error) {
    logger.error('[create-profile] Specialties fetch error:', error)
    return
  }
  if (!specialties?.length) return

  const { error: upsertError } = await supabaseAdmin
    .from('profile_specialties')
    .upsert(
      specialties.map((s) => ({ user_id: userId, specialty_id: s.id, verified_source: 'self_declared' })),
      { onConflict: 'user_id,specialty_id', ignoreDuplicates: true },
    )
  if (upsertError) logger.error('[create-profile] Specialties upsert error:', upsertError)
}

// Gérant d'une société BTP : premier membre actif de son équipe, comme
// /api/pro/team/auto-init-gerant — qui exige un Bearer et échoue donc à
// l'inscription quand la confirmation d'e-mail est active (pas de session).
// Rôle lu dans app_metadata (posé par le trigger trg_sync_user_role, non
// forgeable), jamais dans user_metadata. Idempotent et non bloquant.
async function ensureGerant(authUser: User) {
  if (authUser.app_metadata?.role !== 'pro_societe' || !authUser.email) return
  const email = authUser.email.toLowerCase().trim()
  const fullName = typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name.trim() : ''
  const phone = typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone.trim() : ''

  const { error } = await supabaseAdmin
    .from('pro_team_members')
    .upsert(
      {
        company_id: authUser.id,             // pour le gérant, company_id = son propre id
        user_id: authUser.id,
        email,
        full_name: fullName || email,
        phone,
        role: 'GERANT',
        assigned_chantiers: [],
        invite_token: null,
        invite_sent_at: null,
        accepted_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: 'company_id,email', ignoreDuplicates: true },
    )
  if (error) logger.error('[create-profile] Gerant insert error:', error)
}
