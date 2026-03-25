import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicMissionSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/missions — récupérer les missions du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`missions_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_missions')
      .select('id, cabinet_id, immeuble, artisan, type, description, priorite, statut, date_creation, date_intervention, montant_devis, montant_facture, batiment, etage, num_lot, locataire, telephone_locataire, acces_logement, demandeur_nom, demandeur_role, demandeur_email, est_partie_commune, zone_signalee, canal_messages, demandeur_messages, rapport_artisan, travail_effectue, materiaux_utilises, problemes_constates, recommandations, date_rapport, duree_intervention, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    // Adapter les champs snake_case → camelCase pour le frontend
    const missions = (data || []).map(m => ({
      id: m.id,
      immeuble: m.immeuble || '',
      artisan: m.artisan || '',
      type: m.type || '',
      description: m.description || '',
      priorite: m.priorite || 'normale',
      statut: m.statut || 'en_attente',
      dateCreation: m.date_creation || m.created_at?.split('T')[0],
      dateIntervention: m.date_intervention,
      montantDevis: m.montant_devis,
      montantFacture: m.montant_facture,
      batiment: m.batiment,
      etage: m.etage,
      numLot: m.num_lot,
      locataire: m.locataire,
      telephoneLocataire: m.telephone_locataire,
      accesLogement: m.acces_logement,
      demandeurNom: m.demandeur_nom,
      demandeurRole: m.demandeur_role,
      demandeurEmail: m.demandeur_email,
      estPartieCommune: m.est_partie_commune,
      zoneSignalee: m.zone_signalee,
      canalMessages: m.canal_messages || [],
      demandeurMessages: m.demandeur_messages || [],
      rapportArtisan: m.rapport_artisan,
      travailEffectue: m.travail_effectue,
      materiauxUtilises: m.materiaux_utilises,
      problemesConstates: m.problemes_constates,
      recommandations: m.recommandations,
      dateRapport: m.date_rapport,
      dureeIntervention: m.duree_intervention,
    }))

    const response = NextResponse.json({ missions })
    response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    logger.error('[syndic/missions/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/missions — créer une mission
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`missions_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    // Validation Zod — empêche l'injection de champs arbitraires
    const validation = validateBody(syndicMissionSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_missions')
      .insert({
        cabinet_id: cabinetId,
        signalement_id: v.signalementId || null,
        immeuble: v.immeuble || '',
        artisan: v.artisan || '',
        type: v.type || '',
        description: v.description || '',
        priorite: v.priorite || 'normale',
        statut: v.statut || 'en_attente',
        date_creation: v.dateCreation || new Date().toISOString().split('T')[0],
        date_intervention: v.dateIntervention || null,
        montant_devis: v.montantDevis || null,
        batiment: v.batiment || null,
        etage: v.etage || null,
        num_lot: v.numLot || null,
        locataire: v.locataire || null,
        telephone_locataire: v.telephoneLocataire || null,
        acces_logement: v.accesLogement || null,
        demandeur_nom: v.demandeurNom || null,
        demandeur_role: v.demandeurRole || null,
        demandeur_email: v.demandeurEmail || null,
        est_partie_commune: v.estPartieCommune || false,
        zone_signalee: v.zoneSignalee || null,
        canal_messages: v.canalMessages || [],
        demandeur_messages: v.demandeurMessages || [],
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/missions] POST insert error:', error.message)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ mission: data })
  } catch (err) {
    logger.error('[syndic/missions/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/missions — mettre à jour une mission
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`missions_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    // Mapper camelCase → snake_case
    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut
    if (updates.artisan !== undefined) dbUpdates.artisan = updates.artisan
    if (updates.priorite !== undefined) dbUpdates.priorite = updates.priorite
    if (updates.description !== undefined) dbUpdates.description = updates.description
    if (updates.dateIntervention !== undefined) dbUpdates.date_intervention = updates.dateIntervention
    if (updates.montantDevis !== undefined) dbUpdates.montant_devis = updates.montantDevis
    if (updates.montantFacture !== undefined) dbUpdates.montant_facture = updates.montantFacture
    if (updates.canalMessages !== undefined) dbUpdates.canal_messages = updates.canalMessages
    if (updates.demandeurMessages !== undefined) dbUpdates.demandeur_messages = updates.demandeurMessages
    if (updates.rapportArtisan !== undefined) dbUpdates.rapport_artisan = updates.rapportArtisan
    if (updates.travailEffectue !== undefined) dbUpdates.travail_effectue = updates.travailEffectue
    if (updates.materiauxUtilises !== undefined) dbUpdates.materiaux_utilises = updates.materiauxUtilises
    if (updates.problemesConstates !== undefined) dbUpdates.problemes_constates = updates.problemesConstates
    if (updates.recommandations !== undefined) dbUpdates.recommandations = updates.recommandations

    const { data, error } = await supabaseAdmin
      .from('syndic_missions')
      .update(dbUpdates)
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ mission: data })
  } catch (err) {
    logger.error('[syndic/missions/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/syndic/missions?id=xxx — supprimer une mission
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`missions_delete_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('syndic_missions')
      .delete()
      .eq('id', id)
      .eq('cabinet_id', cabinetId)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[syndic/missions/DELETE] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
