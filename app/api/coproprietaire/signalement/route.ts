import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// POST /api/coproprietaire/signalement — créer un signalement (public, pas d'auth requise)
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Résoudre le cabinet_id depuis le nom de l'immeuble si possible
    let cabinetId = body.cabinetId || null

    if (!cabinetId && body.immeuble) {
      const { data: immeubles } = await supabaseAdmin
        .from('syndic_immeubles')
        .select('cabinet_id')
        .ilike('nom', body.immeuble)
        .limit(1)
      if (immeubles && immeubles.length > 0) {
        cabinetId = immeubles[0].cabinet_id
      }
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .insert({
        cabinet_id: cabinetId,
        immeuble_nom: body.immeuble || body.immeubleNom || '',
        demandeur_nom: body.demandeurNom || body.nom || '',
        demandeur_role: body.demandeurRole || body.role || 'coproprio',
        demandeur_email: body.demandeurEmail || body.email || null,
        demandeur_telephone: body.demandeurTelephone || body.telephone || null,
        type_intervention: body.typeIntervention || body.type || 'Autre',
        description: body.description || '',
        priorite: body.priorite || 'normale',
        statut: 'en_attente',
        batiment: body.batiment || null,
        etage: body.etage || null,
        num_lot: body.numLot || null,
        est_partie_commune: body.estPartieCommune || false,
        zone_signalee: body.zoneSignalee || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ signalement: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/coproprietaire/signalement?email=xxx — récupérer les signalements d'un demandeur
export async function GET(request: Request) {
  const url = new URL(request.url)
  const email = url.searchParams.get('email')
  const immeuble = url.searchParams.get('immeuble')

  if (!email && !immeuble) {
    return NextResponse.json({ error: 'email ou immeuble requis' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('syndic_signalements')
    .select('*')
    .order('created_at', { ascending: false })

  if (email) query = query.eq('demandeur_email', email)
  if (immeuble) query = query.ilike('immeuble_nom', immeuble)

  const { data, error } = await query

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
  }))

  return NextResponse.json({ signalements })
}
