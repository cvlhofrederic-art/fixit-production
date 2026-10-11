import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

/**
 * Livraison d'une mission à un prestataire déjà identifié par son compte Vitfix (auth user id).
 *
 * Étapes reprises de POST /api/syndic/assign-mission (qui l'utilise aussi) :
 *   1. booking sur l'agenda du prestataire — seulement s'il a une fiche profiles_artisan
 *      (bookings.artisan_id = profiles_artisan.id), sinon étape ignorée ;
 *   2. conversation « pro » prestataire ↔ donneur d'ordre (trouvée ou créée) + message 'ordre_mission'
 *      (metadata.cote = 'donneur_ordre', références signalement / mission syndic) ;
 *   3. notification in-app artisan_notifications 'new_mission' (cloche, avec conversation_id) ;
 *   4. trace dans le canal legacy syndic_messages.
 *
 * Aucune résolution du prestataire ici (ni par nom, ni par e-mail, ni dans d'autres cabinets) :
 * l'appelant fournit artisanUserId, lu dans une ligne syndic_artisans de SON cabinet (ou résolu
 * par sa propre logique historique pour assign-mission). Aucun e-mail ni SMS : lignes en base seulement.
 * Chaque étape est tolérante : un échec est journalisé et la suite continue.
 */

export interface ReferencesMission {
  /** syndic_signalements.id à l'origine de la mission. */
  signalement_id?: string
  /** syndic_missions.id créé pour cette mission. */
  syndic_mission_id?: string
}

export interface LivraisonMission {
  /** Compte Vitfix du prestataire (auth user id). */
  artisanUserId: string
  /** Cabinet du donneur d'ordre (syndic_messages.cabinet_id). */
  cabinetId: string
  /** conversations.contact_id : identifiant du donneur d'ordre. */
  contactId: string
  /** conversations.contact_name à la création de la conversation. */
  contactName: string
  /** Auteur des lignes écrites (sender_id / client_id). */
  senderId: string
  /** Nom affiché de l'auteur (notes du booking, canal legacy). */
  senderName: string
  titre: string
  description: string
  adresse: string
  /** AAAA-MM-JJ */
  dateIntervention: string
  /** Libellé de priorité repris dans les notes. */
  priorite: string
  /** Urgence de l'ordre de mission. */
  urgence: 'urgente' | 'haute' | 'normale'
  notes?: string
  references?: ReferencesMission
}

export interface ResultatLivraison {
  bookingId: string | null
  conversationId: string | null
  messageId: string | null
  /** Ordre de mission inséré dans la conversation. */
  ordreEnvoye: boolean
  /** Notification 'new_mission' insérée. */
  notificationEnvoyee: boolean
}

/** Priorité syndic_missions (CHECK urgente | normale | planifiee) : jamais 'haute' ni 'basse'. */
export function prioriteMissionSyndic(p: string | null | undefined): 'urgente' | 'normale' | 'planifiee' {
  return p === 'urgente' || p === 'planifiee' ? p : 'normale'
}

/** Champs de localisation d'un signalement (colonnes syndic_signalements). */
export interface LocalisationSignalement {
  immeuble_nom: string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
}

/** Localisation lisible : immeuble, puis bâtiment / étage / lot, ou zone des parties communes. */
export function localisationSignalement(s: LocalisationSignalement): string {
  const details = s.est_partie_commune
    ? [s.zone_signalee ? `parties communes : ${s.zone_signalee}` : 'parties communes']
    : [s.batiment ? `bât. ${s.batiment}` : '', s.etage ? `étage ${s.etage}` : '', s.num_lot ? `lot ${s.num_lot}` : '']
  return [s.immeuble_nom || '', ...details].filter(Boolean).join(', ')
}

const dateLongue = (iso: string, options: Intl.DateTimeFormatOptions) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', options)

/** Conversation « pro » existante prestataire ↔ donneur d'ordre (à défaut : toute conversation de la paire). */
async function chercherConversation(sb: SupabaseClient, artisanUserId: string, contactId: string, typePro: boolean): Promise<string | null> {
  let q = sb.from('conversations').select('id').eq('artisan_id', artisanUserId).eq('contact_id', contactId)
  if (typePro) q = q.eq('contact_type', 'pro')
  const { data, error } = await q.order('created_at', { ascending: true }).limit(1)
  if (error) {
    logger.error('[livraison-mission] recherche conversation', { message: error.message })
    return null
  }
  return (data?.[0] as { id?: string } | undefined)?.id ?? null
}

/** Trouve ou crée la conversation « pro » de la paire. */
export async function conversationPro(sb: SupabaseClient, artisanUserId: string, contactId: string, contactName: string): Promise<string | null> {
  const existante = await chercherConversation(sb, artisanUserId, contactId, true)
  if (existante) return existante
  const { data, error } = await sb
    .from('conversations')
    .insert({ artisan_id: artisanUserId, contact_id: contactId, contact_type: 'pro', contact_name: contactName })
    .select('id')
    .single()
  if (!error && data) return (data as { id: string }).id
  logger.error('[livraison-mission] création conversation', { message: error?.message })
  // Course possible ou contrainte d'unicité sur la paire : on reprend la ligne existante.
  return chercherConversation(sb, artisanUserId, contactId, false)
}

/**
 * Le trigger update_conversation_on_message n'incrémente unread_count que si sender_id ≠ artisan_id.
 * Quand le donneur d'ordre et le prestataire sont le même compte (démo), on compte le message nous-mêmes
 * pour que le prestataire le voie comme non lu.
 */
export async function compterNonLuMemeCompte(sb: SupabaseClient, conversationId: string): Promise<void> {
  const { data, error } = await sb.from('conversations').select('unread_count').eq('id', conversationId).maybeSingle()
  if (error) {
    logger.warn('[livraison-mission] lecture unread_count', { message: error.message })
    return
  }
  const actuel = typeof (data as { unread_count?: unknown } | null)?.unread_count === 'number' ? (data as { unread_count: number }).unread_count : 0
  const { error: updErr } = await sb.from('conversations').update({ unread_count: actuel + 1 }).eq('id', conversationId)
  if (updErr) logger.warn('[livraison-mission] mise à jour unread_count', { message: updErr.message })
}

export async function livrerMission(sb: SupabaseClient, m: LivraisonMission): Promise<ResultatLivraison> {
  const refs = m.references ?? {}
  const now = () => new Date().toISOString()
  const res: ResultatLivraison = { bookingId: null, conversationId: null, messageId: null, ordreEnvoye: false, notificationEnvoyee: false }

  // ── 1. Booking sur l'agenda (seulement avec une fiche profiles_artisan) ──
  try {
    const { data: profile, error: profErr } = await sb.from('profiles_artisan').select('id').eq('user_id', m.artisanUserId).maybeSingle()
    if (profErr) logger.warn('[livraison-mission] lecture profiles_artisan', { message: profErr.message })
    const profileId = (profile as { id?: string } | null)?.id ?? null
    if (profileId) {
      const missionNotes = [
        `[Mission Syndic] ${m.titre}`,
        m.description,
        m.adresse ? `Immeuble : ${m.adresse}` : '',
        `Priorité : ${m.priorite}`,
        m.notes ? `Notes : ${m.notes}` : '',
        `Assignée par : ${m.senderName}`,
      ].filter(Boolean).join('\n')
      const { data: booking, error: bookingError } = await sb
        .from('bookings')
        .insert({
          artisan_id: profileId,
          client_id: m.senderId, // le donneur d'ordre est le « client » de cette mission
          booking_date: m.dateIntervention,
          booking_time: '09:00',
          status: 'confirmed',
          confirmed_at: now(),
          address: m.adresse,
          notes: missionNotes,
          duration_minutes: 60,
          price_ht: 0,
          price_ttc: 0,
          commission_rate: 0,
          payment_status: 'not_required',
          created_at: now(),
        })
        .select('id')
        .single()
      if (bookingError) logger.error('[livraison-mission] création booking', { message: bookingError.message })
      else res.bookingId = (booking as { id: string } | null)?.id ?? null
    }
  } catch (e) {
    logger.error('[livraison-mission] exception booking', undefined, e)
  }

  // ── 2. Conversation + ordre de mission ──
  try {
    res.conversationId = await conversationPro(sb, m.artisanUserId, m.contactId, m.contactName)
    if (res.conversationId) {
      const { data: msg, error: msgErr } = await sb
        .from('conversation_messages')
        .insert({
          conversation_id: res.conversationId,
          sender_id: m.senderId,
          type: 'ordre_mission',
          content: m.description,
          metadata: { cote: 'donneur_ordre', ...refs },
          ordre_mission: {
            titre: m.titre,
            adresse: m.adresse,
            date_souhaitee: m.dateIntervention,
            description: m.description,
            urgence: m.urgence,
            statut: 'en_attente',
            mission_id: res.bookingId,
            ...(m.notes ? { notes: m.notes } : {}),
            ...refs,
          },
        })
        .select('id')
        .single()
      if (msgErr) {
        logger.error('[livraison-mission] insertion ordre de mission', { message: msgErr.message })
      } else {
        res.messageId = (msg as { id: string } | null)?.id ?? null
        res.ordreEnvoye = true
        const { error: updErr } = await sb.from('conversations').update({ last_message_at: now() }).eq('id', res.conversationId)
        if (updErr) logger.warn('[livraison-mission] last_message_at', { message: updErr.message })
        if (m.senderId === m.artisanUserId) await compterNonLuMemeCompte(sb, res.conversationId)
      }
    }
  } catch (e) {
    logger.error('[livraison-mission] exception conversation', undefined, e)
  }

  // ── 3. Notification in-app du prestataire ──
  try {
    const corps = `${m.adresse ? m.adresse + ' — ' : ''}${m.description}`.slice(0, 300)
    const { error: notifErr } = await sb.from('artisan_notifications').insert({
      artisan_id: m.artisanUserId,
      type: 'new_mission',
      title: `📅 Nouvelle mission — ${m.titre}`,
      body: `${corps} — Le ${dateLongue(m.dateIntervention, { day: 'numeric', month: 'long', year: 'numeric' })}`,
      read: false,
      data_json: {
        booking_id: res.bookingId,
        conversation_id: res.conversationId,
        message_id: res.messageId,
        contact_id: m.contactId,
        contact_type: 'pro',
        message_type: 'ordre_mission',
        sender_id: m.senderId,
        ...refs,
      },
      created_at: now(),
    })
    if (notifErr) logger.error('[livraison-mission] notification artisan', { message: notifErr.message })
    else res.notificationEnvoyee = true
  } catch (e) {
    logger.error('[livraison-mission] exception notification', undefined, e)
  }

  // ── 4. Canal legacy ──
  try {
    const dateFormatee = dateLongue(m.dateIntervention, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const { error: legacyErr } = await sb.from('syndic_messages').insert({
      cabinet_id: m.cabinetId,
      artisan_user_id: m.artisanUserId,
      sender_id: m.senderId,
      sender_role: 'syndic',
      sender_name: m.senderName,
      content: `📅 **Mission assignée** : ${m.description}${m.adresse ? ` — ${m.adresse}` : ''}\n🗓️ Date : ${dateFormatee}\n⚡ Priorité : ${m.priorite}${m.notes ? `\n📝 Notes : ${m.notes}` : ''}`,
      message_type: 'text',
      created_at: now(),
    })
    if (legacyErr) logger.error('[livraison-mission] canal legacy', { message: legacyErr.message })
  } catch (e) {
    logger.error('[livraison-mission] exception canal legacy', undefined, e)
  }

  return res
}
