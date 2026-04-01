import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const appliesTo = searchParams.get('applies_to') // 'artisan' | 'societe_btp' | null

  let query = supabaseAdmin
    .from('specialties')
    .select('id, slug, label_fr, label_pt, code_ape, applies_to, sort_order')
    .order('sort_order', { ascending: true })

  if (appliesTo === 'artisan') {
    query = query.in('applies_to', ['artisan', 'both'])
  } else if (appliesTo === 'societe_btp') {
    query = query.in('applies_to', ['societe_btp', 'both'])
  }

  const { data, error } = await query
  if (error) {
    console.error('[specialties/GET]', error)
    return NextResponse.json({ error: 'Failed to load specialties' }, { status: 500 })
  }

  return NextResponse.json(
    { specialties: data ?? [] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  )
}
