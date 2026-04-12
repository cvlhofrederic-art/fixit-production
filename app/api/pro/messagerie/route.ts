import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { proMessagerieSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const PRO_ROLES = ['artisan', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

// ═══ GET — Liste des conversations ou messages d'une conversation ═══
export async function GET(req: NextRequest) {
  try {
    // ── Auth obligatoire ──
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    if (!(await checkRateLimit(`pro_msg_${user.id}`, 60, 60_000))) return rateLimitResponse()

    const role = user.user_metadata?.role || ''
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const url = new URL(req.url)
    const artisanUserId = url.searchParams.get('artisan_user_id')
    const conversationId = url.searchParams.get('conversation_id')
    const contactType = url.searchParams.get('contact_type') // 'particulier' | 'pro'

    if (!artisanUserId) {
      return NextResponse.json({ error: 'artisan_user_id requis' }, { status: 400 })
    }

    // ── IDOR check : l'utilisateur ne peut accéder qu'à ses propres conversations ──
    if (artisanUserId !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const msgType = url.searchParams.get('type')

    // Mode 0 : Tous les ordres de mission de l'artisan (2 requêtes séquentielles, plus fiable que jointure)
    if (msgType === 'ordre_mission') {
      // 1. Récupérer toutes les conversations pro de cet artisan
      const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, artisan_id, contact_id, contact_type, contact_name')
        .eq('artisan_id', artisanUserId)
        .eq('contact_type', 'pro')

      if (convErr) {
        logger.error('[messagerie] GET ordres_mission convs error:', convErr)
        return NextResponse.json({ ordres: [] })
      }

      if (!convs || convs.length === 0) {
        return NextResponse.json({ ordres: [] })
      }

      const convIds = convs.map((c: { id: string }) => c.id)
      const convMap: Record<string, Record<string, unknown>> = {}
      convs.forEach((c: { id: string; [key: string]: unknown }) => { convMap[c.id] = c })

      // 2. Récupérer tous les messages ordre_mission de ces conversations
      const { data: msgs, error: msgsErr } = await supabaseAdmin
        .from('conversation_messages')
        .select('id, conversation_id, sender_id, type, content, ordre_mission, read, created_at')
        .in('conversation_id', convIds)
        .eq('type', 'ordre_mission')
        .order('created_at', { ascending: false })
        .limit(100)

      if (msgsErr) {
        logger.error('[messagerie] GET ordres_mission msgs error:', msgsErr)
        return NextResponse.json({ ordres: [] })
      }

      // Enrichir chaque message avec les infos de sa conversation
      const ordres = (msgs || []).map((m: { conversation_id: string; [key: string]: unknown }) => ({
        ...m,
        conversations: convMap[m.conversation_id] || { contact_name: 'Syndic', contact_type: 'pro' },
      }))

      return NextResponse.json({ ordres })
    }

    // Mode 1 : Liste des conversations (pour l'onglet)
    if (!conversationId) {
      let query = supabaseAdmin
        .from('conversations')
        .select('id, artisan_id, contact_id, contact_type, contact_name, contact_avatar, last_message_at, last_message_preview, unread_count, created_at')
        .eq('artisan_id', artisanUserId)
        .order('last_message_at', { ascending: false })
        .limit(50)

      if (contactType) {
        query = query.eq('contact_type', contactType)
      }

      const { data, error } = await query

      if (error) {
        logger.error('[messagerie] GET conversations error:', error)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }

      return NextResponse.json({ conversations: data || [] })
    }

    // Mode 2 : Messages d'une conversation + mark as read
    const { data: messages, error } = await supabaseAdmin
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, type, content, metadata, ordre_mission, read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) {
      logger.error('[messagerie] GET messages error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // Marquer les messages non lus comme lus (ceux envoyés par l'autre)
    await supabaseAdmin
      .from('conversation_messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', artisanUserId)
      .eq('read', false)

    // Remettre le compteur unread à 0
    await supabaseAdmin
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', conversationId)
      .eq('artisan_id', artisanUserId)

    return NextResponse.json({ messages: messages || [] })
  } catch (err) {
    logger.error('[pro/messagerie/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ═══ POST — Envoyer un message ou créer une conversation ═══
export async function POST(req: NextRequest) {
  try {
    // ── Auth obligatoire ──
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const role = user.user_metadata?.role || ''
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(proMessagerieSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
    }
    const { artisan_user_id, contact_id, contact_type, contact_name, content, type, ordre_mission, metadata } = body

    // ── IDOR check : l'utilisateur ne peut envoyer que depuis son propre compte ──
    if (artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // 1. Trouver ou créer la conversation
    let { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('artisan_id', artisan_user_id)
      .eq('contact_id', contact_id)
      .single()

    if (!conv) {
      const { data: newConv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .insert({
          artisan_id: artisan_user_id,
          contact_id,
          contact_type: contact_type || 'particulier',
          contact_name: contact_name || 'Contact',
        })
        .select('id')
        .single()

      if (convErr) {
        logger.error('[messagerie] create conversation error:', convErr)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }
      conv = newConv
    }

    // 2. Insérer le message
    const msgPayload: Record<string, unknown> = {
      conversation_id: conv.id,
      sender_id: body.sender_id || contact_id,
      type: type || 'text',
      content: content || '',
      metadata: metadata || {},
    }

    if (type === 'ordre_mission' && ordre_mission) {
      msgPayload.ordre_mission = {
        ...ordre_mission,
        statut: ordre_mission.statut || 'en_attente',
      }
    }

    const { data: msg, error: msgErr } = await supabaseAdmin
      .from('conversation_messages')
      .insert(msgPayload)
      .select('*')
      .single()

    if (msgErr) {
      logger.error('[messagerie] insert message error:', msgErr)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // 3. Créer une notification artisan si c'est un message entrant
    if ((body.sender_id || contact_id) !== artisan_user_id) {
      const notifTitle = type === 'ordre_mission'
        ? `Nouvel ordre de mission`
        : `Nouveau message de ${contact_name || 'un contact'}`
      const notifBody = type === 'ordre_mission'
        ? ordre_mission?.titre || 'Un donneur d\'ordres vous a assigné une mission'
        : (content || '').substring(0, 100)

      await supabaseAdmin
        .from('artisan_notifications')
        .insert({
          artisan_id: artisan_user_id,
          type: type === 'ordre_mission' ? 'new_mission' : 'message',
          title: notifTitle,
          body: notifBody,
          data_json: {
            conversation_id: conv.id,
            contact_id,
            contact_type: contact_type || 'particulier',
            message_type: type,
          },
        })
    }

    return NextResponse.json({ message: msg, conversation_id: conv.id })
  } catch (err) {
    logger.error('[pro/messagerie/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ═══ PATCH — Mettre à jour un ordre de mission (accepter/refuser) ═══
export async function PATCH(req: NextRequest) {
  try {
    // ── Auth obligatoire ──
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const role = user.user_metadata?.role || ''
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await req.json()
    const { message_id, action, artisan_user_id, artisan_name: rawArtisanName, arrival_time: rawArrivalTime, duration_hours } = body

    // Sanitise user-controlled strings to prevent log injection
    const artisan_name = typeof rawArtisanName === 'string'
      ? rawArtisanName.replace(/[\n\r\t]/g, '').slice(0, 100)
      : undefined
    const arrival_time = typeof rawArrivalTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawArrivalTime)
      ? rawArrivalTime
      : undefined

    if (!message_id || !action) {
      return NextResponse.json({ error: 'message_id et action requis' }, { status: 400 })
    }

    // ── IDOR check : l'utilisateur ne peut modifier que ses propres ordres ──
    if (artisan_user_id && artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const validActions = ['accepte', 'refuse', 'en_cours', 'termine']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Action invalide. Valides: ${validActions.join(', ')}` }, { status: 400 })
    }

    // Récupérer le message
    const { data: msg, error: fetchErr } = await supabaseAdmin
      .from('conversation_messages')
      .select('*, conversations!inner(artisan_id, contact_id, contact_name)')
      .eq('id', message_id)
      .eq('type', 'ordre_mission')
      .single()

    if (fetchErr || !msg) {
      return NextResponse.json({ error: 'Message ordre de mission introuvable' }, { status: 404 })
    }

    // Mettre à jour le statut (+ heure d'arrivée + durée si accepte)
    const durationMin = duration_hours ? Math.round(parseFloat(duration_hours) * 60) : null
    const updatedOrdre = {
      ...msg.ordre_mission,
      statut: action,
      ...(action === 'accepte' && arrival_time ? { arrival_time } : {}),
      ...(action === 'accepte' && durationMin ? { duration_minutes: durationMin } : {}),
    }

    const { error: updateErr } = await supabaseAdmin
      .from('conversation_messages')
      .update({ ordre_mission: updatedOrdre })
      .eq('id', message_id)

    if (updateErr) {
      logger.error('[messagerie] update ordre error:', updateErr)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // Insérer un message système pour informer
    const actionLabels: Record<string, string> = {
      accepte: 'a accepté',
      refuse: 'a refusé',
      en_cours: 'a démarré',
      termine: 'a terminé',
    }

    const displayName = artisan_name || 'L\'artisan'
    let systemContent = `${displayName} ${actionLabels[action]} l'ordre de mission "${updatedOrdre.titre || ''}"`

    // Si accepté avec heure d'arrivée → message enrichi
    if (action === 'accepte' && arrival_time) {
      const dateStr = updatedOrdre.date_souhaitee
        ? new Date(updatedOrdre.date_souhaitee + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
        : ''
      const durationLabel = durationMin
        ? ` (durée estimée : ${durationMin >= 60 ? `${Math.floor(durationMin / 60)}h${durationMin % 60 > 0 ? String(durationMin % 60).padStart(2, '0') : ''}` : `${durationMin} min`})`
        : ''
      systemContent = `✅ Mission acceptée — ${displayName} sera sur place ${dateStr ? `le ${dateStr} ` : ''}à ${arrival_time}${durationLabel}`
    }

    await supabaseAdmin
      .from('conversation_messages')
      .insert({
        conversation_id: msg.conversation_id,
        sender_id: artisan_user_id,
        type: 'system',
        content: systemContent,
      })

    // ── Si accepté : bloquer la date sur l'agenda de l'artisan (mettre à jour le booking existant) ──
    if (action === 'accepte' && updatedOrdre.mission_id) {
      const bookingUpdate: Record<string, string | number> = {
        status: 'confirmed',
        statut: 'confirme',
      }
      if (arrival_time) {
        bookingUpdate.booking_time = arrival_time
        bookingUpdate.intervention_time = arrival_time
      }
      if (durationMin) {
        bookingUpdate.duration_minutes = durationMin
      }
      const { error: bookingErr } = await supabaseAdmin
        .from('bookings')
        .update(bookingUpdate)
        .eq('id', updatedOrdre.mission_id)

      if (bookingErr) {
        logger.error('[messagerie] update booking time error:', bookingErr)
      } else {
        console.info(`[messagerie] ✅ Booking ${updatedOrdre.mission_id} mis à jour : time=${arrival_time}, duration=${durationMin}min`)
      }
    }

    // ── Si refusé : annuler le booking ──
    if (action === 'refuse' && updatedOrdre.mission_id) {
      await supabaseAdmin
        .from('bookings')
        .update({ status: 'cancelled', statut: 'annule' })
        .eq('id', updatedOrdre.mission_id)
    }

    return NextResponse.json({ success: true, ordre_mission: updatedOrdre })
  } catch (err) {
    logger.error('[pro/messagerie/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
