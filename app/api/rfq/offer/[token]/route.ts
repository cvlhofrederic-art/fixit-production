import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Lazy init — évite le crash au build CI quand les env vars ne sont pas définies
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ── Validation Zod pour la soumission d'offre ──
const offerItemSchema = z.object({
  product_name: z.string().min(1).max(500),
  unit_price: z.number().min(0).max(10_000_000),
  quantity: z.number().min(0.01).max(1_000_000),
  rfq_item_id: z.string().uuid().optional(),
})

const offerSubmitSchema = z.object({
  total_price: z.number().min(0).max(100_000_000),
  delivery_days: z.number().int().min(0).max(3650),
  comment: z.string().max(5000).optional().default(''),
  items: z.array(offerItemSchema).max(200).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    if (!token || token.length < 10) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
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
    if (!token || token.length < 10) return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
    const supabase = getSupabase()

    // Valider les inputs
    const body = await req.json()
    const parsed = offerSubmitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
    }
    const { total_price, delivery_days, comment, items } = parsed.data

    // Atomic : update seulement si status = 'pending' (évite race condition)
    const { data: updated, error: updateError } = await supabase
      .from('offers')
      .update({ total_price, delivery_days, comment, status: 'answered' })
      .eq('token', token)
      .eq('status', 'pending')
      .select('id, rfq_id')
      .single()

    if (updateError || !updated) {
      // Vérifier si l'offre existe ou a déjà été répondue
      const { data: existing } = await supabase.from('offers').select('status').eq('token', token).single()
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ error: 'Already answered' }, { status: 409 })
    }

    // Insérer les items de l'offre
    if (items?.length) {
      const { error: itemsError } = await supabase
        .from('offer_items')
        .insert(items.map((i) => ({
          product_name: i.product_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
          rfq_item_id: i.rfq_item_id,
          offer_id: updated.id,
        })))
      if (itemsError) console.error('[OFFER POST] offer_items insert failed:', itemsError.message)
    }

    // Mettre à jour le statut de la RFQ
    const { error: rfqError } = await supabase
      .from('rfqs')
      .update({ status: 'answered', updated_at: new Date().toISOString() })
      .eq('id', updated.rfq_id)
    if (rfqError) console.error('[OFFER POST] rfq status update failed:', rfqError.message)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[OFFER POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
