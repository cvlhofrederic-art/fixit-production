import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, isSuperAdmin, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { syndicArtisanSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ── GET /api/syndic/artisans — Lister les artisans liés au cabinet ────────────
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_artisans_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // cabinet_id = soit le user lui-même (admin), soit son cabinet_id (employé)
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

  // Super admin sans cabinet_id → voir TOUS les artisans de tous les cabinets
  let query = supabaseAdmin
    .from('syndic_artisans')
    .select('id, cabinet_id, artisan_user_id, email, nom, prenom, nom_famille, telephone, metier, siret, statut, vitfix_certifie, note, nb_interventions, rc_pro_valide, rc_pro_expiration, assurance_decennale_valide, assurance_decennale_expiration, compte_existant, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!isSuperAdmin(user)) {
    query = query.eq('cabinet_id', cabinetId)
  }

  const { data, error } = await query

  if (error) {
    logger.error('[ARTISANS GET]', error)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  const artisans = data || []

  // ── Batch: resolve missing artisan_user_id via profiles_artisan ──────────
  // Instead of N individual queries, do ONE batch query with .in()
  const missingUserIdEmails = artisans
    .filter(a => !a.artisan_user_id && a.email)
    .map(a => a.email!.toLowerCase())

  if (missingUserIdEmails.length > 0) {
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id, user_id, email')
        .in('email', missingUserIdEmails)

      if (profiles && profiles.length > 0) {
        const profileByEmail = new Map(profiles.map(p => [p.email?.toLowerCase(), p]))

        for (const artisan of artisans) {
          if (!artisan.artisan_user_id && artisan.email) {
            const profile = profileByEmail.get(artisan.email.toLowerCase())
            if (profile?.user_id) {
              artisan.artisan_user_id = profile.user_id
              // Fire-and-forget: link for future calls
              void supabaseAdmin
                .from('syndic_artisans')
                .update({ artisan_user_id: profile.user_id, updated_at: new Date().toISOString() })
                .eq('id', artisan.id)
            }
          }
        }
      }
    } catch { /* storage check failed, non-blocking */ }
  }

  // ── Batch: resolve profileIds for artisans with user_id ─────────────────
  const userIdsWithUser = artisans
    .filter(a => a.artisan_user_id)
    .map(a => a.artisan_user_id!)

  const profileIdMap = new Map<string, string>()
  if (userIdsWithUser.length > 0) {
    try {
      const { data: profiles } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id, user_id')
        .in('user_id', userIdsWithUser)

      if (profiles) {
        for (const p of profiles) {
          profileIdMap.set(p.user_id, p.id)
        }
      }
    } catch { /* storage check failed, non-blocking */ }
  }

  // ── Parallel: check RC Pro + Décennale in Storage ───────────────────────
  // Run all storage checks concurrently instead of sequential per-artisan
  const artisansNeedingCheck = artisans.filter(
    a => (!a.rc_pro_valide || !a.assurance_decennale_valide) && a.artisan_user_id
  )

  const storageChecks: Promise<void>[] = []
  for (const artisan of artisansNeedingCheck) {
    const userId = artisan.artisan_user_id!
    const profileId = profileIdMap.get(userId)
    const storagePaths: string[] = [userId]
    if (profileId && profileId !== userId) storagePaths.push(profileId)

    if (!artisan.rc_pro_valide) {
      storageChecks.push((async () => {
        for (const base of storagePaths) {
          try {
            const { data: files } = await supabaseAdmin.storage
              .from('artisan-documents')
              .list(`wallet/${base}/rc_pro`, { limit: 5 })
            const realFiles = (files || []).filter((f: any) => f.name !== '.emptyFolderPlaceholder' && (f.metadata?.size || f.size || 1) > 0)
            if (realFiles.length > 0) {
              artisan.rc_pro_valide = true
              void supabaseAdmin
                .from('syndic_artisans')
                .update({ rc_pro_valide: true, updated_at: new Date().toISOString() })
                .eq('id', artisan.id)
              return
            }
          } catch { /* storage check failed, non-blocking */ }
        }
      })())
    }

    if (!artisan.assurance_decennale_valide) {
      storageChecks.push((async () => {
        for (const base of storagePaths) {
          for (const docKey of ['assurance_decennale', 'decennale']) {
            try {
              const { data: files } = await supabaseAdmin.storage
                .from('artisan-documents')
                .list(`wallet/${base}/${docKey}`, { limit: 5 })
              const realFiles = (files || []).filter((f: any) => f.name !== '.emptyFolderPlaceholder' && (f.metadata?.size || f.size || 1) > 0)
              if (realFiles.length > 0) {
                artisan.assurance_decennale_valide = true
                void supabaseAdmin
                  .from('syndic_artisans')
                  .update({ assurance_decennale_valide: true, updated_at: new Date().toISOString() })
                  .eq('id', artisan.id)
                return
              }
            } catch { /* storage check failed, non-blocking */ }
          }
        }
      })())
    }
  }

  // Run all storage checks in parallel
  await Promise.allSettled(storageChecks)

  return NextResponse.json({ artisans })
}

// ── POST /api/syndic/artisans — Ajouter un artisan (existant ou nouveau) ──────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_artisans_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

  const body = await request.json()
  const validation = validateBody(syndicArtisanSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
  }
  const { email, nom, prenom, telephone, metier, siret, action } = validation.data

  // 1. Chercher si l'artisan a déjà un compte Vitfix (d'abord par profiles_artisan, puis paginé)
  let existingUser: any = null

  // Stratégie rapide : chercher par email dans profiles_artisan
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles_artisan')
    .select('user_id')
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (existingProfile?.user_id) {
    try {
      const { data: { user: foundUser } } = await supabaseAdmin.auth.admin.getUserById(existingProfile.user_id)
      if (foundUser) existingUser = foundUser
    } catch { /* storage check failed, non-blocking */ }
  }

  // Fallback : listUsers paginé
  if (!existingUser) {
    let page = 1
    const perPage = 100
    let done = false
    while (!done && page <= 10) {
      const { data: { users: pageUsers } } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      const found = pageUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase())
      if (found) { existingUser = found; break }
      if (pageUsers.length < perPage) done = true
      page++
    }
  }

  let artisanUserId: string | null = null
  let isExistingAccount = false
  let accountCreated = false

  if (existingUser) {
    // Compte existant — vérifier si c'est un artisan
    const existingRole = existingUser.user_metadata?.role
    artisanUserId = existingUser.id
    isExistingAccount = true

    if (existingRole === 'artisan') {
      // Artisan Vitfix existant — synchroniser avec le cabinet
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
    const tempPassword = crypto.randomBytes(16).toString('hex') + 'A1!'
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
      logger.error('[ARTISANS] Create user error:', createError.message)
      return NextResponse.json({ error: 'Erreur lors de la création du compte artisan' }, { status: 500 })
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

  // 2. Vérifier si l'artisan a déjà une RC Pro + Décennale dans le storage
  //    Chemins possibles : wallet/${auth_user_id}/... OU wallet/${profile_id}/...
  let rcProValide = false
  let rcProExpiration: string | null = null
  let decennaleValide = false
  let decennaleExpiration: string | null = null

  if (artisanUserId) {
    const basePaths: string[] = [artisanUserId]
    // Chercher aussi le profile_id (peut différer de user_id)
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id')
        .eq('user_id', artisanUserId)
        .maybeSingle()
      if (profile && profile.id !== artisanUserId) {
        basePaths.push(profile.id)
      }
    } catch { /* storage check failed, non-blocking */ }

    // Vérifier RC Pro
    for (const base of basePaths) {
      if (rcProValide) break
      try {
        const { data: rcFiles } = await supabaseAdmin.storage
          .from('artisan-documents')
          .list(`wallet/${base}/rc_pro`, { limit: 5 })
        const realFiles = (rcFiles || []).filter((f: any) => f.name !== '.emptyFolderPlaceholder' && (f.metadata?.size || f.size || 1) > 0)
        if (realFiles.length > 0) {
          rcProValide = true
          // RC Pro document found
        }
      } catch { /* storage check failed, non-blocking */ }
    }

    // Vérifier Décennale (clés : 'assurance_decennale' ou 'decennale')
    for (const base of basePaths) {
      if (decennaleValide) break
      for (const docKey of ['assurance_decennale', 'decennale']) {
        if (decennaleValide) break
        try {
          const { data: decFiles } = await supabaseAdmin.storage
            .from('artisan-documents')
            .list(`wallet/${base}/${docKey}`, { limit: 5 })
          const realFiles = (decFiles || []).filter((f: any) => f.name !== '.emptyFolderPlaceholder' && (f.metadata?.size || f.size || 1) > 0)
          if (realFiles.length > 0) {
            decennaleValide = true
            // Decennale document found
          }
        } catch { /* storage check failed, non-blocking */ }
      }
    }
  }

  // 3. Insérer dans syndic_artisans (lien cabinet ↔ artisan)
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
      rc_pro_valide: rcProValide,
      rc_pro_expiration: rcProExpiration,
      assurance_decennale_valide: decennaleValide,
      assurance_decennale_expiration: decennaleExpiration,
      compte_existant: isExistingAccount,
      created_at: new Date().toISOString(),
    }, { onConflict: 'cabinet_id,email' })
    .select()
    .single()

  if (insertError) {
    logger.error('[ARTISANS INSERT]', insertError)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
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
  if (!(await checkRateLimit(`syndic_artisans_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const body = await request.json()
  const { artisan_id, ...updates } = body

  if (!artisan_id) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const allowedFields = ['statut', 'metier', 'telephone', 'siret', 'rc_pro_valide', 'rc_pro_expiration', 'assurance_decennale_valide', 'assurance_decennale_expiration', 'note']
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

  if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  return NextResponse.json({ success: true, artisan: data })
}

// ── DELETE /api/syndic/artisans — Retirer un artisan du cabinet ───────────────
export async function DELETE(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_artisans_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const { searchParams } = new URL(request.url)
  const artisanId = searchParams.get('artisan_id')

  if (!artisanId) return NextResponse.json({ error: 'artisan_id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('syndic_artisans')
    .delete()
    .eq('id', artisanId)
    .eq('cabinet_id', cabinetId)

  if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  return NextResponse.json({ success: true })
}
