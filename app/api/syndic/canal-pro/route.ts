import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { syndicCanalProMessageSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { compterNonLuMemeCompte } from '@/lib/syndic/livraison-mission'
import { coteDuMessage, documentDuMessage, statutOrdre } from '@/lib/syndic/messagerie-pro'

// ── /api/syndic/canal-pro — Canal de communication v54, onglet « Professionnels » ──
// Conversations « pro » (tables conversations / conversation_messages) dont le cabinet est le donneur
// d'ordre (contact_id = cabinet), avec leurs messages : ordres de mission et leur statut, réponses et
// documents du prestataire (devis, rapport, facture). POST : réponse du syndic dans une conversation.
// Accès service role → filtre cabinet explicite sur chaque requête.

const MESSAGES_PAR_CONVERSATION = 80
const ERREUR_INTERNE = 'Une erreur interne est survenue'

interface ConversationLigne {
  id: string
  artisan_id: string
  contact_id: string
  contact_name: string | null
  last_message_at: string | null
  last_message_preview: string | null
  created_at: string | null
}

interface MessageLigne {
  id: string
  conversation_id: string
  sender_id: string | null
  type: string | null
  content: string | null
  metadata: unknown
  ordre_mission: unknown
  created_at: string
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '')

function ordreDuMessage(m: MessageLigne) {
  if (m.type !== 'ordre_mission' || typeof m.ordre_mission !== 'object' || m.ordre_mission === null) return null
  const o = m.ordre_mission as Record<string, unknown>
  return {
    titre: texte(o.titre),
    adresse: texte(o.adresse),
    dateSouhaitee: texte(o.date_souhaitee),
    description: texte(o.description),
    urgence: texte(o.urgence) || 'normale',
    statut: statutOrdre(o),
    heureArrivee: texte(o.arrival_time),
    signalementId: texte(o.signalement_id),
    syndicMissionId: texte(o.syndic_mission_id),
  }
}

function versMessage(m: MessageLigne, artisanId: string) {
  return {
    id: m.id,
    type: m.type || 'text',
    contenu: m.content || '',
    creeLe: m.created_at,
    cote: coteDuMessage(m, artisanId),
    ordreMission: ordreDuMessage(m),
    document: documentDuMessage(m.metadata),
  }
}

// ═══ GET — conversations prestataires du cabinet ═══
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_canal_pro_get_${ip}`, 120, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  try {
    const { data: convData, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('id, artisan_id, contact_id, contact_name, last_message_at, last_message_preview, created_at')
      .eq('contact_id', cabinetId)
      .eq('contact_type', 'pro')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(50)
    if (convErr) {
      logger.error('[canal-pro/GET] conversations', { message: convErr.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const convs = (convData || []) as ConversationLigne[]
    if (convs.length === 0) return noStore({ conversations: [] })

    const convIds = convs.map((c) => c.id)
    const artisanIds = [...new Set(convs.map((c) => c.artisan_id).filter(Boolean))]

    // Noms des prestataires : fiche du cabinet d'abord, raison sociale du compte artisan à défaut.
    const noms = new Map<string, { nom: string; metier: string }>()
    const { data: artData, error: artErr } = await supabaseAdmin
      .from('syndic_artisans')
      .select('artisan_user_id, nom, prenom, nom_famille, metier')
      .eq('cabinet_id', cabinetId)
      .in('artisan_user_id', artisanIds)
    if (artErr) logger.warn('[canal-pro/GET] syndic_artisans', { message: artErr.message })
    for (const a of (artData || []) as Array<{ artisan_user_id: string; nom: string | null; prenom: string | null; nom_famille: string | null; metier: string | null }>) {
      const nom = a.nom?.trim() || [a.prenom, a.nom_famille].filter(Boolean).join(' ').trim()
      if (nom && !noms.has(a.artisan_user_id)) noms.set(a.artisan_user_id, { nom, metier: a.metier || '' })
    }
    const sansNom = artisanIds.filter((id) => !noms.has(id))
    if (sansNom.length > 0) {
      const { data: profils, error: profErr } = await supabaseAdmin.from('profiles_artisan').select('user_id, company_name').in('user_id', sansNom)
      if (profErr) logger.warn('[canal-pro/GET] profiles_artisan', { message: profErr.message })
      for (const p of (profils || []) as Array<{ user_id: string; company_name: string | null }>) {
        if (p.company_name?.trim()) noms.set(p.user_id, { nom: p.company_name.trim(), metier: '' })
      }
    }

    // Messages (les plus récents d'abord, puis remis dans l'ordre chronologique par conversation).
    const { data: msgData, error: msgErr } = await supabaseAdmin
      .from('conversation_messages')
      .select('id, conversation_id, sender_id, type, content, metadata, ordre_mission, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(Math.min(convIds.length * MESSAGES_PAR_CONVERSATION, 2000))
    if (msgErr) {
      logger.error('[canal-pro/GET] messages', { message: msgErr.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const parConversation = new Map<string, MessageLigne[]>()
    for (const m of (msgData || []) as MessageLigne[]) {
      const liste = parConversation.get(m.conversation_id) ?? []
      if (liste.length < MESSAGES_PAR_CONVERSATION) liste.push(m)
      parConversation.set(m.conversation_id, liste)
    }

    const conversations = convs.map((c) => {
      const messages = (parConversation.get(c.id) ?? []).slice().reverse().map((m) => versMessage(m, c.artisan_id))
      const dernierOrdre = [...messages].reverse().find((m) => m.ordreMission)
      const prestataire = noms.get(c.artisan_id) ?? { nom: 'Prestataire', metier: '' }
      return {
        id: c.id,
        artisanUserId: c.artisan_id,
        prestataire,
        derniereActivite: c.last_message_at || c.created_at,
        apercu: c.last_message_preview || '',
        ordre: dernierOrdre?.ordreMission ? { ...dernierOrdre.ordreMission, messageId: dernierOrdre.id } : null,
        messages,
      }
    })
    return noStore({ conversations })
  } catch (e) {
    logger.error('[canal-pro/GET] exception', undefined, e)
    return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
  }
}

// ═══ POST — réponse du syndic au prestataire ═══
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_canal_pro_post_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body: unknown = await request.json().catch(() => null)
  const validation = validateBody(syndicCanalProMessageSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const { conversation_id, content } = validation.data

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  try {
    const { data: conv, error: convErr } = await supabaseAdmin
      .from('conversations')
      .select('id, artisan_id, contact_id, contact_name')
      .eq('id', conversation_id)
      .eq('contact_id', cabinetId)
      .eq('contact_type', 'pro')
      .maybeSingle()
    if (convErr) {
      logger.error('[canal-pro/POST] conversation', { message: convErr.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const conversation = conv as Pick<ConversationLigne, 'id' | 'artisan_id' | 'contact_id' | 'contact_name'> | null
    if (!conversation) return NextResponse.json({ error: 'conversation_introuvable' }, { status: 404 })

    const { data: msg, error: msgErr } = await supabaseAdmin
      .from('conversation_messages')
      .insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        type: 'text',
        content,
        metadata: { cote: 'donneur_ordre' },
      })
      .select('id, conversation_id, sender_id, type, content, metadata, ordre_mission, created_at')
      .single()
    if (msgErr || !msg) {
      logger.error('[canal-pro/POST] insertion message', { message: msgErr?.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }

    // Même compte des deux côtés (démo) : le trigger ne compte pas ce message comme non lu.
    if (conversation.artisan_id === user.id) await compterNonLuMemeCompte(supabaseAdmin, conversation.id)

    // Notification in-app du prestataire (aucun e-mail / SMS).
    const nom = conversation.contact_name || (user.user_metadata?.full_name as string | undefined) || 'votre donneur d’ordre'
    const { error: notifErr } = await supabaseAdmin.from('artisan_notifications').insert({
      artisan_id: conversation.artisan_id,
      type: 'message',
      title: `Nouveau message de ${nom}`,
      body: content.substring(0, 100),
      read: false,
      data_json: { conversation_id: conversation.id, contact_id: cabinetId, contact_type: 'pro', message_type: 'text' },
    })
    if (notifErr) logger.warn('[canal-pro/POST] notification', { message: notifErr.message })

    return NextResponse.json({ message: versMessage(msg as MessageLigne, conversation.artisan_id) })
  } catch (e) {
    logger.error('[canal-pro/POST] exception', undefined, e)
    return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
  }
}

function noStore(body: unknown) {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}
