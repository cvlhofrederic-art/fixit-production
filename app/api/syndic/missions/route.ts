import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/syndic/missions — récupérer les missions du cabinet
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_missions')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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

  return NextResponse.json({ missions })
}

// POST /api/syndic/missions — créer une mission
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('syndic_missions')
    .insert({
      cabinet_id: cabinetId,
      signalement_id: body.signalementId || null,
      immeuble: body.immeuble || '',
      artisan: body.artisan || '',
      type: body.type || '',
      description: body.description || '',
      priorite: body.priorite || 'normale',
      statut: body.statut || 'en_attente',
      date_creation: body.dateCreation || new Date().toISOString().split('T')[0],
      date_intervention: body.dateIntervention || null,
      montant_devis: body.montantDevis || null,
      batiment: body.batiment || null,
      etage: body.etage || null,
      num_lot: body.numLot || null,
      locataire: body.locataire || null,
      telephone_locataire: body.telephoneLocataire || null,
      acces_logement: body.accesLogement || null,
      demandeur_nom: body.demandeurNom || null,
      demandeur_role: body.demandeurRole || null,
      demandeur_email: body.demandeurEmail || null,
      est_partie_commune: body.estPartieCommune || false,
      zone_signalee: body.zoneSignalee || null,
      canal_messages: body.canalMessages || [],
      demandeur_messages: body.demandeurMessages || [],
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mission: data })
}

// PATCH /api/syndic/missions — mettre à jour une mission
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mission: data })
}

// DELETE /api/syndic/missions?id=xxx — supprimer une mission
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('syndic_missions')
    .delete()
    .eq('id', id)
    .eq('cabinet_id', cabinetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
