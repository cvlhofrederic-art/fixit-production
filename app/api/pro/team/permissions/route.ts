import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isProSocieteRole, resolveCompanyId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/pro/team/permissions?self=true ──────────────────────────────────
// Fetch permission overrides for the authenticated user (sub-account)
// Or for a specific member_id (gérant only)
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isProSocieteRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`pro_perms_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const isSelf = searchParams.get('self') === 'true'
  const memberId = searchParams.get('member_id')

  if (isSelf) {
    // Find this user's team membership
    const { data: membership } = await supabaseAdmin
      .from('pro_team_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ overrides: [] })
    }

    const { data: overrides } = await supabaseAdmin
      .from('pro_role_permissions')
      .select('module_id, access_level')
      .eq('member_id', membership.id)

    return NextResponse.json({ overrides: overrides || [] })
  }

  if (memberId) {
    const companyId = await resolveCompanyId(user, supabaseAdmin)

    // Verify member belongs to this company
    const { data: member } = await supabaseAdmin
      .from('pro_team_members')
      .select('id')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    const { data: overrides } = await supabaseAdmin
      .from('pro_role_permissions')
      .select('module_id, access_level')
      .eq('member_id', memberId)

    return NextResponse.json({ overrides: overrides || [] })
  }

  return NextResponse.json({ error: 'Paramètre self=true ou member_id requis' }, { status: 400 })
}
