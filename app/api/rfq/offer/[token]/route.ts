import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Lazy init — évite le crash au build CI quand les env vars ne sont pas définies
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const supabase = getSupabase()

    const { data: offer, error } = await supabase
      .from('offers')
      .select('*, rfqs(id, title, message, country, rfq_items(*))')
      .eq('token', token)
      .single()

    if (error || !offer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    return NextResponse.json({ offer })
  } catch (e) {
    console.error('[OFFER GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const supabase = getSupabase()
    const { total_price, delivery_days, comment, items } = await req.json()

    const { data: offer, error: offerError } = await supabase
      .from('offers')
      .select('id, rfq_id, status')
      .eq('token', token)
      .single()

    if (offerError || !offer) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (offer.status !== 'pending') return NextResponse.json({ error: 'Already answered' }, { status: 409 })

    const { error: updateError } = await supabase
      .from('offers')
      .update({ total_price, delivery_days, comment, status: 'pending' })
      .eq('token', token)

    if (updateError) throw updateError

    if (items?.length) {
      await supabase
        .from('offer_items')
        .insert(items.map((i: { product_name: string; unit_price: number; quantity: number; rfq_item_id?: string }) => ({
          ...i,
          offer_id: offer.id,
        })))
    }

    await supabase
      .from('rfqs')
      .update({ status: 'answered', updated_at: new Date().toISOString() })
      .eq('id', offer.rfq_id)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[OFFER POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
