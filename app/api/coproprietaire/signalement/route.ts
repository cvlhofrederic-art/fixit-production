import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// POST /api/coproprietaire/signalement — créer un signalement
// Rate-limité pour éviter le spam (pas d'auth car copropriétaires non-inscrits)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting strict
    const ip = getClientIP(request)
    if (!checkRateLimit(`copro_signalement_post_${ip}`, 5, 60_000)) return rateLimitResponse()

    const body = await request.json()

    // Validation des champs obligatoires
    const description = (body.description || '').trim()
    const demandeurNom = (body.demandeurNom || body.nom || '').trim()
    const immeuble = (body.immeuble || body.immeubleNom || '').trim()

    if (!description || description.length < 10) {
      return NextResponse.json({ error: 'Description requise (minimum 10 caractères)' }, { status: 400 })
    }
    if (!demandeurNom || demandeurNom.length < 2) {
      return NextResponse.json({ error: 'Nom du demandeur requis' }, { status: 400 })
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: 'Description trop longue (max 5000 caractères)' }, { status: 400 })
    }

    // Résoudre le cabinet_id depuis le nom de l'immeuble si possible
    let cabinetId = body.cabinetId || null

    if (!cabinetId && immeuble) {
      const { data: immeubles } = await supabaseAdmin
        .from('syndic_immeubles')
        .select('cabinet_id')
        .ilike('nom', immeuble)
        .limit(1)
      if (immeubles && immeubles.length > 0) {
        cabinetId = immeubles[0].cabinet_id
      }
    }

    const demandeurRole = body.demandeurRole || body.role || 'coproprio'
    if (!['coproprio', 'locataire', 'technicien'].includes(demandeurRole)) {
      return NextResponse.json({ error: 'Rôle demandeur invalide' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('syndic_signalements')
      .insert({
        cabinet_id: cabinetId,
        immeuble_nom: immeuble,
        demandeur_nom: demandeurNom.substring(0, 200),
        demandeur_role: demandeurRole,
        demandeur_email: (body.demandeurEmail || body.email || '').substring(0, 200) || null,
        demandeur_telephone: (body.demandeurTelephone || body.telephone || '').substring(0, 20) || null,
        type_intervention: (body.typeIntervention || body.type || 'Autre').substring(0, 100),
        description: description.substring(0, 5000),
        priorite: ['urgente', 'normale', 'planifiee'].includes(body.priorite) ? body.priorite : 'normale',
        statut: 'en_attente',
        batiment: (body.batiment || '').substring(0, 100) || null,
        etage: (body.etage || '').substring(0, 20) || null,
        num_lot: (body.numLot || '').substring(0, 20) || null,
        est_partie_commune: body.estPartieCommune || false,
        zone_signalee: (body.zoneSignalee || '').substring(0, 200) || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ signalement: data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// GET /api/coproprietaire/signalement — récupérer ses signalements
// Requiert email exact (pas de wildcard) + rate limiting
export async function GET(request: NextRequest) {
  const ip = getClientIP(request as any)
  if (!checkRateLimit(`copro_signalement_get_${ip}`, 15, 60_000)) return rateLimitResponse()

  const url = new URL(request.url)
  const email = (url.searchParams.get('email') || '').trim().toLowerCase()
  const immeuble = url.searchParams.get('immeuble')

  if (!email && !immeuble) {
    return NextResponse.json({ error: 'email ou immeuble requis' }, { status: 400 })
  }

  // Validation email basique pour éviter l'énumération
  if (email && (!email.includes('@') || email.length < 5)) {
    return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
  }

  // Stricter per-email rate limit to prevent email enumeration attacks
  // Max 5 unique email lookups per IP per minute
  if (email && !checkRateLimit(`copro_signalement_email_${ip}`, 5, 60_000)) {
    return rateLimitResponse()
  }

  let query = supabaseAdmin
    .from('syndic_signalements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  // Recherche exacte (pas de ilike) pour éviter l'énumération
  if (email) query = query.eq('demandeur_email', email)
  if (immeuble) query = query.eq('immeuble_nom', immeuble)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const signalements = (data || []).map(s => ({
    id: s.id,
    immeuble: s.immeuble_nom || '',
    demandeurNom: s.demandeur_nom || '',
    demandeurRole: s.demandeur_role || '',
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
