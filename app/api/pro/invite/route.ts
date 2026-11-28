import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, proInviteAcceptSchema } from '@/lib/validation'
import {
  lireInvitationValide,
  accepterInvitationAvecConnexion,
  etatCompteInvite,
  masquerEmail,
} from '@/lib/equipe/invitation-serveur'
import { ouvrirSessionInvite } from '@/lib/equipe/session-invite'

// Le lien d'invitation est signé et n'est envoyé qu'à la boîte mail invitée (lib/equipe/lien-invitation.ts) :
// le jeton seul, tel qu'il est enregistré dans pro_team_members, ne suffit pas pour lire ou accepter.
//
// Parcours « comme les grands logiciels » (28/11/2026) : la page sait d'avance si l'adresse a déjà un compte
// (etat_compte). Sans compte, l'invité choisit un mot de passe ; avec un compte, il tape celui de ce compte, qui est
// vérifié avant tout rattachement. Dans les deux cas il repart avec sa session et entre directement dans son espace.
// La page écrit ses messages dans la langue de la société (langue) d'après les codes renvoyés ici.

/** Tentatives d'acceptation par invitation : borne les essais de mot de passe d'un compte existant. */
const ESSAIS_PAR_INVITATION = 10
const FENETRE_ESSAIS_MS = 15 * 60_000

// ── GET /api/pro/invite?token=xxx ───────────────────────────────────────────
// Validate an invitation token (for the accept page)
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_invite_get_${ip}`, 20, 60_000))) return rateLimitResponse()

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token manquant', code: 'invalide' }, { status: 400 })
    }

    const lecture = await lireInvitationValide('pro', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error, code: lecture.code }, { status: lecture.status })
    }
    const { invite } = lecture

    // Nom et langue de la société (fiche du compte titulaire ; user_id n'est pas unique : la plus ancienne, comme
    // l'e-mail d'invitation), et état du compte de l'adresse invitée.
    const [{ data: fiches }, etatCompte] = await Promise.all([
      supabaseAdmin
        .from('profiles_artisan')
        .select('company_name, language')
        .eq('user_id', invite.equipe_id)
        .order('id', { ascending: true })
        .limit(1),
      etatCompteInvite('pro', invite.email),
    ])
    const companyProfile = (fiches as Array<{ company_name?: string | null; language?: string | null }> | null)?.[0]

    return NextResponse.json({
      valid: true,
      email: masquerEmail(invite.email),
      full_name: invite.full_name,
      role: invite.role,
      company_name: companyProfile?.company_name || 'Entreprise',
      langue: companyProfile?.language === 'pt' ? 'pt' : 'fr',
      etat_compte: etatCompte,
    })
  } catch (err) {
    logger.error('[pro/invite/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error', code: 'erreur' }, { status: 500 })
  }
}

// ── POST /api/pro/invite ────────────────────────────────────────────────────
// Accept an invitation (creates or links the user account), then opens the invitee's session
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`pro_invite_post_${ip}`, 5, 60_000))) return rateLimitResponse()

    const body = await request.json()
    const validation = validateBody(proInviteAcceptSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error, code: 'requete' }, { status: 400 })
    }
    const { token, password } = validation.data

    const lecture = await lireInvitationValide('pro', token)
    if (!lecture.ok) {
      return NextResponse.json({ error: lecture.error, code: lecture.code }, { status: lecture.status })
    }
    const { invite } = lecture

    // Chaque envoi est un essai de mot de passe pour cette adresse : bornés par invitation, et comptés avec ceux de la
    // connexion à ce compte (même clé que /api/auth/login).
    if (!(await checkRateLimit(`pro_invite_essais_${invite.id}`, ESSAIS_PAR_INVITATION, FENETRE_ESSAIS_MS))
      || !(await checkRateLimit(`login_email_${invite.email.toLowerCase().trim()}`, ESSAIS_PAR_INVITATION, FENETRE_ESSAIS_MS))) {
      return rateLimitResponse()
    }

    // Rôle dans app_metadata (server-only)
    const resultat = await accepterInvitationAvecConnexion('pro', invite, password, {
      role: 'pro_societe',
      pro_team_role: invite.role,
      company_id: invite.equipe_id,
    })

    // Journal de l'équipe : compte créé ou compte existant rattaché
    const compteId = resultat.nouveauCompteId ?? resultat.compteRattacheId
    if (compteId) {
      const { error: journalError } = await supabaseAdmin.from('pro_team_audit_log').insert({
        company_id: invite.equipe_id,
        actor_id: compteId,
        action: 'accept_invite',
        target_member_id: invite.id,
        details: { role: invite.role, compte_existant: !resultat.nouveauCompteId },
      })
      if (journalError) logger.warn('[pro/invite/POST] journal de l’équipe non écrit', { message: journalError.message })
    }

    // Invitation acceptée : l'invité repart avec sa session (son jeton porte déjà le rôle et la société).
    if (resultat.status === 200) {
      const session = await ouvrirSessionInvite(invite.email, password)
      if (session) return NextResponse.json({ ...resultat.corps, session }, { status: 200 })
    }

    return NextResponse.json(resultat.corps, { status: resultat.status })
  } catch (err) {
    logger.error('[pro/invite/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error', code: 'erreur' }, { status: 500 })
  }
}
