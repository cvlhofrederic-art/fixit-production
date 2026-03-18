import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/syndic/assemblees
// Retourne toutes les AG du cabinet avec résolutions + votes correspondance
// ══════════════════════════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`ag_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)

  // Filtres optionnels
  const statut = request.nextUrl.searchParams.get('statut')
  const immeuble = request.nextUrl.searchParams.get('immeuble')
  const agId = request.nextUrl.searchParams.get('id')

  // ── Requête d'une AG spécifique avec tous ses détails ──────────────
  if (agId) {
    const { data: ag, error } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('*')
      .eq('id', agId)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()

    if (error || !ag) {
      return NextResponse.json({ error: 'AG introuvable' }, { status: 404 })
    }

    // Charger résolutions + votes correspondance
    const { data: resolutions } = await supabaseAdmin
      .from('syndic_resolutions')
      .select('*')
      .eq('assemblee_id', agId)
      .eq('cabinet_id', cabinetId)
      .order('numero_ordre', { ascending: true })

    // Charger votes correspondance pour chaque résolution
    const resolutionIds = (resolutions || []).map(r => r.id)
    let votesCorr: any[] = []
    if (resolutionIds.length > 0) {
      const { data: vc } = await supabaseAdmin
        .from('syndic_votes_correspondance')
        .select('*')
        .in('resolution_id', resolutionIds)
        .eq('cabinet_id', cabinetId)
      votesCorr = vc || []
    }

    // Charger présences
    const { data: presences } = await supabaseAdmin
      .from('syndic_ag_presences')
      .select('*')
      .eq('assemblee_id', agId)
      .eq('cabinet_id', cabinetId)

    // Assembler les résolutions avec leurs votes
    const resolutionsWithVotes = (resolutions || []).map(r => ({
      ...r,
      votesCorrespondance: votesCorr.filter(v => v.resolution_id === r.id),
    }))

    return NextResponse.json({
      assemblee: { ...ag, resolutions: resolutionsWithVotes, presences: presences || [] },
    })
  }

  // ── Liste de toutes les AG ────────────────────────────────────────
  let query = supabaseAdmin
    .from('syndic_assemblees')
    .select('*, syndic_resolutions(count)')
    .eq('cabinet_id', cabinetId)
    .order('date_ag', { ascending: false })

  if (statut) query = query.eq('statut', statut)
  if (immeuble) query = query.eq('immeuble', immeuble)

  const { data, error } = await query

  if (error) {
    logger.error('[ASSEMBLEES] GET error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  const response = NextResponse.json({ assemblees: data || [] })
  response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
  return response
}

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/syndic/assemblees
// Créer une nouvelle AG (+ batch import pour migration localStorage)
// ══════════════════════════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = user.user_metadata?.role || ''
  if (!['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_secretaire', 'syndic_juriste'].includes(userRole)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`ag_post_${ip}`, 15, 60_000))) return rateLimitResponse()

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const body = await request.json()

  // ── Batch import (migration depuis localStorage) ──────────────────
  if (Array.isArray(body.assemblees)) {
    const results: any[] = []

    for (const ag of body.assemblees.slice(0, 50)) {
      // Insérer l'AG
      const { data: newAG, error: agError } = await supabaseAdmin
        .from('syndic_assemblees')
        .insert({
          cabinet_id: cabinetId,
          titre: ag.titre || '',
          immeuble: ag.immeuble || '',
          date_ag: ag.date || new Date().toISOString(),
          lieu: ag.lieu || '',
          type_ag: ag.type === 'extraordinaire' ? 'extraordinaire' : 'ordinaire',
          statut: ['brouillon', 'convoquée', 'en_cours', 'clôturée', 'annulée'].includes(ag.statut) ? ag.statut : 'brouillon',
          ordre_du_jour: ag.ordre_du_jour || [],
          quorum: ag.quorum || 50,
          total_tantiemes: ag.totalTantiemes || 10000,
          presents: ag.presents || 0,
          signataire_nom: ag.signataireNom || null,
          signataire_role: ag.signataireRole || null,
          signature_ts: ag.signatureTs || null,
          notes: ag.notes || null,
        })
        .select()
        .single()

      if (agError || !newAG) {
        logger.error('[ASSEMBLEES] Migration insert error:', agError)
        continue
      }

      // Insérer les résolutions de cette AG
      if (ag.resolutions?.length > 0) {
        const resInserts = ag.resolutions.map((r: any, idx: number) => ({
          assemblee_id: newAG.id,
          cabinet_id: cabinetId,
          titre: r.titre || '',
          description: r.description || null,
          numero_ordre: idx + 1,
          majorite: ['art24', 'art25', 'art26', 'unanimite'].includes(r.majorite) ? r.majorite : 'art24',
          vote_pour: r.votePour || 0,
          vote_contre: r.voteContre || 0,
          vote_abstention: r.voteAbstention || 0,
          statut: ['en_cours', 'adoptée', 'rejetée'].includes(r.statut) ? r.statut : 'en_cours',
        }))

        const { data: newRes } = await supabaseAdmin
          .from('syndic_resolutions')
          .insert(resInserts)
          .select()

        // Insérer les votes par correspondance
        if (newRes) {
          for (let i = 0; i < newRes.length; i++) {
            const origRes = ag.resolutions[i]
            if (origRes?.votesCorrespondance?.length > 0) {
              const vcInserts = origRes.votesCorrespondance.map((vc: any) => ({
                resolution_id: newRes[i].id,
                cabinet_id: cabinetId,
                copropriétaire: vc.copropriétaire || '',
                tantiemes: vc.tantiemes || 0,
                vote: ['pour', 'contre', 'abstention'].includes(vc.vote) ? vc.vote : 'abstention',
                date_reception: vc.recu || new Date().toISOString().split('T')[0],
              }))

              await supabaseAdmin
                .from('syndic_votes_correspondance')
                .insert(vcInserts)
            }
          }
        }
      }

      results.push(newAG)
    }

    return NextResponse.json({
      assemblees: results,
      count: results.length,
      message: `${results.length} assemblée(s) importée(s)`,
    })
  }

  // ── Création simple d'une AG ──────────────────────────────────────
  const ag = body.assemblee || body

  if (!ag.titre?.trim()) {
    return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('syndic_assemblees')
    .insert({
      cabinet_id: cabinetId,
      titre: ag.titre,
      immeuble: ag.immeuble || '',
      date_ag: ag.date || ag.date_ag || new Date().toISOString(),
      lieu: ag.lieu || '',
      type_ag: ag.type === 'extraordinaire' ? 'extraordinaire' : 'ordinaire',
      statut: 'brouillon',
      ordre_du_jour: ag.ordre_du_jour || ag.ordreDuJour || [],
      quorum: ag.quorum || 50,
      total_tantiemes: ag.totalTantiemes || ag.total_tantiemes || 10000,
    })
    .select()
    .single()

  if (error) {
    logger.error('[ASSEMBLEES] POST error:', error)
    return NextResponse.json({ error: 'Erreur création AG' }, { status: 500 })
  }

  return NextResponse.json({ assemblee: data })
}

// ══════════════════════════════════════════════════════════════════════════════
// PATCH /api/syndic/assemblees
// Modifier une AG, ses résolutions, voter, ajouter présences
// ══════════════════════════════════════════════════════════════════════════════
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`ag_patch_${ip}`, 30, 60_000))) return rateLimitResponse()

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const body = await request.json()
  const { action } = body

  // ── Action: update_ag — mise à jour des champs de l'AG ────────────
  if (action === 'update_ag') {
    const { id, ...fields } = body
    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Vérifier ownership
    const { data: existing } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('id')
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (!existing) return NextResponse.json({ error: 'AG introuvable' }, { status: 404 })

    const updates: Record<string, unknown> = {}
    if (fields.titre !== undefined) updates.titre = fields.titre
    if (fields.immeuble !== undefined) updates.immeuble = fields.immeuble
    if (fields.date !== undefined || fields.date_ag !== undefined) updates.date_ag = fields.date || fields.date_ag
    if (fields.lieu !== undefined) updates.lieu = fields.lieu
    if (fields.type !== undefined || fields.type_ag !== undefined) updates.type_ag = fields.type || fields.type_ag
    if (fields.statut !== undefined) updates.statut = fields.statut
    if (fields.ordre_du_jour !== undefined) updates.ordre_du_jour = fields.ordre_du_jour
    if (fields.quorum !== undefined) updates.quorum = fields.quorum
    if (fields.totalTantiemes !== undefined || fields.total_tantiemes !== undefined) updates.total_tantiemes = fields.totalTantiemes || fields.total_tantiemes
    if (fields.presents !== undefined) updates.presents = fields.presents
    if (fields.signataireNom !== undefined || fields.signataire_nom !== undefined) updates.signataire_nom = fields.signataireNom || fields.signataire_nom
    if (fields.signataireRole !== undefined || fields.signataire_role !== undefined) updates.signataire_role = fields.signataireRole || fields.signataire_role
    if (fields.signatureTs !== undefined || fields.signature_ts !== undefined) updates.signature_ts = fields.signatureTs || fields.signature_ts || new Date().toISOString()
    if (fields.notes !== undefined) updates.notes = fields.notes
    if (fields.pvContent !== undefined || fields.pv_content !== undefined) updates.pv_content = fields.pvContent || fields.pv_content
    if (fields.convocation_sent_at !== undefined) updates.convocation_sent_at = fields.convocation_sent_at
    if (fields.convocation_count !== undefined) updates.convocation_count = fields.convocation_count

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_assemblees')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('[ASSEMBLEES] PATCH update_ag error:', error)
      return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
    }

    return NextResponse.json({ assemblee: data })
  }

  // ── Action: add_resolution — ajouter une résolution ───────────────
  if (action === 'add_resolution') {
    const { assemblee_id, titre, description, majorite, numero_ordre } = body
    if (!assemblee_id || !titre?.trim()) {
      return NextResponse.json({ error: 'assemblee_id et titre requis' }, { status: 400 })
    }

    // Vérifier ownership
    const { data: ag } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('id')
      .eq('id', assemblee_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (!ag) return NextResponse.json({ error: 'AG introuvable' }, { status: 404 })

    // Auto-déterminer numero_ordre
    let ordre = numero_ordre
    if (!ordre) {
      const { count } = await supabaseAdmin
        .from('syndic_resolutions')
        .select('*', { count: 'exact', head: true })
        .eq('assemblee_id', assemblee_id)
      ordre = (count || 0) + 1
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_resolutions')
      .insert({
        assemblee_id,
        cabinet_id: cabinetId,
        titre,
        description: description || null,
        numero_ordre: ordre,
        majorite: ['art24', 'art25', 'art26', 'unanimite'].includes(majorite) ? majorite : 'art24',
      })
      .select()
      .single()

    if (error) {
      logger.error('[ASSEMBLEES] PATCH add_resolution error:', error)
      return NextResponse.json({ error: 'Erreur ajout résolution' }, { status: 500 })
    }

    return NextResponse.json({ resolution: data })
  }

  // ── Action: vote_seance — enregistrer les votes en séance ─────────
  if (action === 'vote_seance') {
    const { resolution_id, pour, contre, abstention } = body
    if (!resolution_id) return NextResponse.json({ error: 'resolution_id requis' }, { status: 400 })

    // Vérifier ownership
    const { data: res } = await supabaseAdmin
      .from('syndic_resolutions')
      .select('id, vote_pour, vote_contre, vote_abstention, assemblee_id')
      .eq('id', resolution_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (!res) return NextResponse.json({ error: 'Résolution introuvable' }, { status: 404 })

    const newPour = (res.vote_pour || 0) + (pour || 0)
    const newContre = (res.vote_contre || 0) + (contre || 0)
    const newAbs = (res.vote_abstention || 0) + (abstention || 0)

    // Récupérer total tantièmes pour calculer le résultat
    const { data: ag } = await supabaseAdmin
      .from('syndic_assemblees')
      .select('total_tantiemes')
      .eq('id', res.assemblee_id)
      .single()

    const totalT = ag?.total_tantiemes || 10000

    // Déterminer statut basé sur majorité
    const { data: resData } = await supabaseAdmin
      .from('syndic_resolutions')
      .select('majorite')
      .eq('id', resolution_id)
      .single()

    let statut = 'en_cours'
    if (newPour + newContre + newAbs > 0) {
      const majorite = resData?.majorite || 'art24'
      if (majorite === 'art24') statut = newPour > newContre ? 'adoptée' : 'rejetée'
      else if (majorite === 'art25') statut = newPour > totalT / 2 ? 'adoptée' : 'rejetée'
      else if (majorite === 'art26') statut = newPour >= totalT * 2 / 3 ? 'adoptée' : 'rejetée'
      else if (majorite === 'unanimite') statut = newContre === 0 && newAbs === 0 ? 'adoptée' : 'rejetée'
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_resolutions')
      .update({
        vote_pour: newPour,
        vote_contre: newContre,
        vote_abstention: newAbs,
        statut,
      })
      .eq('id', resolution_id)
      .select()
      .single()

    if (error) {
      logger.error('[ASSEMBLEES] PATCH vote_seance error:', error)
      return NextResponse.json({ error: 'Erreur vote' }, { status: 500 })
    }

    return NextResponse.json({ resolution: data })
  }

  // ── Action: vote_correspondance — ajouter un vote par correspondance ──
  if (action === 'vote_correspondance') {
    const { resolution_id, copropriétaire, tantiemes, vote, date_reception, coproprio_id } = body
    if (!resolution_id || !copropriétaire?.trim()) {
      return NextResponse.json({ error: 'resolution_id et copropriétaire requis' }, { status: 400 })
    }

    // Vérifier ownership
    const { data: res } = await supabaseAdmin
      .from('syndic_resolutions')
      .select('id')
      .eq('id', resolution_id)
      .eq('cabinet_id', cabinetId)
      .maybeSingle()
    if (!res) return NextResponse.json({ error: 'Résolution introuvable' }, { status: 404 })

    const { data, error } = await supabaseAdmin
      .from('syndic_votes_correspondance')
      .insert({
        resolution_id,
        cabinet_id: cabinetId,
        copropriétaire,
        coproprio_id: coproprio_id || null,
        tantiemes: tantiemes || 0,
        vote: ['pour', 'contre', 'abstention'].includes(vote) ? vote : 'abstention',
        date_reception: date_reception || new Date().toISOString().split('T')[0],
      })
      .select()
      .single()

    if (error) {
      logger.error('[ASSEMBLEES] PATCH vote_correspondance error:', error)
      return NextResponse.json({ error: 'Erreur ajout vote' }, { status: 500 })
    }

    return NextResponse.json({ vote: data })
  }

  // ── Action: add_presence — ajouter une présence ───────────────────
  if (action === 'add_presence') {
    const { assemblee_id, nom, tantiemes, type_presence, representant, coproprio_id } = body
    if (!assemblee_id || !nom?.trim()) {
      return NextResponse.json({ error: 'assemblee_id et nom requis' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_ag_presences')
      .insert({
        assemblee_id,
        cabinet_id: cabinetId,
        coproprio_id: coproprio_id || null,
        nom,
        tantiemes: tantiemes || 0,
        type_presence: ['present', 'représenté', 'absent', 'procuration'].includes(type_presence) ? type_presence : 'present',
        representant: representant || null,
        heure_arrivee: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      logger.error('[ASSEMBLEES] PATCH add_presence error:', error)
      return NextResponse.json({ error: 'Erreur ajout présence' }, { status: 500 })
    }

    return NextResponse.json({ presence: data })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/syndic/assemblees
// Supprimer une AG ou une résolution
// ══════════════════════════════════════════════════════════════════════════════
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }
  const userRole = user.user_metadata?.role || ''
  if (!['syndic', 'syndic_admin'].includes(userRole)) {
    return NextResponse.json({ error: 'Droits insuffisants (admin requis)' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`ag_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const type = request.nextUrl.searchParams.get('type') || 'assemblee'
  const id = request.nextUrl.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  if (type === 'resolution') {
    const { error } = await supabaseAdmin
      .from('syndic_resolutions')
      .delete()
      .eq('id', id)
      .eq('cabinet_id', cabinetId)

    if (error) {
      logger.error('[ASSEMBLEES] DELETE resolution error:', error)
      return NextResponse.json({ error: 'Erreur suppression résolution' }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  }

  // Supprimer l'AG (cascade supprime résolutions + votes + présences)
  const { error } = await supabaseAdmin
    .from('syndic_assemblees')
    .delete()
    .eq('id', id)
    .eq('cabinet_id', cabinetId)

  if (error) {
    logger.error('[ASSEMBLEES] DELETE error:', error)
    return NextResponse.json({ error: 'Erreur suppression AG' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
