import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'

const specialtiesBodySchema = z.object({
  user_id: z.string().uuid(),
  slugs: z.array(z.string().min(1)).min(1),
  verified_source: z.string().optional().default('self_declared'),
})

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = specialtiesBodySchema.safeParse(rawBody)
  if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

  const { user_id, slugs, verified_source } = parsed.data

  // F01: vérifier que l'utilisateur ne modifie que son propre profil
  if (user.id !== user_id) return NextResponse.json({ error: 'Accès interdit' }, { status: 403 })

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
