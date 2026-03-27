/**
 * GET    /api/marketplace-btp/[id] — détail annonce + incrément vues
 * PUT    /api/marketplace-btp/[id] — modifier annonce (owner)
 * DELETE /api/marketplace-btp/[id] — soft delete (owner)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = getAdmin()

    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*, marketplace_demandes(id, type_demande, status, created_at)')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Incrémenter vues (fire & forget)
    supabase.from('marketplace_listings').update({ vues: (data.vues || 0) + 1 }).eq('id', id).then(() => {})

    return NextResponse.json({ listing: data })
  } catch (e) {
    console.error('[MPL GET ID]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const AE_CATS = ['mini_engins', 'materiel_leger']
    if (body.categorie) body.accessible_ae = AE_CATS.includes(body.categorie)

    const { data, error } = await getAdmin()
      .from('marketplace_listings')
      .update(body)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Not found or not owner' }, { status: 404 })
    return NextResponse.json({ listing: data })
  } catch (e) {
    console.error('[MPL PUT]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { error } = await getAdmin()
      .from('marketplace_listings')
      .update({ status: 'deleted' })
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[MPL DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
