import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-server'
import {
  getPeriodeActuelle,
  calculerCotisations,
  getCAFactures,
  getCABookings,
  type PeriodeDeclaration,
  type ResultatCotisations,
} from '@/lib/declaration-sociale'

export const maxDuration = 15

// GET — Charger les données de déclaration
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, country, type_activite, periodicite_declaration, acre_actif, acre_date_fin, declaration_configuree')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const pays = (artisan.country || 'FR') as 'FR' | 'PT'
    const typeActivite = artisan.type_activite || (pays === 'FR' ? 'bic_services' : 'prestadores_servicos')
    const periodicite = (artisan.periodicite_declaration || 'trimestrielle') as 'mensuelle' | 'trimestrielle'

    // Vérifier si ACRE encore actif
    let acreActif = artisan.acre_actif || false
    if (acreActif && artisan.acre_date_fin) {
      acreActif = new Date(artisan.acre_date_fin) > new Date()
    }

    // Période actuelle
    const periode = getPeriodeActuelle(pays, periodicite)

    // CA de la période (factures > bookings fallback)
    let caResult = await getCAFactures(artisan.id, periode.date_debut, periode.date_fin, pays)
    let source_ca: 'factures' | 'bookings' = 'factures'

    if (caResult.nb_factures === 0) {
      const bkResult = await getCABookings(artisan.id, periode.date_debut, periode.date_fin)
      caResult = { montant: bkResult.montant, nb_factures: bkResult.nb_bookings }
      source_ca = 'bookings'
    }

    // Calcul cotisations
    const cotisations = calculerCotisations(caResult.montant, pays, typeActivite, {
      acre_actif: acreActif,
      periode_type: periode.periode_type,
    })

    // Historique (5 dernières)
    const { data: historique } = await supabaseAdmin
      .from('declarations_sociales')
      .select('*')
      .eq('artisan_id', artisan.id)
      .order('date_fin', { ascending: false })
      .limit(5)

    return NextResponse.json({
      configure: artisan.declaration_configuree || false,
      pays,
      type_activite: typeActivite,
      periodicite,
      acre_actif: acreActif,
      periode,
      ca: caResult,
      source_ca,
      cotisations,
      historique: historique || [],
    })
  } catch (err) {
    console.error('[declaration-sociale] GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Configurer le profil ou marquer comme déclaré
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll() } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id, country')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!artisan) return NextResponse.json({ error: 'Artisan introuvable' }, { status: 404 })

    const body = await request.json()

    // Action: configurer le profil fiscal
    if (body.action === 'configurer') {
      await supabaseAdmin
        .from('profiles_artisan')
        .update({
          type_activite: body.type_activite,
          periodicite_declaration: body.periodicite || 'trimestrielle',
          acre_actif: body.acre_actif || false,
          acre_date_fin: body.acre_date_fin || null,
          declaration_configuree: true,
        })
        .eq('id', artisan.id)

      return NextResponse.json({ success: true })
    }

    // Action: marquer comme déclaré
    if (body.action === 'marquer_declaree') {
      const pays = (artisan.country || 'FR') as 'FR' | 'PT'
      const { periode_label, date_debut, date_fin, ca_periode, taux_applique, cotisations_estimees, date_limite } = body

      // Upsert la déclaration
      const { data: existing } = await supabaseAdmin
        .from('declarations_sociales')
        .select('id')
        .eq('artisan_id', artisan.id)
        .eq('periode_label', periode_label)
        .maybeSingle()

      if (existing) {
        await supabaseAdmin
          .from('declarations_sociales')
          .update({
            statut: 'declare',
            date_declaration_effectuee: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await supabaseAdmin
          .from('declarations_sociales')
          .insert({
            artisan_id: artisan.id,
            pays,
            periode_label,
            date_debut,
            date_fin,
            ca_periode,
            taux_applique,
            cotisations_estimees,
            date_limite_declaration: date_limite,
            statut: 'declare',
            date_declaration_effectuee: new Date().toISOString(),
          })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
  } catch (err) {
    console.error('[declaration-sociale] POST error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
