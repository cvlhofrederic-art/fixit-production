import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const specialty = searchParams.get('specialty')
  const verifiedSource = searchParams.get('verified_source')
  const city = searchParams.get('city')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

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

  // 3. Fetch approved artisan profiles
  let artisanQuery = supabaseAdmin
    .from('profiles_artisan')
    .select('id, user_id, company_name, first_name, last_name, email, phone, company_city, naf_code, naf_label, verified, kyc_status, categories')
    .in('user_id', userIds)
    .eq('kyc_status', 'approved')

  if (city) {
    artisanQuery = artisanQuery.ilike('company_city', `%${city}%`)
  }

  const { data: artisans, error: artisanError } = await artisanQuery.limit(limit)

  if (artisanError) {
    console.error('[companies/search/GET] artisan error:', artisanError)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  const results = (artisans ?? []).map(a => ({
    ...a,
    verified_source: verifiedSourceMap[a.user_id] ?? 'self_declared',
    profile_type: 'artisan' as const,
  }))

  return NextResponse.json(
    { results, specialty: spec.label_fr, total: results.length },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } }
  )
}
