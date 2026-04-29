import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit: 5 profile creations per IP per 10 minutes
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`create_profile_${ip}`, 5, 600_000))) return rateLimitResponse()

  try {
    const body = await request.json()
    const { user_id, ...profileData } = body

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
      return NextResponse.json({ id: existing.id })
    }

    // Only allow fields that exist in profiles_artisan
    const ALLOWED_FIELDS = [
      'user_id', 'company_name', 'siret', 'siren', 'bio', 'categories',
      'verified', 'kyc_status', 'kyc_market', 'phone', 'email', 'language',
      'legal_form', 'naf_code', 'naf_label', 'company_address', 'company_city',
      'company_postal_code',
    ]
    const sanitized: Record<string, unknown> = { user_id }
    for (const key of ALLOWED_FIELDS) {
      if (key in profileData) sanitized[key] = profileData[key]
    }

    const { data, error } = await supabaseAdmin
      .from('profiles_artisan')
      .insert(sanitized)
      .select('id')
      .single()

    if (error) {
      logger.error('[create-profile] Insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ id: data.id })
  } catch (err) {
    logger.error('[create-profile] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
