/**
 * GET  /api/tva/settings — Récupère les paramètres TVA de l'artisan
 * PATCH /api/tva/settings — Met à jour tva_auto_activate
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy init — évite le crash au build CI
function getSupabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getSupabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function authenticate(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await getSupabaseAnon().auth.getUser(token)
  if (error || !user) return null
  return user
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await getSupabaseAdmin()
      .from('profiles_artisan')
      .select('tva_auto_activate, tva_notified_level')
      .eq('user_id', user.id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (e) {
    console.error('[TVA SETTINGS GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await authenticate(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { tva_auto_activate } = await req.json()
    if (typeof tva_auto_activate !== 'boolean') {
      return NextResponse.json({ error: 'tva_auto_activate must be boolean' }, { status: 400 })
    }

    const { error } = await getSupabaseAdmin()
      .from('profiles_artisan')
      .update({ tva_auto_activate })
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true, tva_auto_activate })
  } catch (e) {
    console.error('[TVA SETTINGS PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
