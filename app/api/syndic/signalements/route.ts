import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/syndic/signalements — récupérer les signalements du cabinet
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_signalements')
    .select(`
      *,
      syndic_signalement_messages (
        id, auteur, role, texte, created_at
      )
    `)
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
    messages: (s.syndic_signalement_messages || []).map((m: any) => ({
      id: m.id,
      auteur: m.auteur,
      role: m.role,
      texte: m.texte,
      createdAt: m.created_at,
    })),
  }))

  return NextResponse.json({ signalements })
}

// PATCH /api/syndic/signalements — mettre à jour un signalement
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ signalement: data })
}

// POST /api/syndic/signalements/message — ajouter un message (via query param action=message)
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json()
  const { signalementId, auteur, role, texte } = body

  if (!signalementId || !texte) {
    return NextResponse.json({ error: 'signalementId et texte requis' }, { status: 400 })
  }

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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
