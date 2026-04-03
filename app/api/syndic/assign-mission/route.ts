import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, isSuperAdmin, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { assignMissionSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'

// ── POST /api/syndic/assign-mission ──────────────────────────────────────────
// Assigner une mission à un artisan : crée booking sur son agenda + notification
// Résolution multi-stratégie : user_id → email → nom (tolérant accents)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`assign_mission_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body = await request.json()
  const validation = validateBody(assignMissionSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
  }

  // ── Résolution cabinetId (super_admin peut agir sur n'importe quel cabinet) ──
  let cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (isSuperAdmin(user)) {
    const targetEmail = body.artisan_email?.toLowerCase()
    const targetUserId = body.artisan_user_id
    const targetName = body.artisan_name?.trim()

    // 1. Par user_id ou email
    if (targetEmail || targetUserId) {
      let query = supabaseAdmin.from('syndic_artisans').select('cabinet_id').limit(1)
      if (targetUserId) query = query.eq('artisan_user_id', targetUserId)
      else if (targetEmail) query = query.eq('email', targetEmail)
      const { data: saRecord } = await query.maybeSingle()
      if (saRecord?.cabinet_id) {
        cabinetId = saRecord.cabinet_id
        // Super admin: cabinet resolved via email/user_id
      }
    }

    // 2. Par nom (cas fréquent : Fixy envoie seulement artisan_name)
    if (cabinetId === user.id && targetName) {
      const normName = targetName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      const { data: allArtisans } = await supabaseAdmin
        .from('syndic_artisans')
        .select('cabinet_id, nom')
      if (allArtisans) {
        const nameMatch = allArtisans.find((a: { nom?: string; cabinet_id?: string }) => {
          const aNorm = (a.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          const normParts = normName.split(/\s+/)
          return normParts.every((p: string) => aNorm.includes(p)) || aNorm.includes(normName)
        })
        if (nameMatch?.cabinet_id) {
          cabinetId = nameMatch.cabinet_id
          // Super admin: cabinet resolved via name match
        }
      }
    }

    // 3. Dernier recours : prendre le premier cabinet existant
    if (cabinetId === user.id) {
      const { data: firstCabinet } = await supabaseAdmin
        .from('syndic_artisans')
        .select('cabinet_id')
        .limit(1)
        .maybeSingle()
      if (firstCabinet?.cabinet_id) {
        cabinetId = firstCabinet.cabinet_id
        // Super admin: cabinet resolved via first existing
      }
    }
  }
  const {
    artisan_email,
    artisan_user_id: directUserId,
    artisan_name,
    description,
    type_travaux,
    date_intervention,
    immeuble,
    priorite = 'normale',
    notes = '',
  } = body

  // Validation souple : au minimum un identifiant artisan + description
  if ((!artisan_email && !directUserId && !artisan_name) || !description) {
    return NextResponse.json({ error: 'artisan_email, artisan_user_id ou artisan_name + description requis' }, { status: 400 })
  }

  // Si pas de date_intervention, utiliser aujourd'hui
  const effectiveDate = date_intervention || new Date().toISOString().split('T')[0]

  // ── 1. Trouver le compte artisan — multi-stratégie (fiable) ──────────────
  let artisanUserId: string | null = null
  let resolvedBy: string = 'none'

  // Stratégie A : user_id direct (le plus fiable)
  if (directUserId) {
    try {
      const { data: { user: directUser } } = await supabaseAdmin.auth.admin.getUserById(directUserId)
      if (directUser) {
        artisanUserId = directUser.id
        resolvedBy = 'A:direct_user_id'
        // Strategy A: found by direct user_id
      }
    } catch (e) {
      logger.error('[assign-mission] Strategy A failed:', e)
    }
  }

  // Stratégie B : chercher dans syndic_artisans par email (évite listUsers paginé)
  if (!artisanUserId && artisan_email) {
    const { data: saRecord } = await supabaseAdmin
      .from('syndic_artisans')
      .select('artisan_user_id')
      .eq('email', artisan_email.toLowerCase())
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (saRecord?.artisan_user_id) {
      artisanUserId = saRecord.artisan_user_id
      resolvedBy = 'B:syndic_artisans_email'
      // Strategy B: found in syndic_artisans by email
    } else {
      // Strategy B: no match in syndic_artisans
    }
  }

  // Stratégie C : chercher dans profiles_artisan par email
  if (!artisanUserId && artisan_email) {
    const { data: profile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('user_id')
      .eq('email', artisan_email.toLowerCase())
      .maybeSingle()
    if (profile?.user_id) {
      artisanUserId = profile.user_id
      resolvedBy = 'C:profiles_artisan_email'
      // Strategy C: found in profiles_artisan by email
    } else {
      // Strategy C: no artisan profile for email
    }
  }

  // Stratégie D : chercher par nom dans syndic_artisans (fallback vocal, tolérant accents)
  if (!artisanUserId && artisan_name) {
    const normName = artisan_name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    // Strategy D: name search

    // Super admin : chercher dans TOUS les cabinets (pas de filtre cabinet_id)
    let artQuery = supabaseAdmin
      .from('syndic_artisans')
      .select('id, artisan_user_id, email, nom, cabinet_id')
    if (!isSuperAdmin(user)) {
      artQuery = artQuery.eq('cabinet_id', cabinetId)
    }
    const { data: allCabinetArtisans, error: artErr } = await artQuery

    if (artErr) logger.error('[assign-mission] Strategy D query error:', artErr.message)
    if (allCabinetArtisans && allCabinetArtisans.length > 0) {
      const normParts = normName.split(/\s+/)
      const match = allCabinetArtisans.find((a: { nom?: string; cabinet_id?: string; artisan_user_id?: string; email?: string; id?: string }) => {
        const aNorm = (a.nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        return normParts.every((p: string) => aNorm.includes(p)) || aNorm.includes(normName)
      })

      if (match) {
        // Pour super_admin : utiliser le cabinet de l'artisan trouvé
        if (isSuperAdmin(user) && match.cabinet_id) {
          cabinetId = match.cabinet_id
        }

        if (match.artisan_user_id) {
          artisanUserId = match.artisan_user_id
          resolvedBy = 'D:syndic_artisans_name_direct'
        } else if (match.email) {
          // L'artisan est dans syndic_artisans mais sans user_id lié — essayer profiles_artisan
          const { data: profile } = await supabaseAdmin
            .from('profiles_artisan')
            .select('user_id')
            .eq('email', match.email.toLowerCase())
            .maybeSingle()
          if (profile?.user_id) {
            artisanUserId = profile.user_id
            resolvedBy = 'D:syndic_artisans_name→profile_email'

            // Lier pour les prochains appels (évite ce fallback à l'avenir)
            await supabaseAdmin
              .from('syndic_artisans')
              .update({ artisan_user_id: profile.user_id, updated_at: new Date().toISOString() })
              .eq('id', match.id || '')
              .eq('cabinet_id', cabinetId)
          } // else: no artisan profile for email
        } // else: no user_id or email available
      } else {
        // Strategy D: no name match found
      }
    }
  }

  // Stratégie E : listUsers paginé (dernier recours)
  if (!artisanUserId && artisan_email) {
    try {
      let page = 1
      const perPage = 100
      let allDone = false
      while (!allDone && page <= 10) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
        const found = users.find((u) => u.email?.toLowerCase() === artisan_email.toLowerCase())
        if (found) {
          artisanUserId = found.id
          resolvedBy = `E:listUsers_page${page}`
          // Strategy E: found in listUsers
          break
        }
        if (users.length < perPage) allDone = true
        page++
      }
      // Strategy E completed
    } catch (e) {
      logger.error('[assign-mission] Strategy E failed:', e)
    }
  }

  // ── 2. Trouver le profil artisan (pour artisan_id dans bookings) ────────
  let artisanProfileId: string | null = null
  if (artisanUserId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', artisanUserId)
      .maybeSingle()
    artisanProfileId = profile?.id || null
  }

  // ── 3. Créer le booking dans la table bookings (apparaît sur l'agenda artisan) ──
  // N'utiliser QUE les colonnes existantes du schéma bookings :
  // id, client_id, artisan_id, service_id, status, booking_date, booking_time,
  // duration_minutes, address, notes, price_ht, price_ttc, commission_rate,
  // payment_status, created_at, confirmed_at
  let bookingId: string | null = null
  if (artisanUserId) {
    // Compiler les détails de la mission dans le champ notes
    const missionNotes = [
      `[Mission Syndic] ${type_travaux || 'Intervention'}`,
      description,
      immeuble ? `Immeuble : ${immeuble}` : '',
      `Priorité : ${priorite}`,
      notes ? `Notes : ${notes}` : '',
      `Assignée par : ${user.user_metadata?.full_name || user.email || 'Syndic'}`,
    ].filter(Boolean).join('\n')

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        artisan_id: artisanProfileId,
        client_id: user.id, // le syndic est le "client" pour cette mission
        booking_date: effectiveDate,
        booking_time: '09:00',
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        address: immeuble || '',
        notes: missionNotes,
        duration_minutes: 60,
        price_ht: 0,
        price_ttc: 0,
        commission_rate: 0,
        payment_status: 'not_required',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!bookingError && booking) {
      bookingId = booking.id
    } else if (bookingError) {
      logger.error('[assign-mission] Booking creation error:', bookingError.message)
    }
  }

  // ── 4. Notification artisan ──────────────────
  if (artisanUserId) {
    const { error: notifErr } = await supabaseAdmin.from('artisan_notifications').insert({
      artisan_id: artisanUserId,
      type: 'new_mission',
      title: `📅 Nouvelle mission — ${type_travaux || 'Intervention'}`,
      body: `${immeuble ? immeuble + ' — ' : ''}${description} — Le ${new Date(effectiveDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      read: false,
      data_json: { booking_id: bookingId, contact_type: 'pro', sender_id: user.id },
      created_at: new Date().toISOString(),
    })
    if (notifErr) logger.error('[ASSIGN] ❌ Notification artisan échouée:', notifErr.message)
  }

  // ── 5. Message dans le canal legacy ──────
  if (artisanUserId) {
    const dateFormatted = new Date(effectiveDate + 'T12:00:00').toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })
    const { error: legacyErr } = await supabaseAdmin.from('syndic_messages').insert({
      cabinet_id: cabinetId,
      artisan_user_id: artisanUserId,
      sender_id: user.id,
      sender_role: 'syndic',
      sender_name: user.user_metadata?.full_name || 'Syndic',
      content: `📅 **Mission assignée** : ${description}${immeuble ? ` — ${immeuble}` : ''}\n🗓️ Date : ${dateFormatted}\n⚡ Priorité : ${priorite}${notes ? `\n📝 Notes : ${notes}` : ''}`,
      message_type: 'text',
      created_at: new Date().toISOString(),
    })
    if (legacyErr) logger.error('[ASSIGN] ❌ Legacy message échoué:', legacyErr.message)
  }

  // ── 6. Créer conversation + ordre de mission dans messagerie v2 ──────
  let convId: string | null = null
  if (artisanUserId) {
    const senderName = user.user_metadata?.full_name || user.email || 'Syndic'

    // Trouver ou créer la conversation artisan ↔ syndic (upsert pour robustesse)
    try {
      // D'abord essayer de trouver une conversation existante
      const { data: existingConv, error: findErr } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('artisan_id', artisanUserId)
        .eq('contact_id', user.id)
        .maybeSingle()

      if (findErr) {
        logger.error('[ASSIGN] ❌ Erreur recherche conversation:', findErr.message)
      }

      if (existingConv) {
        convId = existingConv.id
        console.info(`[ASSIGN] Conversation existante trouvée : ${convId}`)
      } else {
        // INSERT minimal (seulement les colonnes de base pour éviter erreur de schema)
        const { data: newConv, error: createErr } = await supabaseAdmin
          .from('conversations')
          .insert({
            artisan_id: artisanUserId,
            contact_id: user.id,
            contact_type: 'pro',
            contact_name: senderName,
          })
          .select('id')
          .single()

        if (createErr) {
          logger.error('[ASSIGN] ❌ Erreur INSERT conversation:', { message: createErr.message, details: createErr.details, hint: createErr.hint })
          // Race condition possible : re-chercher
          const { data: retryConv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('artisan_id', artisanUserId)
            .eq('contact_id', user.id)
            .maybeSingle()
          convId = retryConv?.id || null
          if (convId) console.info(`[ASSIGN] Conversation retrouvée après retry : ${convId}`)
          else logger.error(`[ASSIGN] ❌ Conversation introuvable même après retry`)
        } else {
          convId = newConv?.id || null
          console.info(`[ASSIGN] Conversation créée : ${convId}`)
        }
      }
    } catch (e) {
      logger.error('[ASSIGN] ❌ Exception conversation v2:', e)
    }

    // Insérer le message ordre de mission
    if (convId) {
      try {
        const { error: msgErr } = await supabaseAdmin.from('conversation_messages').insert({
          conversation_id: convId,
          sender_id: user.id,
          type: 'ordre_mission',
          content: description,
          ordre_mission: {
            titre: type_travaux || 'Intervention',
            adresse: immeuble || '',
            date_souhaitee: effectiveDate,
            description,
            urgence: priorite === 'urgente' ? 'urgente' : priorite === 'haute' ? 'haute' : 'normale',
            statut: 'en_attente',
            mission_id: bookingId,
          },
        })
        if (msgErr) {
          logger.error('[ASSIGN] ❌ Erreur insertion message v2:', { message: msgErr.message, details: msgErr.details, hint: msgErr.hint })
        } else {
          console.info(`[ASSIGN] ✅ Message ordre de mission inséré dans conversation ${convId}`)
          // Mettre à jour last_message_at pour que la conversation remonte dans la liste
          const { error: updErr } = await supabaseAdmin
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', convId)
          if (updErr) logger.warn('[ASSIGN] update last_message_at:', updErr.message)
        }
      } catch (e) {
        logger.error('[ASSIGN] ❌ Exception insertion message v2:', e)
      }
    } else {
      logger.error(`[ASSIGN] ❌ Pas de convId — message v2 NON créé (artisan=${artisanUserId}, contact=${user.id})`)
    }
  }

  console.info(`[ASSIGN] ── Fin : artisan_found=${!!artisanUserId} booking=${bookingId} conv=${convId} resolvedBy=${resolvedBy} ──`)

  return NextResponse.json({
    success: true,
    booking_id: bookingId,
    conversation_id: convId,
    artisan_found: !!artisanUserId,
    resolved_by: resolvedBy,
    message: artisanUserId
      ? `Mission assignée à ${artisan_name || artisan_email} — notification envoyée sur son agenda`
      : `Mission créée — artisan non trouvé (nom: "${artisan_name}", email: "${artisan_email}")`,
  })
}
