// app/api/administrateur-judiciaire/ordres-prestataire/route.ts
//
// Boucle prestataire de l'Administrateur judiciaire, sur le même circuit que la validation de mission du
// Syndic v54 (POST /api/syndic/demandes/valider) :
//   GET              : prestataires du cabinet (fiches syndic_artisans, avec ou sans compte Vitfix) et ordres de
//                      service envoyés depuis l'Administrateur judiciaire, avec statut, fil et documents ;
//   POST envoyer     : mission syndic_missions du cabinet (demandeur_role 'administrateur_judiciaire', sans
//                      signalement) livrée au compte Vitfix du prestataire (lib/syndic/livraison-mission.ts :
//                      notification, ordre de mission dans Messagerie > Pro) ; ordre non livré → mission retirée,
//                      500 'livraison_impossible' ;
//   POST repondre    : réponse de l'Administrateur judiciaire dans la conversation de l'ordre.
// Le prestataire répond, accepte, démarre, termine et envoie ses documents par /api/pro/messagerie, qui suit la
// mission sans signalement. Authentification par cookie comme les autres routes de la succursale (rôle syndic ou
// super admin) ; accès service role → filtre cabinet explicite sur chaque requête. Le prestataire vient d'une fiche
// syndic_artisans DU cabinet et de son artisan_user_id uniquement. Aucun e-mail ni SMS.
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server-component'
import { supabaseAdmin } from '@/lib/supabase-server'
import { isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { ajOrdrePrestataireSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { compterNonLuMemeCompte, livrerMission, retirerMissionNonLivree } from '@/lib/syndic/livraison-mission'
import { coteDuMessage, documentDuMessage, statutOrdre } from '@/lib/syndic/messagerie-pro'
import {
  ORIGINE_ADMINISTRATEUR_JUDICIAIRE,
  correspondanceUrgence,
  filOrdre,
  libelleUrgenceOrdre,
  statutDepuisMission,
  type DemandeEnvoiOrdre,
  type MessageOrdrePrestataire,
  type OrdrePrestataire,
  type PrestataireVitfix,
  type UrgenceOrdreMission,
} from '@/lib/administrateur-judiciaire/ordres-prestataire'

/** Ordres de service renvoyés (les plus récents). */
const ORDRES_MAX = 50
/** Messages lus dans les conversations des ordres (les plus récents depuis le plus ancien ordre listé). */
const MESSAGES_MAX = 2000
/** Ordres de mission parcourus pour retrouver celui d'une mission (réponse). */
const ORDRES_RECHERCHE_MAX = 500

const CONTEXTE = 'aj/ordres-prestataire'

interface FicheLigne {
  id: string
  artisan_user_id: string | null
  nom: string | null
  prenom: string | null
  nom_famille: string | null
  metier: string | null
}

interface MissionLigne {
  id: string
  immeuble: string | null
  artisan: string | null
  type: string | null
  description: string | null
  statut: string | null
  date_intervention: string | null
  zone_signalee: string | null
  created_at: string | null
}

interface ConversationLigne {
  id: string
  artisan_id: string
  contact_name?: string | null
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

const COLONNES_MESSAGE = 'id, conversation_id, sender_id, type, content, metadata, ordre_mission, created_at'

const objet = (v: unknown): Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
const texte = (v: unknown): string => (typeof v === 'string' ? v : '')

const nomFiche = (f: Pick<FicheLigne, 'nom' | 'prenom' | 'nom_famille'>): string =>
  f.nom?.trim() || [f.prenom, f.nom_famille].filter(Boolean).join(' ').trim()

const erreurInterne = () => NextResponse.json({ error: 'erreur_interne' }, { status: 500 })

function noStore(body: unknown) {
  const res = NextResponse.json(body)
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

/** Compte connecté par cookie, s'il a un rôle syndic (ou super admin). */
async function utilisateurAutorise(): Promise<User | null> {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user && isSyndicRole(user) ? user : null
}

function versMessage(m: MessageLigne, artisanId: string): MessageOrdrePrestataire {
  return {
    id: m.id,
    type: m.type || 'text',
    contenu: m.content || '',
    creeLe: m.created_at,
    cote: coteDuMessage(m, artisanId),
    document: documentDuMessage(m.metadata),
  }
}

const URGENCES: readonly UrgenceOrdreMission[] = ['urgente', 'haute', 'normale']
const urgenceOrdre = (v: unknown): UrgenceOrdreMission =>
  URGENCES.includes(v as UrgenceOrdreMission) ? (v as UrgenceOrdreMission) : 'normale'

// ═══ GET — prestataires du cabinet et ordres de service envoyés ═══
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`aj-ordres-prestataire-get:${ip}`, 120, 60_000))) return rateLimitResponse()

  const user = await utilisateurAutorise()
  if (!user) return NextResponse.json({ error: 'non_autorise' }, { status: 401 })
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'non_autorise' }, { status: 403 })

  try {
    const { data: fichesData, error: fichesErr } = await supabaseAdmin
      .from('syndic_artisans')
      .select('id, artisan_user_id, nom, prenom, nom_famille, metier')
      .eq('cabinet_id', cabinetId)
    if (fichesErr) {
      logger.error(`[${CONTEXTE}/GET] syndic_artisans`, { message: fichesErr.message })
      return erreurInterne()
    }
    const fiches = (fichesData || []) as FicheLigne[]
    const prestataires: PrestataireVitfix[] = fiches
      .map((f) => ({ id: f.id, nom: nomFiche(f) || 'Prestataire', metier: f.metier || '', compte: !!f.artisan_user_id }))
      .sort((a, b) => Number(b.compte) - Number(a.compte) || a.nom.localeCompare(b.nom, 'fr'))
    const metierParCompte = new Map<string, string>()
    for (const f of fiches) if (f.artisan_user_id && !metierParCompte.has(f.artisan_user_id)) metierParCompte.set(f.artisan_user_id, f.metier || '')

    const { data: missionsData, error: missionsErr } = await supabaseAdmin
      .from('syndic_missions')
      .select('id, immeuble, artisan, type, description, statut, date_intervention, zone_signalee, created_at')
      .eq('cabinet_id', cabinetId)
      .eq('demandeur_role', ORIGINE_ADMINISTRATEUR_JUDICIAIRE)
      .order('created_at', { ascending: false })
      .limit(ORDRES_MAX)
    if (missionsErr) {
      logger.error(`[${CONTEXTE}/GET] syndic_missions`, { message: missionsErr.message })
      return erreurInterne()
    }
    const missions = (missionsData || []) as MissionLigne[]
    if (missions.length === 0) return noStore({ prestataires, ordres: [] })

    // Conversations « pro » du cabinet avec SES prestataires (même périmètre que le Canal v54), puis leurs
    // messages depuis la plus ancienne mission listée, remis dans l'ordre chronologique.
    const comptes = [...metierParCompte.keys()]
    const artisanParConversation = new Map<string, string>()
    const messagesParConversation = new Map<string, MessageLigne[]>()
    if (comptes.length > 0) {
      const { data: convData, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, artisan_id')
        .eq('contact_id', cabinetId)
        .eq('contact_type', 'pro')
        .in('artisan_id', comptes)
      if (convErr) {
        logger.error(`[${CONTEXTE}/GET] conversations`, { message: convErr.message })
        return erreurInterne()
      }
      for (const c of (convData || []) as ConversationLigne[]) artisanParConversation.set(c.id, c.artisan_id)

      if (artisanParConversation.size > 0) {
        // Dates ISO : ordre des caractères, identique au tri par défaut (comparateur explicite, SonarCloud S2871).
        const datesCreation = missions.map((m) => m.created_at).filter((d): d is string => !!d).sort((a, b) => { if (a === b) return 0; return a < b ? -1 : 1 })
        let requete = supabaseAdmin.from('conversation_messages').select(COLONNES_MESSAGE).in('conversation_id', [...artisanParConversation.keys()])
        if (datesCreation[0]) requete = requete.gte('created_at', datesCreation[0])
        const { data: msgData, error: msgErr } = await requete.order('created_at', { ascending: false }).limit(MESSAGES_MAX)
        if (msgErr) {
          logger.error(`[${CONTEXTE}/GET] messages`, { message: msgErr.message })
          return erreurInterne()
        }
        for (const m of ((msgData || []) as MessageLigne[]).slice().reverse()) {
          const liste = messagesParConversation.get(m.conversation_id) ?? []
          liste.push(m)
          messagesParConversation.set(m.conversation_id, liste)
        }
      }
    }

    const ordresMission: MessageLigne[] = [...messagesParConversation.values()].flat().filter((m) => m.type === 'ordre_mission')
    const ordres: OrdrePrestataire[] = missions.map((mission) => {
      const ordreMsg = ordresMission.find((m) => objet(m.ordre_mission).syndic_mission_id === mission.id) ?? null
      const o = objet(ordreMsg?.ordre_mission)
      const meta = objet(ordreMsg?.metadata)
      const artisanId = ordreMsg ? artisanParConversation.get(ordreMsg.conversation_id) ?? '' : ''
      const fil = ordreMsg ? filOrdre(messagesParConversation.get(ordreMsg.conversation_id) ?? [], ordreMsg.id, mission.id) : []
      return {
        missionId: mission.id,
        conversationId: ordreMsg?.conversation_id ?? null,
        messageId: ordreMsg?.id ?? null,
        referenceAj: texte(o.reference_aj) || texte(meta.reference_aj),
        titre: texte(o.titre) || mission.type || 'Intervention',
        copropriete: mission.immeuble || '',
        adresse: texte(o.adresse),
        localisation: mission.zone_signalee || '',
        prestataire: { nom: mission.artisan || 'Prestataire', metier: metierParCompte.get(artisanId) ?? '' },
        urgence: urgenceOrdre(o.urgence),
        dateIntervention: texte(o.date_souhaitee) || mission.date_intervention || '',
        creeLe: ordreMsg?.created_at || mission.created_at || '',
        statut: ordreMsg ? statutOrdre(o) : statutDepuisMission(mission.statut),
        heureArrivee: texte(o.arrival_time),
        messages: fil.map((m) => versMessage(m, artisanId)),
      }
    })
    return noStore({ prestataires, ordres })
  } catch (e) {
    logger.error(`[${CONTEXTE}/GET] exception`, undefined, e)
    return erreurInterne()
  }
}

// ═══ POST — envoi d'un ordre de service, ou réponse dans son fil ═══
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`aj-ordres-prestataire-post:${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await utilisateurAutorise()
  if (!user) return NextResponse.json({ error: 'non_autorise' }, { status: 401 })

  const validation = validateBody(ajOrdrePrestataireSchema, await request.json().catch(() => null))
  if (!validation.success) return NextResponse.json({ error: 'requete_invalide', details: validation.error }, { status: 400 })

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'non_autorise' }, { status: 403 })

  try {
    const corps = validation.data
    if (corps.action === 'envoyer') return await envoyer(user, cabinetId, corps)
    return await repondre(user, cabinetId, corps.mission_id, corps.content)
  } catch (e) {
    logger.error(`[${CONTEXTE}/POST] exception`, undefined, e)
    return erreurInterne()
  }
}

/** Nom affiché du compte connecté. */
const nomDuCompte = (user: User): string =>
  (user.user_metadata?.full_name as string | undefined) || user.email || 'Administrateur judiciaire'

async function envoyer(user: User, cabinetId: string, d: DemandeEnvoiOrdre) {
  // ── Prestataire du cabinet, avec compte Vitfix ──
  const { data: art, error: artErr } = await supabaseAdmin
    .from('syndic_artisans')
    .select('id, artisan_user_id, nom, prenom, nom_famille, metier')
    .eq('id', d.syndic_artisan_id)
    .eq('cabinet_id', cabinetId)
    .maybeSingle()
  if (artErr) {
    logger.error(`[${CONTEXTE}/envoyer] lecture prestataire`, { message: artErr.message })
    return erreurInterne()
  }
  const prestataire = art as FicheLigne | null
  if (!prestataire) return NextResponse.json({ error: 'prestataire_introuvable' }, { status: 404 })
  if (!prestataire.artisan_user_id) return NextResponse.json({ error: 'prestataire_sans_compte' }, { status: 422 })
  const nomPrestataire = nomFiche(prestataire) || 'Prestataire'

  // Donneur d'ordre affiché au prestataire : le cabinet, sinon le compte.
  const { data: cab, error: cabErr } = await supabaseAdmin.from('syndic_cabinets').select('nom').eq('id', cabinetId).maybeSingle()
  if (cabErr) logger.warn(`[${CONTEXTE}/envoyer] lecture cabinet`, { message: cabErr.message })
  const nomCompte = nomDuCompte(user)
  const nomCabinet = (cab as { nom?: string | null } | null)?.nom?.trim() || nomCompte

  // Jour réel du serveur par défaut (jamais la date figée de la démonstration de l'écran).
  const dateIntervention = d.date_intervention || new Date().toISOString().slice(0, 10)
  const { priorite, urgenceOrdre: urgence } = correspondanceUrgence(d.urgence)
  const description = d.description || d.objet

  // ── 1. Mission du cabinet, sans signalement ──
  const { data: mission, error: missionErr } = await supabaseAdmin
    .from('syndic_missions')
    .insert({
      cabinet_id: cabinetId,
      signalement_id: null,
      immeuble: d.copropriete,
      artisan: nomPrestataire,
      type: d.objet,
      description,
      priorite,
      statut: 'en_attente', // suivi ensuite par PATCH /api/pro/messagerie (acceptee → en_cours → terminee)
      date_intervention: dateIntervention,
      demandeur_nom: nomCompte,
      demandeur_role: ORIGINE_ADMINISTRATEUR_JUDICIAIRE,
      est_partie_commune: true,
      zone_signalee: d.localisation ?? null,
    })
    .select('id')
    .single()
  if (missionErr || !mission) {
    logger.error(`[${CONTEXTE}/envoyer] création mission`, { message: missionErr?.message })
    return erreurInterne()
  }
  const missionId = (mission as { id: string }).id

  // ── 2. Livraison au compte Vitfix du prestataire ──
  const reference = d.reference_aj
  const descriptionOrdre = [
    description,
    d.note ? `Note de l'administrateur judiciaire : ${d.note}` : '',
    reference ? `Ordre de service ${reference} — administrateur judiciaire` : 'Ordre de service — administrateur judiciaire',
  ]
    .filter(Boolean)
    .join('\n\n')
  const livraison = await livrerMission(supabaseAdmin, {
    artisanUserId: prestataire.artisan_user_id,
    cabinetId,
    contactId: cabinetId,
    contactName: nomCabinet,
    senderId: user.id,
    senderName: nomCompte,
    titre: d.objet,
    description: descriptionOrdre,
    adresse: [[d.copropriete, d.adresse].filter(Boolean).join(', '), d.localisation].filter(Boolean).join(' — '),
    dateIntervention,
    priorite: libelleUrgenceOrdre(urgence),
    urgence,
    references: { syndic_mission_id: missionId },
    marque: { origine: ORIGINE_ADMINISTRATEUR_JUDICIAIRE, ...(reference ? { reference_aj: reference } : {}) },
  })

  // Ordre non livré : la mission créée est retirée, l'administrateur peut recommencer sans doublon.
  if (!livraison.ordreEnvoye) {
    await retirerMissionNonLivree(supabaseAdmin, missionId, cabinetId, livraison.bookingId, CONTEXTE)
    return NextResponse.json({ error: 'livraison_impossible' }, { status: 500 })
  }

  return NextResponse.json({
    mission_id: missionId,
    conversation_id: livraison.conversationId,
    notification: livraison.notificationEnvoyee,
  })
}

async function repondre(user: User, cabinetId: string, missionId: string, content: string) {
  // ── Mission envoyée depuis l'Administrateur judiciaire, dans le cabinet ──
  const { data: mission, error: missionErr } = await supabaseAdmin
    .from('syndic_missions')
    .select('id')
    .eq('id', missionId)
    .eq('cabinet_id', cabinetId)
    .eq('demandeur_role', ORIGINE_ADMINISTRATEUR_JUDICIAIRE)
    .maybeSingle()
  if (missionErr) {
    logger.error(`[${CONTEXTE}/repondre] lecture mission`, { message: missionErr.message })
    return erreurInterne()
  }
  if (!mission) return NextResponse.json({ error: 'ordre_introuvable' }, { status: 404 })

  // ── Conversation de l'ordre : conversation « pro » du cabinet qui porte l'ordre de cette mission ──
  const { data: convData, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('id, artisan_id, contact_name')
    .eq('contact_id', cabinetId)
    .eq('contact_type', 'pro')
  if (convErr) {
    logger.error(`[${CONTEXTE}/repondre] conversations`, { message: convErr.message })
    return erreurInterne()
  }
  const conversations = (convData || []) as ConversationLigne[]
  if (conversations.length === 0) return NextResponse.json({ error: 'ordre_introuvable' }, { status: 404 })

  const { data: ordresData, error: ordresErr } = await supabaseAdmin
    .from('conversation_messages')
    .select('id, conversation_id, ordre_mission')
    .in('conversation_id', conversations.map((c) => c.id))
    .eq('type', 'ordre_mission')
    .order('created_at', { ascending: false })
    .limit(ORDRES_RECHERCHE_MAX)
  if (ordresErr) {
    logger.error(`[${CONTEXTE}/repondre] ordres de mission`, { message: ordresErr.message })
    return erreurInterne()
  }
  const ordre = ((ordresData || []) as Array<Pick<MessageLigne, 'id' | 'conversation_id' | 'ordre_mission'>>).find(
    (m) => objet(m.ordre_mission).syndic_mission_id === missionId,
  )
  const conversation = ordre ? conversations.find((c) => c.id === ordre.conversation_id) : undefined
  if (!conversation) return NextResponse.json({ error: 'ordre_introuvable' }, { status: 404 })

  // Seulement avec un prestataire du cabinet (même périmètre que la liste).
  const { data: fiche, error: ficheErr } = await supabaseAdmin
    .from('syndic_artisans')
    .select('id')
    .eq('cabinet_id', cabinetId)
    .eq('artisan_user_id', conversation.artisan_id)
    .limit(1)
    .maybeSingle()
  if (ficheErr) {
    logger.error(`[${CONTEXTE}/repondre] syndic_artisans`, { message: ficheErr.message })
    return erreurInterne()
  }
  if (!fiche) return NextResponse.json({ error: 'ordre_introuvable' }, { status: 404 })

  const { data: msg, error: msgErr } = await supabaseAdmin
    .from('conversation_messages')
    .insert({
      conversation_id: conversation.id,
      sender_id: user.id,
      type: 'text',
      content,
      metadata: { cote: 'donneur_ordre', syndic_mission_id: missionId, origine: ORIGINE_ADMINISTRATEUR_JUDICIAIRE },
    })
    .select(COLONNES_MESSAGE)
    .single()
  if (msgErr || !msg) {
    logger.error(`[${CONTEXTE}/repondre] insertion message`, { message: msgErr?.message })
    return erreurInterne()
  }

  // Même compte des deux côtés (démo) : le trigger ne compte pas ce message comme non lu.
  if (conversation.artisan_id === user.id) await compterNonLuMemeCompte(supabaseAdmin, conversation.id)

  // Notification in-app du prestataire (aucun e-mail / SMS).
  const nom = conversation.contact_name || nomDuCompte(user)
  const { error: notifErr } = await supabaseAdmin.from('artisan_notifications').insert({
    artisan_id: conversation.artisan_id,
    type: 'message',
    title: `Nouveau message de ${nom}`,
    body: content.substring(0, 100),
    read: false,
    data_json: {
      conversation_id: conversation.id,
      contact_id: cabinetId,
      contact_type: 'pro',
      message_type: 'text',
      syndic_mission_id: missionId,
      origine: ORIGINE_ADMINISTRATEUR_JUDICIAIRE,
    },
  })
  if (notifErr) logger.warn(`[${CONTEXTE}/repondre] notification`, { message: notifErr.message })

  return NextResponse.json({ message: versMessage(msg as MessageLigne, conversation.artisan_id) })
}
