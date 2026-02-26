import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

// GET /api/syndic/immeubles — récupérer les immeubles du cabinet
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id

  const { data, error } = await supabaseAdmin
    .from('syndic_immeubles')
    .select('*')
    .eq('cabinet_id', cabinetId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const immeubles = (data || []).map(i => ({
    id: i.id,
    nom: i.nom || '',
    adresse: i.adresse || '',
    ville: i.ville || '',
    codePostal: i.code_postal || '',
    nbLots: i.nb_lots || 1,
    anneeConstruction: i.annee_construction || 2000,
    typeImmeuble: i.type_immeuble || 'Copropriété',
    gestionnaire: i.gestionnaire || '',
    prochainControle: i.prochain_controle || '',
    nbInterventions: i.nb_interventions || 0,
    budgetAnnuel: i.budget_annuel || 0,
    depensesAnnee: i.depenses_annee || 0,
    latitude: i.latitude,
    longitude: i.longitude,
    geolocActivee: i.geoloc_activee || false,
    rayonDetection: i.rayon_detection || 150,
    reglementTexte: i.reglement_texte || '',
    reglementPdfNom: i.reglement_pdf_nom || '',
    reglementDateMaj: i.reglement_date_maj || '',
    reglementChargesRepartition: i.reglement_charges_repartition || '',
    reglementMajoriteAg: i.reglement_majorite_ag || '',
    reglementFondsTravaux: i.reglement_fonds_travaux || false,
    reglementFondsRoulementPct: i.reglement_fonds_roulement_pct || 0,
  }))

  return NextResponse.json({ immeubles })
}

// POST /api/syndic/immeubles — créer un immeuble
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const body = await request.json()

  const { data, error } = await supabaseAdmin
    .from('syndic_immeubles')
    .insert({
      cabinet_id: cabinetId,
      nom: body.nom || '',
      adresse: body.adresse || '',
      ville: body.ville || '',
      code_postal: body.codePostal || '',
      nb_lots: body.nbLots || 1,
      annee_construction: body.anneeConstruction || 2000,
      type_immeuble: body.typeImmeuble || 'Copropriété',
      gestionnaire: body.gestionnaire || '',
      prochain_controle: body.prochainControle || null,
      nb_interventions: body.nbInterventions || 0,
      budget_annuel: body.budgetAnnuel || 0,
      depenses_annee: body.depensesAnnee || 0,
      latitude: body.latitude || null,
      longitude: body.longitude || null,
      geoloc_activee: body.geolocActivee || false,
      rayon_detection: body.rayonDetection || 150,
      reglement_texte: body.reglementTexte || null,
      reglement_pdf_nom: body.reglementPdfNom || null,
      reglement_date_maj: body.reglementDateMaj || null,
      reglement_charges_repartition: body.reglementChargesRepartition || null,
      reglement_majorite_ag: body.reglementMajoriteAg || null,
      reglement_fonds_travaux: body.reglementFondsTravaux || false,
      reglement_fonds_roulement_pct: body.reglementFondsRoulementPct || 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ immeuble: data })
}

// PATCH /api/syndic/immeubles — mettre à jour un immeuble
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
  if (updates.nom !== undefined) dbUpdates.nom = updates.nom
  if (updates.adresse !== undefined) dbUpdates.adresse = updates.adresse
  if (updates.ville !== undefined) dbUpdates.ville = updates.ville
  if (updates.codePostal !== undefined) dbUpdates.code_postal = updates.codePostal
  if (updates.nbLots !== undefined) dbUpdates.nb_lots = updates.nbLots
  if (updates.anneeConstruction !== undefined) dbUpdates.annee_construction = updates.anneeConstruction
  if (updates.typeImmeuble !== undefined) dbUpdates.type_immeuble = updates.typeImmeuble
  if (updates.gestionnaire !== undefined) dbUpdates.gestionnaire = updates.gestionnaire
  if (updates.prochainControle !== undefined) dbUpdates.prochain_controle = updates.prochainControle
  if (updates.nbInterventions !== undefined) dbUpdates.nb_interventions = updates.nbInterventions
  if (updates.budgetAnnuel !== undefined) dbUpdates.budget_annuel = updates.budgetAnnuel
  if (updates.depensesAnnee !== undefined) dbUpdates.depenses_annee = updates.depensesAnnee
  if (updates.latitude !== undefined) dbUpdates.latitude = updates.latitude
  if (updates.longitude !== undefined) dbUpdates.longitude = updates.longitude
  if (updates.geolocActivee !== undefined) dbUpdates.geoloc_activee = updates.geolocActivee
  if (updates.rayonDetection !== undefined) dbUpdates.rayon_detection = updates.rayonDetection
  if (updates.reglementTexte !== undefined) dbUpdates.reglement_texte = updates.reglementTexte
  if (updates.reglementPdfNom !== undefined) dbUpdates.reglement_pdf_nom = updates.reglementPdfNom
  if (updates.reglementDateMaj !== undefined) dbUpdates.reglement_date_maj = updates.reglementDateMaj
  if (updates.reglementChargesRepartition !== undefined) dbUpdates.reglement_charges_repartition = updates.reglementChargesRepartition
  if (updates.reglementMajoriteAg !== undefined) dbUpdates.reglement_majorite_ag = updates.reglementMajoriteAg
  if (updates.reglementFondsTravaux !== undefined) dbUpdates.reglement_fonds_travaux = updates.reglementFondsTravaux
  if (updates.reglementFondsRoulementPct !== undefined) dbUpdates.reglement_fonds_roulement_pct = updates.reglementFondsRoulementPct

  const { data, error } = await supabaseAdmin
    .from('syndic_immeubles')
    .update(dbUpdates)
    .eq('id', id)
    .eq('cabinet_id', cabinetId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ immeuble: data })
}

// DELETE /api/syndic/immeubles — supprimer un immeuble
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = user.user_metadata?.cabinet_id || user.id
  const url = new URL(request.url)
  const id = url.searchParams.get('id')

  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('syndic_immeubles')
    .delete()
    .eq('id', id)
    .eq('cabinet_id', cabinetId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
