import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/syndic/invite?token=xxx ─────────────────────────────────────────
// Valider un token d'invitation (pour afficher la page d'accueil)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`invite_get_${ip}`, 20, 60_000)) return rateLimitResponse()

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token manquant' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_team_members')
    .select('id, email, full_name, role, cabinet_id, accepted_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Invitation invalide ou expirée' }, { status: 404 })
  }

  if (data.accepted_at) {
    return NextResponse.json({ error: 'Invitation déjà utilisée' }, { status: 409 })
  }

  return NextResponse.json({
    valid: true,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
  })
}

// ── POST /api/syndic/invite ───────────────────────────────────────────────────
// Accepter une invitation (crée le compte ou lie un compte existant)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`invite_post_${ip}`, 5, 60_000)) return rateLimitResponse()

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
      // Récupérer le compte existant
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = !listError ? users.find(u => u.email === invite.email) : null

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

    console.error('[INVITE] Auth error:', authError)
    return NextResponse.json({ error: `Erreur création de compte : ${authError.message}` }, { status: 500 })
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
    console.error('[INVITE] Update error:', updateError)
  }

  return NextResponse.json({
    success: true,
    message: 'Compte créé avec succès. Vous pouvez maintenant vous connecter.',
    email: invite.email,
  })
}
