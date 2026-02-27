import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// ── GET /api/syndic/artisans — Lister les artisans liés au cabinet ────────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_artisans_get_${ip}`, 30, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // cabinet_id = soit le user lui-même (admin), soit son cabinet_id (employé)
  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_artisans')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[ARTISANS GET]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ artisans: data || [] })
}

// ── POST /api/syndic/artisans — Ajouter un artisan (existant ou nouveau) ──────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_artisans_post_${ip}`, 10, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const body = await request.json()
  const { email, nom, prenom, telephone, metier, siret, action } = body

  if (!email || !nom) {
    return NextResponse.json({ error: 'Email et nom requis' }, { status: 400 })
  }

  // 1. Chercher si l'artisan a déjà un compte VitFix
  const { data: { users: allUsers } } = await supabaseAdmin.auth.admin.listUsers()
  const existingUser = allUsers.find(u => u.email?.toLowerCase() === email.toLowerCase())

  let artisanUserId: string | null = null
  let isExistingAccount = false
  let accountCreated = false

  if (existingUser) {
    // Compte existant — vérifier si c'est un artisan
    const existingRole = existingUser.user_metadata?.role
    artisanUserId = existingUser.id
    isExistingAccount = true

    if (existingRole === 'artisan') {
      // Artisan VitFix existant — synchroniser avec le cabinet
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: {
          ...existingUser.user_metadata,
          syndic_cabinet_id: cabinetId,
          syndic_linked_at: new Date().toISOString(),
        }
      })
    }
  } else if (action === 'create') {
    // Créer un nouveau compte artisan
    const tempPassword = Math.random().toString(36).slice(-10) + 'A1!'
    const { data: newAuth, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: `${prenom || ''} ${nom}`.trim(),
        role: 'artisan',
        telephone,
        metier,
        syndic_cabinet_id: cabinetId,
        syndic_linked_at: new Date().toISOString(),
        temp_password: true,
      }
    })

    if (createError) {
      return NextResponse.json({ error: `Erreur création compte: ${createError.message}` }, { status: 500 })
    }

    artisanUserId = newAuth.user?.id || null
    accountCreated = true

    // Créer le profil artisan dans profiles_artisan
    if (artisanUserId) {
      await supabaseAdmin.from('profiles_artisan').upsert({
        user_id: artisanUserId,
        nom,
        prenom: prenom || '',
        email,
        telephone: telephone || '',
        metier: metier || 'Non spécifié',
        siret: siret || '',
        statut: 'actif',
        created_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
    }

    // Envoyer email d'invitation (si SMTP configuré)
    // await sendInviteEmail(email, nom, tempPassword)
  }

  // 2. Insérer dans syndic_artisans (lien cabinet ↔ artisan)
  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('syndic_artisans')
    .upsert({
      cabinet_id: cabinetId,
      artisan_user_id: artisanUserId,
      email,
      nom: `${prenom || ''} ${nom}`.trim(),
      prenom: prenom || '',
      nom_famille: nom,
      telephone: telephone || '',
      metier: metier || 'Non spécifié',
      siret: siret || '',
      statut: 'actif',
      vitfix_certifie: isExistingAccount && existingUser?.user_metadata?.role === 'artisan',
      note: 0,
      nb_interventions: 0,
      rc_pro_valide: false,
      rc_pro_expiration: null,
      compte_existant: isExistingAccount,
      created_at: new Date().toISOString(),
    }, { onConflict: 'cabinet_id,email' })
    .select()
    .single()

  if (insertError) {
    console.error('[ARTISANS INSERT]', insertError)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    artisan: inserted,
    isExistingAccount,
    accountCreated,
    message: isExistingAccount
      ? 'Artisan existant synchronisé avec votre cabinet'
      : accountCreated
        ? 'Compte artisan créé et lié à votre cabinet'
        : 'Artisan ajouté — compte à créer si besoin',
  })
}

// ── PATCH /api/syndic/artisans — Modifier un artisan ─────────────────────────
export async function PATCH(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_artisans_patch_${ip}`, 20, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()
  const { artisan_id, ...updates } = body

  if (!artisan_id) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const allowedFields = ['statut', 'metier', 'telephone', 'siret', 'rc_pro_valide', 'rc_pro_expiration', 'note']
  const safeUpdates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in updates) safeUpdates[key] = updates[key]
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_artisans')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('id', artisan_id)
    .eq('cabinet_id', cabinetId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, artisan: data })
}

// ── DELETE /api/syndic/artisans — Retirer un artisan du cabinet ───────────────
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  if (!checkRateLimit(`syndic_artisans_delete_${ip}`, 10, 60_000)) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('syndic_artisans')
    .delete()
    .eq('id', artisanId)
    .eq('cabinet_id', cabinetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
