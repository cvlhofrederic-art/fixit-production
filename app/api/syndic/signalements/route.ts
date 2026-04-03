import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicSignalementMessageSchema, validateBody } from '@/lib/validation'

// GET /api/syndic/signalements — récupérer les signalements du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .select(`
        id, immeuble_nom, demandeur_nom, demandeur_role, demandeur_email, demandeur_telephone, type_intervention, description, priorite, statut, batiment, etage, num_lot, est_partie_commune, zone_signalee, artisan_assigne, created_at, updated_at,
        syndic_signalement_messages (
          id, auteur, role, texte, created_at
        )
      `)
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const signalements = (data || []).map(s => ({
      id: s.id,
      immeuble: s.immeuble_nom || '',
      demandeurNom: s.demandeur_nom || '',
      demandeurRole: s.demandeur_role || '',
      demandeurEmail: s.demandeur_email || '',
      demandeurTelephone: s.demandeur_telephone || '',
      typeIntervention: s.type_intervention || '',
      description: s.description || '',
      priorite: s.priorite || 'normale',
      statut: s.statut || 'en_attente',
      batiment: s.batiment || '',
      etage: s.etage || '',
      numLot: s.num_lot || '',
      estPartieCommune: s.est_partie_commune || false,
      zoneSignalee: s.zone_signalee || '',
      artisanAssigne: s.artisan_assigne || '',
      createdAt: s.created_at,
      updatedAt: s.updated_at,
      messages: (s.syndic_signalement_messages || []).map((m: { id: string; auteur: string; role: string; texte: string; created_at: string }) => ({
        id: m.id,
        auteur: m.auteur,
        role: m.role,
        texte: m.texte,
        createdAt: m.created_at,
      })),
    }))

    const response = NextResponse.json({ signalements })
    response.headers.set('Cache-Control', 'private, max-age=0, s-maxage=30, stale-while-revalidate=60')
    return response
  } catch (err) {
    console.error('[syndic/signalements/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/signalements — mettre à jour un signalement
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

    const dbUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }
    if (updates.statut !== undefined) dbUpdates.statut = updates.statut
    if (updates.artisanAssigne !== undefined) dbUpdates.artisan_assigne = updates.artisanAssigne
    if (updates.priorite !== undefined) dbUpdates.priorite = updates.priorite

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .update(dbUpdates)
      .eq('id', id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ signalement: data })
  } catch (err) {
    console.error('[syndic/signalements/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/signalements/message — ajouter un message (via query param action=message)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const body = await request.json()
    const validation = validateBody(syndicSignalementMessageSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Donn\u00e9es invalides', details: validation.error }, { status: 400 })
    }
    const { signalementId, auteur, role, texte } = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_signalement_messages')
      .insert({
        signalement_id: signalementId,
        auteur: auteur || 'Gestionnaire',
        role: role || 'gestionnaire',
        texte,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    return NextResponse.json({ message: data })
  } catch (err) {
    console.error('[syndic/signalements/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
