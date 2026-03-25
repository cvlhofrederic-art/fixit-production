import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

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

    // Sécurité : token doit avoir un format valide (48 hex chars) pour éviter énumération
    if (!/^[a-f0-9]{48}$/i.test(token)) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_team_members')
      .select('id, email, full_name, role, cabinet_id, accepted_at, created_at')
      .eq('invite_token', token)
      .maybeSingle()

    if (error || !data) {
      // Réponse générique pour ne pas révéler si le token existe
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
    }

    if (data.accepted_at) {
      return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
    }

    // Expiration : 7 jours après création
    const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
    if (data.created_at && Date.now() - new Date(data.created_at).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: 'Invitation expirée. Demandez une nouvelle invitation.' }, { status: 410 })
    }

    // Retourner uniquement les infos minimales (masquer l'email complet)
    const maskedEmail = data.email
      ? data.email.replace(/^(.{2})(.*)(@.*)$/, '$1***$3')
      : ''

    return NextResponse.json({
      valid: true,
      email: maskedEmail,
      full_name: data.full_name,
      role: data.role,
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
    const { token, password } = body

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'Token et mot de passe (8 caractères min) requis' }, { status: 400 })
    }

    // Récupérer l'invitation
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('syndic_team_members')
      .select('*')
      .eq('invite_token', token)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
    }

    if (invite.accepted_at) {
      return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
    }

    // Expiration : 7 jours après création
    const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000
    if (invite.created_at && Date.now() - new Date(invite.created_at).getTime() > INVITE_EXPIRY_MS) {
      return NextResponse.json({ error: 'Invitation expirée. Demandez une nouvelle invitation.' }, { status: 410 })
    }

    // Créer le compte utilisateur Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true, // Confirmer directement sans email
      user_metadata: {
        full_name: invite.full_name,
        role: invite.role,
        cabinet_id: invite.cabinet_id,
      },
    })

    if (authError) {
      // Si le compte existe déjà, on le lie
      if (authError.message?.includes('already')) {
        // Récupérer le compte existant (pagination pour éviter de charger tous les users en mémoire)
        let existingUser: any = null
        let page = 1
        const perPage = 100
        while (!existingUser) {
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
          if (listError || !users || users.length === 0) break
          existingUser = users.find(u => u.email === invite.email) || null
          if (users.length < perPage) break // dernière page
          page++
        }

        if (existingUser) {
          // Mettre à jour les metadata
          await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              ...existingUser.user_metadata,
              role: invite.role,
              cabinet_id: invite.cabinet_id,
            },
          })

          // Marquer l'invitation comme acceptée
          await supabaseAdmin
            .from('syndic_team_members')
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

      logger.error('[INVITE] Auth error:', authError)
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    const newUser = authData.user
    if (!newUser) {
      return NextResponse.json({ error: 'Erreur lors de la création du compte' }, { status: 500 })
    }

    // Marquer l'invitation comme acceptée + lier l'user_id
    const { error: updateError } = await supabaseAdmin
      .from('syndic_team_members')
      .update({
        user_id: newUser.id,
        accepted_at: new Date().toISOString(),
        invite_token: null, // Invalider le token
      })
      .eq('id', invite.id)

    if (updateError) {
      logger.error('[INVITE] Update error:', updateError)
      // Le compte a été créé mais l'invitation n'a pas été marquée comme acceptée
      // → retourner une erreur partielle pour que l'admin sache qu'il faut vérifier
      return NextResponse.json({
        success: false,
        message: 'Le compte a été créé mais l\'invitation n\'a pas pu être validée. Contactez le support.',
        email: invite.email,
      }, { status: 207 })
    }

    return NextResponse.json({
      success: true,
      message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
      email: invite.email,
    })
  } catch (err) {
    logger.error('[syndic/invite/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
