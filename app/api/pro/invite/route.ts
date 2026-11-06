import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, proInviteAcceptSchema } from '@/lib/validation'
import { lireInvitationValide, accepterInvitation, masquerEmail } from '@/lib/equipe/invitation-serveur'

// Le lien d'invitation est signé et n'est envoyé qu'à la boîte mail invitée (lib/equipe/lien-invitation.ts) :
// le jeton seul, tel qu'il est enregistré dans pro_team_members, ne suffit pas pour lire ou accepter.

// ── GET /api/pro/invite?token=xxx ───────────────────────────────────────────
// Validate an invitation token (for the accept page)
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_invite_get_${ip}`, 20, 60_000))) return rateLimitResponse()

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    const lecture = await lireInvitationValide('pro', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error }, { status: lecture.status })
    }
    const { invite } = lecture

    // Fetch company name
    const { data: companyProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name')
      .eq('user_id', invite.equipe_id)
      .maybeSingle()

    return NextResponse.json({
      valid: true,
      email: masquerEmail(invite.email),
      full_name: invite.full_name,
      role: invite.role,
      company_name: companyProfile?.company_name || 'Entreprise',
    })
  } catch (err) {
    logger.error('[pro/invite/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/pro/invite ────────────────────────────────────────────────────
// Accept an invitation (creates or links the user account)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_invite_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const validation = validateBody(proInviteAcceptSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { token, password } = validation.data

    const lecture = await lireInvitationValide('pro', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error }, { status: lecture.status })
    }
    const { invite } = lecture

    // Rôle dans app_metadata (server-only)
    const resultat = await accepterInvitation('pro', invite, password, {
      role: 'pro_societe',
      pro_team_role: invite.role,
      company_id: invite.equipe_id,
    })

    // Audit log (new account)
    if (resultat.nouveauCompteId) {
      await supabaseAdmin.from('pro_team_audit_log').insert({
        company_id: invite.equipe_id,
        actor_id: resultat.nouveauCompteId,
        action: 'accept_invite',
        target_member_id: invite.id,
        details: { role: invite.role },
      })
    }

    return NextResponse.json(resultat.corps, { status: resultat.status })
  } catch (err) {
    logger.error('[pro/invite/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
