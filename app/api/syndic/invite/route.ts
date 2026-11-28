import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, syndicInviteSchema } from '@/lib/validation'
import { lireInvitationValide, accepterInvitation, masquerEmail } from '@/lib/equipe/invitation-serveur'

// Le lien d'invitation est signé et n'est envoyé qu'à la boîte mail invitée (lib/equipe/lien-invitation.ts) :
// le jeton seul, tel qu'il est enregistré dans syndic_team_members, ne suffit pas pour lire ou accepter.

// ── GET /api/syndic/invite?token=xxx ─────────────────────────────────────────
// Valider un token d'invitation (pour afficher la page d'accueil)
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`invite_get_${ip}`, 20, 60_000))) return rateLimitResponse()

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
    }

    // Réponse générique (404) si le lien est invalide, pour ne pas révéler si le token existe
    const lecture = await lireInvitationValide('syndic', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error }, { status: lecture.status })
    }

    // Retourner uniquement les infos minimales (masquer l'email complet)
    return NextResponse.json({
      valid: true,
      email: masquerEmail(lecture.invite.email),
      full_name: lecture.invite.full_name,
      role: lecture.invite.role,
    })
  } catch (err) {
    logger.error('[syndic/invite/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST /api/syndic/invite ───────────────────────────────────────────────────
// Accepter une invitation (crée le compte ou lie un compte existant)
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`invite_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const validation = validateBody(syndicInviteSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const { token, password } = validation.data

    const lecture = await lireInvitationValide('syndic', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error }, { status: lecture.status })
    }

    // Rôle et cabinet_id dans app_metadata (non forgeable)
    const { invite } = lecture
    const resultat = await accepterInvitation('syndic', invite, password, {
      role: invite.role,
      cabinet_id: invite.equipe_id,
    })
    return NextResponse.json(resultat.corps, { status: resultat.status })
  } catch (err) {
    logger.error('[syndic/invite/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
