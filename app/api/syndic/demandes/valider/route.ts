import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { syndicDemandeValiderSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { livrerMission, localisationSignalement, prioriteMissionSyndic } from '@/lib/syndic/livraison-mission'

// ── POST /api/syndic/demandes/valider ────────────────────────────────────────
// « Valider la mission » depuis le Canal de communication v54 (onglet Demandes) : le syndic confie le
// signalement d'un copropriétaire à un prestataire de SON cabinet.
//   1. mission syndic_missions (statut 'en_cours', liée au signalement) ;
//   2. livraison au compte Vitfix du prestataire (booking si fiche artisan, ordre de mission dans
//      Messagerie > Pro, notification in-app, canal legacy) — lib/syndic/livraison-mission.ts ;
//   3. signalement passé en 'acceptee' + message « Mission confiée à … » dans le fil du copropriétaire.
// Le prestataire vient d'une ligne syndic_artisans du cabinet et de son artisan_user_id uniquement :
// jamais de recherche par nom ou e-mail, jamais dans un autre cabinet. Aucun e-mail ni SMS.

interface SignalementLigne {
  id: string
  immeuble_nom: string | null
  demandeur_nom: string | null
  demandeur_role: string | null
  demandeur_email: string | null
  type_intervention: string | null
  description: string | null
  priorite: string | null
  statut: string | null
  batiment: string | null
  etage: string | null
  num_lot: string | null
  est_partie_commune: boolean | null
  zone_signalee: string | null
}

interface PrestataireLigne {
  id: string
  artisan_user_id: string | null
  nom: string | null
  prenom: string | null
  nom_famille: string | null
  metier: string | null
}

const ERREUR_INTERNE = 'Une erreur interne est survenue'

export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`syndic_demande_valider_${ip}`, 20, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const body: unknown = await request.json().catch(() => null)
  const validation = validateBody(syndicDemandeValiderSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const { signalement_id, syndic_artisan_id, date_intervention, note } = validation.data

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  try {
    // ── Signalement du cabinet ──
    const { data: sig, error: sigErr } = await supabaseAdmin
      .from('syndic_signalements')
      .select('id, immeuble_nom, demandeur_nom, demandeur_role, demandeur_email, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee')
      .eq('id', signalement_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (sigErr) {
      logger.error('[demandes/valider] lecture signalement', { message: sigErr.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const signalement = sig as SignalementLigne | null
    if (!signalement) return NextResponse.json({ error: 'signalement_introuvable' }, { status: 404 })
    if ((signalement.statut || 'en_attente') !== 'en_attente') {
      return NextResponse.json({ error: 'signalement_deja_traite' }, { status: 409 })
    }

    // ── Prestataire du cabinet, avec compte Vitfix ──
    const { data: art, error: artErr } = await supabaseAdmin
      .from('syndic_artisans')
      .select('id, artisan_user_id, nom, prenom, nom_famille, metier')
      .eq('id', syndic_artisan_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (artErr) {
      logger.error('[demandes/valider] lecture prestataire', { message: artErr.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const prestataire = art as PrestataireLigne | null
    if (!prestataire) return NextResponse.json({ error: 'prestataire_introuvable' }, { status: 404 })
    if (!prestataire.artisan_user_id) {
      return NextResponse.json({ error: 'prestataire_sans_compte' }, { status: 422 })
    }
    const nomPrestataire = prestataire.nom?.trim()
      || [prestataire.prenom, prestataire.nom_famille].filter(Boolean).join(' ').trim()
      || 'Prestataire'

    // Nom du donneur d'ordre affiché au prestataire : le cabinet, sinon le compte.
    const { data: cab } = await supabaseAdmin.from('syndic_cabinets').select('nom').eq('id', cabinetId).maybeSingle()
    const nomCompte = (user.user_metadata?.full_name as string | undefined) || user.email || 'Syndic'
    const nomCabinet = (cab as { nom?: string | null } | null)?.nom?.trim() || nomCompte

    const dateIntervention = date_intervention || new Date().toISOString().split('T')[0]
    const priorite = prioriteMissionSyndic(signalement.priorite)
    const titre = signalement.type_intervention || 'Intervention'
    const descriptionSignalement = signalement.description?.trim() || titre

    // ── 1. Mission syndic ──
    const { data: mission, error: missionErr } = await supabaseAdmin
      .from('syndic_missions')
      .insert({
        cabinet_id: cabinetId,
        signalement_id: signalement.id,
        immeuble: signalement.immeuble_nom || '',
        artisan: nomPrestataire,
        type: titre,
        description: descriptionSignalement,
        priorite,
        statut: 'en_cours',
        date_intervention: dateIntervention,
        batiment: signalement.batiment,
        etage: signalement.etage,
        num_lot: signalement.num_lot,
        demandeur_nom: signalement.demandeur_nom,
        demandeur_role: signalement.demandeur_role,
        demandeur_email: signalement.demandeur_email,
        est_partie_commune: signalement.est_partie_commune ?? false,
        zone_signalee: signalement.zone_signalee,
      })
      .select('id')
      .single()
    if (missionErr || !mission) {
      logger.error('[demandes/valider] création mission', { message: missionErr?.message })
      return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
    }
    const missionId = (mission as { id: string }).id

    // ── 2. Livraison au prestataire (planifiee → normale pour l'ordre de mission) ──
    const urgence = priorite === 'urgente' ? 'urgente' : 'normale'
    const livraison = await livrerMission(supabaseAdmin, {
      artisanUserId: prestataire.artisan_user_id,
      cabinetId,
      contactId: cabinetId,
      contactName: nomCabinet,
      senderId: user.id,
      senderName: nomCompte,
      titre,
      description: note ? `${descriptionSignalement}\n\nNote du syndic : ${note}` : descriptionSignalement,
      adresse: localisationSignalement(signalement),
      dateIntervention,
      priorite: urgence,
      urgence,
      references: { signalement_id: signalement.id, syndic_mission_id: missionId },
    })

    // ── 3. Signalement accepté + message dans le fil du copropriétaire ──
    const { error: updErr } = await supabaseAdmin
      .from('syndic_signalements')
      .update({ statut: 'acceptee', artisan_assigne: nomPrestataire, updated_at: new Date().toISOString() })
      .eq('id', signalement.id)
      .eq('cabinet_id', cabinetId)
    if (updErr) logger.error('[demandes/valider] mise à jour signalement', { message: updErr.message })

    const dateFr = new Date(dateIntervention + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    const { error: msgErr } = await supabaseAdmin.from('syndic_signalement_messages').insert({
      signalement_id: signalement.id,
      auteur: 'Syndic',
      role: 'syndic',
      texte: `Mission confiée à ${nomPrestataire}${prestataire.metier ? ` (${prestataire.metier})` : ''} — intervention prévue le ${dateFr}.`,
    })
    if (msgErr) logger.error('[demandes/valider] message signalement', { message: msgErr.message })

    return NextResponse.json({
      mission_id: missionId,
      conversation_id: livraison.conversationId,
      notification: livraison.ordreEnvoye && livraison.notificationEnvoyee,
    })
  } catch (e) {
    logger.error('[demandes/valider] exception', undefined, e)
    return NextResponse.json({ error: ERREUR_INTERNE }, { status: 500 })
  }
}
