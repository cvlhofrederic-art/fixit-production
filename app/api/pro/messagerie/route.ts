import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole } from '@/lib/auth-helpers'
import { proMessagerieActionSchema, proMessagerieSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { resumeDocumentPro } from '@/lib/messagerie-pro'
import { round2 } from '@/lib/money'

const PRO_ROLES = ['artisan', 'pro_societe', 'pro_conciergerie', 'pro_gestionnaire']

// Actions possibles selon le statut courant d'un ordre de mission
const TRANSITIONS_ORDRE: Record<string, string[]> = {
  en_attente: ['accepte', 'refuse'],
  accepte: ['en_cours'],
  en_cours: ['termine'],
}

// Statut de la mission syndic (syndic_missions, CHECK en_attente | acceptee | en_cours |
// terminee | annulee) suivi par l'ordre de mission du prestataire. Un refus annule la
// mission : le syndic en confie une nouvelle à un autre prestataire.
const STATUT_MISSION_SYNDIC: Record<string, string> = {
  accepte: 'acceptee',
  en_cours: 'en_cours',
  termine: 'terminee',
  refuse: 'annulee',
}

// Statut du signalement copropriétaire (syndic_signalements, même CHECK) — lu par l'onglet
// Demandes du Canal v54 et par « Mes signalements » côté copropriétaire. Un refus remet la
// demande « en attente » (sans prestataire) pour que le syndic puisse la confier à nouveau.
const STATUT_SIGNALEMENT: Record<string, string> = {
  accepte: 'acceptee',
  en_cours: 'en_cours',
  termine: 'terminee',
  refuse: 'en_attente',
}

// Ligne ajoutée au fil de la demande (syndic_signalement_messages, role 'system') ; pour
// une acceptation, le texte du message système de la conversation est repris.
const SUIVI_SIGNALEMENT: Record<string, (nom: string) => string> = {
  en_cours: nom => `${nom} a démarré l'intervention.`,
  termine: nom => `${nom} a terminé l'intervention.`,
  refuse: nom => `${nom} a décliné la mission — demande à confier à un autre prestataire.`,
}

// ═══ GET — Liste des conversations ou messages d'une conversation ═══
export async function GET(req: NextRequest) {
  try {
    // ── Auth obligatoire ──
    const user = await getAuthUser(req)
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // 240/min : la Messagerie (liste 8 s + fil 5 s) et la cloche du tableau de bord interrogent cette route ensemble.
    if (!(await checkRateLimit(`pro_msg_${user.id}`, 240, 60_000))) return rateLimitResponse()

    const role = getUserRole(user)
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
    // ── IDOR check : la conversation doit appartenir au prestataire connecté ──
    const { data: convProprietaire, error: convOwnErr } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('artisan_id', artisanUserId)
      .maybeSingle()

    if (convOwnErr) {
      logger.error('[messagerie] GET conversation ownership error:', convOwnErr)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    if (!convProprietaire) {
      return NextResponse.json({ error: 'Conversation introuvable' }, { status: 404 })
    }

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

    const role = getUserRole(user)
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(proMessagerieSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
    }
    const { artisan_user_id, contact_id, contact_type, contact_name, content, type, metadata } = validation.data

    // ── IDOR check : l'utilisateur ne peut envoyer que depuis son propre compte ──
    if (artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Document (devis / rapport / facture) : uniquement dans une conversation Pro existante
    const document = metadata?.document
      ? {
          ...metadata.document,
          ...(metadata.document.montant_ttc !== undefined
            ? { montant_ttc: round2(metadata.document.montant_ttc) }
            : {}),
        }
      : undefined

    // 1. Trouver ou créer la conversation — du type demandé (la paire prestataire / contact
    //    peut avoir une conversation « particulier » ET une « pro », notamment quand le syndic
    //    et le prestataire sont le même compte) ; la plus ancienne, comme la livraison des
    //    ordres de mission (lib/syndic/livraison-mission.ts).
    const { data: convTrouvee, error: convFindErr } = await supabaseAdmin
      .from('conversations')
      .select('id, contact_type')
      .eq('artisan_id', artisan_user_id)
      .eq('contact_id', contact_id)
      .eq('contact_type', contact_type || 'particulier')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (convFindErr) {
      logger.error('[messagerie] find conversation error:', convFindErr)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    let conv = convTrouvee

    if (document && conv?.contact_type !== 'pro') {
      return NextResponse.json({ error: 'Conversation Pro introuvable' }, { status: 404 })
    }

    if (!conv) {
      const { data: newConv, error: convErr } = await supabaseAdmin
        .from('conversations')
        .insert({
          artisan_id: artisan_user_id,
          contact_id,
          contact_type: contact_type || 'particulier',
          contact_name: contact_name || 'Contact',
        })
        .select('id, contact_type')
        .single()

      if (convErr) {
        logger.error('[messagerie] create conversation error:', convErr)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }
      conv = newConv
    }

    // 2. Insérer le message — toujours au nom du prestataire connecté (sender_id du corps
    //    ignoré : il permettait d'écrire au nom du contact). metadata.cote = 'artisan' :
    //    le syndic et le prestataire peuvent partager le même compte (cf. lib/messagerie-pro.ts).
    const msgPayload: Record<string, unknown> = {
      conversation_id: conv.id,
      sender_id: user.id,
      type: type || 'text',
      content: content?.trim() || (document ? resumeDocumentPro(document) : ''),
      metadata: {
        ...(metadata || {}),
        ...(document ? { document } : {}),
        cote: 'artisan',
      },
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

    const role = getUserRole(user)
    if (!PRO_ROLES.includes(role)) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const body = await req.json()
    const validation = validateBody(proMessagerieActionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const { message_id, action, artisan_user_id, artisan_name: rawArtisanName, arrival_time: rawArrivalTime, duration_hours } = validation.data

    // Sanitise user-controlled strings to prevent log injection
    const artisan_name = typeof rawArtisanName === 'string'
      ? rawArtisanName.replace(/[\n\r\t]/g, '').slice(0, 100)
      : undefined
    const arrival_time = typeof rawArrivalTime === 'string' && /^\d{1,2}:\d{2}$/.test(rawArrivalTime)
      ? rawArrivalTime
      : undefined

    // ── IDOR check : l'utilisateur ne peut modifier que ses propres ordres ──
    if (artisan_user_id && artisan_user_id !== user.id) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
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

    // ── IDOR check : l'ordre doit appartenir à une conversation DU prestataire connecté ──
    // (sans ce contrôle, n'importe quel compte pro pouvait accepter / refuser l'ordre d'un
    // autre artisan en connaissant l'id du message). Même réponse que « introuvable ».
    const convRel = msg.conversations as { artisan_id?: string; contact_id?: string } | Array<{ artisan_id?: string; contact_id?: string }> | null
    const conversation = Array.isArray(convRel) ? convRel[0] : convRel
    if (!conversation || conversation.artisan_id !== user.id) {
      return NextResponse.json({ error: 'Message ordre de mission introuvable' }, { status: 404 })
    }

    // ── Enchaînement des statuts : en_attente → accepte | refuse ; accepte → en_cours ; en_cours → termine ──
    // (un double clic ne crée plus deux messages « a accepté »)
    const statutActuel: string = msg.ordre_mission?.statut || 'en_attente'
    if (!(TRANSITIONS_ORDRE[statutActuel] || []).includes(action)) {
      return NextResponse.json({ error: "Action impossible dans l'état actuel de l'ordre de mission" }, { status: 409 })
    }

    // Mettre à jour le statut (+ heure d'arrivée + durée si accepte)
    const durationMin = duration_hours ? Math.round(parseFloat(String(duration_hours)) * 60) : null
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

    // Écrit côté prestataire : cote 'artisan' (le donneur d'ordre peut être le même compte)
    const { error: systemErr } = await supabaseAdmin
      .from('conversation_messages')
      .insert({
        conversation_id: msg.conversation_id,
        sender_id: user.id,
        type: 'system',
        content: systemContent,
        metadata: { cote: 'artisan', ordre_message_id: message_id, statut: action },
      })
    if (systemErr) logger.error('[messagerie] insert system message error:', systemErr)

    // ── Mission syndic et demande du copropriétaire liées (ordre validé depuis le Syndic v54) ──
    // Mises à jour bornées au cabinet du donneur d'ordre de CETTE conversation (contact_id).
    const statutMissionSyndic = STATUT_MISSION_SYNDIC[action]
    const syndicMissionId = typeof updatedOrdre.syndic_mission_id === 'string' ? updatedOrdre.syndic_mission_id : null
    if (statutMissionSyndic && syndicMissionId && conversation.contact_id) {
      const { error: missionErr } = await supabaseAdmin
        .from('syndic_missions')
        .update({ statut: statutMissionSyndic, updated_at: new Date().toISOString() })
        .eq('id', syndicMissionId)
        .eq('cabinet_id', conversation.contact_id)
      if (missionErr) logger.error('[messagerie] update syndic_missions statut error:', missionErr)
    }

    const statutSignalement = STATUT_SIGNALEMENT[action]
    const signalementId = typeof updatedOrdre.signalement_id === 'string' ? updatedOrdre.signalement_id : null
    if (statutSignalement && signalementId && conversation.contact_id) {
      const { data: sigMaj, error: sigErr } = await supabaseAdmin
        .from('syndic_signalements')
        .update({
          statut: statutSignalement,
          ...(action === 'refuse' ? { artisan_assigne: null } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('id', signalementId)
        .eq('cabinet_id', conversation.contact_id)
        .select('id')
        .maybeSingle()
      if (sigErr) {
        logger.error('[messagerie] update syndic_signalements statut error:', sigErr)
      } else if (sigMaj) {
        const { error: suiviErr } = await supabaseAdmin
          .from('syndic_signalement_messages')
          .insert({
            signalement_id: signalementId,
            auteur: displayName,
            role: 'system',
            // Acceptation : même texte que dans la conversation (heure d'arrivée, durée)
            texte: action === 'accepte' ? systemContent : SUIVI_SIGNALEMENT[action](displayName),
          })
        if (suiviErr) logger.error('[messagerie] insert syndic_signalement_messages error:', suiviErr)
      }
    }

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
