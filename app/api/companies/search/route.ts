import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

// Seules colonnes lues puis renvoyées au client : la réponse est publique, sans authentification, et mise en cache.
// Toutes existent en production (tests/helpers/colonnes-profiles-artisan.ts) : une colonne absente d'un select
// explicite fait échouer toute la requête (500 « Search failed » jusqu'en novembre 2026, à cause de first_name et
// last_name). Ni e-mail, ni téléphone, ni identité du gérant, ni statut KYC : décision de Frédéric du 28/11/2026.
const CHAMPS_PUBLICS = [
  'id', 'user_id', 'company_name', 'company_city', 'naf_code', 'naf_label', 'verified', 'categories',
] as const

/** Nombre de résultats : 20 par défaut, entre 1 et 50 ; une valeur invalide ne fait pas échouer la requête. */
function lireLimite(valeur: string | null): number {
  const n = Number.parseInt(valeur ?? '', 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 20
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const specialty = searchParams.get('specialty')
  const verifiedSource = searchParams.get('verified_source')
  const city = searchParams.get('city')
  const limit = lireLimite(searchParams.get('limit'))

  if (!specialty) {
    return NextResponse.json({ error: 'specialty parameter is required' }, { status: 400 })
  }

  // 1. Resolve specialty slug → id + label
  const { data: spec, error: specError } = await supabaseAdmin
    .from('specialties')
    .select('id, label_fr')
    .eq('slug', specialty)
    .single()

  if (specError || !spec) {
    return NextResponse.json({ error: `Unknown specialty: ${specialty}` }, { status: 404 })
  }

  // 2. Find user_ids with this specialty
  let pivotQuery = supabaseAdmin
    .from('profile_specialties')
    .select('user_id, verified_source')
    .eq('specialty_id', spec.id)

  if (verifiedSource) {
    pivotQuery = pivotQuery.eq('verified_source', verifiedSource)
  }

  const { data: pivotRows, error: pivotError } = await pivotQuery

  if (pivotError) {
    console.error('[companies/search/GET] pivot error:', pivotError)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  if (!pivotRows?.length) {
    return NextResponse.json(
      { results: [], specialty: spec.label_fr, total: 0 },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
    )
  }

  const userIds = pivotRows.map(r => r.user_id)
  const verifiedSourceMap: Record<string, string> = Object.fromEntries(
    pivotRows.map(r => [r.user_id, r.verified_source])
  )

  // 3. Fetch approved artisan profiles (colonnes publiques seulement : jamais select('*') sur une route publique)
  let artisanQuery = supabaseAdmin
    .from('profiles_artisan')
    .select(CHAMPS_PUBLICS.join(', '))
    .in('user_id', userIds)
    .eq('kyc_status', 'approved')
    // Fiches actives seulement, comme la recherche publique (app/fr/recherche) et /api/artisans/nearby :
    // la lecture en service role ignore la politique de lecture publique (active = true, migration 041).
    .eq('active', true)

  if (city) {
    artisanQuery = artisanQuery.ilike('company_city', `%${city}%`)
  }

  const { data: artisans, error: artisanError } = await artisanQuery.limit(limit)

  if (artisanError) {
    console.error('[companies/search/GET] artisan error:', artisanError)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  // Même liste blanche à la sortie : rien d'autre ne part vers le client. La liste de colonnes n'étant pas une
  // chaîne littérale, supabase-js ne type pas les lignes : on les lit comme des enregistrements génériques.
  const lignes = (artisans ?? []) as unknown as Array<Record<string, unknown>>
  const results = lignes.map(a => ({
    ...Object.fromEntries(CHAMPS_PUBLICS.map(c => [c, a[c] ?? null])),
    verified_source: verifiedSourceMap[String(a.user_id)] ?? 'self_declared',
    profile_type: 'artisan' as const,
  }))

  return NextResponse.json(
    { results, specialty: spec.label_fr, total: results.length },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
  )
}
