import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { user_id, slugs, verified_source = 'self_declared' } = body ?? {}

  if (!user_id || !Array.isArray(slugs) || slugs.length === 0) {
    return NextResponse.json(
      { error: 'user_id and slugs (non-empty array) are required' },
      { status: 400 },
    )
  }

  // Resolve slugs → specialty UUIDs
  const { data: specialties, error: fetchError } = await supabaseAdmin
    .from('specialties')
    .select('id, slug')
    .in('slug', slugs)

  if (fetchError) {
    console.error('[profile/specialties/POST] fetch error:', fetchError)
    return NextResponse.json({ error: 'Failed to resolve specialties' }, { status: 500 })
  }

  if (!specialties?.length) {
    return NextResponse.json(
      { error: 'No matching specialties found for provided slugs' },
      { status: 400 },
    )
  }

  const rows = specialties.map((s) => ({
    user_id,
    specialty_id: s.id,
    verified_source,
  }))

  const { error: upsertError } = await supabaseAdmin
    .from('profile_specialties')
    .upsert(rows, { onConflict: 'user_id,specialty_id' })

  if (upsertError) {
    console.error('[profile/specialties/POST] upsert error:', upsertError)
    return NextResponse.json({ error: 'Failed to save specialties' }, { status: 500 })
  }

  return NextResponse.json({ success: true, saved: specialties.length })
}
