import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, proInviteAcceptSchema } from '@/lib/validation'
import {
  lireJetonDuLien,
  signatureValide,
  compteRattachable,
  MESSAGE_COMPTE_AUTRE_ESPACE,
} from '@/lib/equipe/lien-invitation'

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Invitation désignée par un lien signé (lib/equipe/lien-invitation.ts). Renvoie null si le lien est mal
 * formé, inconnu, ou ne correspond plus à la ligne (e-mail, jeton ou société modifiés après l'envoi).
 * Le jeton seul, tel qu'il est enregistré dans pro_team_members, ne suffit pas.
 */
async function lireInvitation(token: string) {
  const lien = lireJetonDuLien(token)
  if (!lien) return null

  const { data, error } = await supabaseAdmin
    .from('pro_team_members')
    .select('*')
    .eq('invite_token', lien.jeton)
    .maybeSingle()
  if (error || !data) return null

  const valide = await signatureValide('pro', lien.signature, {
    id: data.id,
    email: data.email,
    invite_token: data.invite_token,
    equipe_id: data.company_id,
  })
  return valide ? data : null
}

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

    const data = await lireInvitation(token)
    if (!data) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
    }

    if (data.accepted_at) {
      return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
    }

    // Check expiry
    if (data.created_at && Date.now() - new Date(data.created_at).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: 'Invitation expirée. Demandez une nouvelle invitation.' }, { status: 410 })
    }

    // Fetch company name
    const { data: companyProfile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name')
      .eq('user_id', data.company_id)
      .maybeSingle()

    // Masked email
    const maskedEmail = data.email
      ? data.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
      : ''

    return NextResponse.json({
      valid: true,
      email: maskedEmail,
      full_name: data.full_name,
      role: data.role,
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

    // Retrieve invitation (signed link only)
    const invite = await lireInvitation(token)
    if (!invite) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
    }

    if (invite.created_at && Date.now() - new Date(invite.created_at).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: 'Invitation expirée. Demandez une nouvelle invitation.' }, { status: 410 })
    }

    // Create Supabase auth user — rôle dans app_metadata (server-only)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      app_metadata: {
        role: 'pro_societe',
        pro_team_role: invite.role,
        company_id: invite.company_id,
      },
      user_metadata: {
        full_name: invite.full_name,
      },
    })

    if (authError) {
      // If account already exists, link it
      if (authError.message?.includes('already')) {
        let existingUser: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null = null
        let page = 1
        const perPage = 100
        while (!existingUser) {
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
          if (listError || !users || users.length === 0) break
          existingUser = users.find(u => u.email === invite.email) || null
          if (users.length < perPage) break
          page++
        }

        if (existingUser) {
          const { data: existingFull, error: lectureError } = await supabaseAdmin.auth.admin.getUserById(existingUser.id)
          if (lectureError || !existingFull?.user) {
            logger.error('[PRO_INVITE] Lecture du compte existant impossible:', lectureError)
            return NextResponse.json({ error: 'Erreur lors de la liaison du compte' }, { status: 500 })
          }
          const appMetadata = existingFull.user.app_metadata || {}

          // Un compte d'un autre espace (artisan, client, gérant, cabinet, admin…) n'est jamais converti.
          if (!compteRattachable('pro', appMetadata)) {
            return NextResponse.json({ error: MESSAGE_COMPTE_AUTRE_ESPACE }, { status: 409 })
          }

          const { error: majError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            app_metadata: {
              ...appMetadata,
              role: 'pro_societe',
              pro_team_role: invite.role,
              company_id: invite.company_id,
            },
          })
          if (majError) {
            logger.error('[PRO_INVITE] Liaison du compte existant impossible:', majError)
            return NextResponse.json({ error: 'Erreur lors de la liaison du compte' }, { status: 500 })
          }

          await supabaseAdmin
            .from('pro_team_members')
            .update({
              user_id: existingUser.id,
              accepted_at: new Date().toISOString(),
              invite_token: null,
            })
            .eq('id', invite.id)

          return NextResponse.json({
            success: true,
            message: 'Compte lié avec succès. Vous pouvez maintenant vous connecter.',
          })
        }
      }

      logger.error('[PRO_INVITE] Auth error:', authError)
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    const newUser = authData.user
    if (!newUser) {
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    // Mark invitation as accepted + link user_id
    const { error: updateError } = await supabaseAdmin
      .from('pro_team_members')
      .update({
        user_id: newUser.id,
        accepted_at: new Date().toISOString(),
        invite_token: null,
      })
      .eq('id', invite.id)

    if (updateError) {
      logger.error('[PRO_INVITE] Update error:', updateError)
      return NextResponse.json({
        success: false,
        message: 'Le compte a été créé mais l\'invitation n\'a pas pu être validée. Contactez le support.',
        email: invite.email,
      }, { status: 207 })
    }

    // Audit log
    await supabaseAdmin.from('pro_team_audit_log').insert({
      company_id: invite.company_id,
      actor_id: newUser.id,
      action: 'accept_invite',
      target_member_id: invite.id,
      details: { role: invite.role },
    })

    return NextResponse.json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      email: invite.email,
    })
  } catch (err) {
    logger.error('[pro/invite/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
