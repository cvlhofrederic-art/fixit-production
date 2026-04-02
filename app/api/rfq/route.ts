import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { CreateRFQPayload } from '@/lib/rfq-types'
import { sendRFQToSuppliers } from '@/lib/email-rfq'

const rfqItemSchema = z.object({
  product_name: z.string().min(1),
  product_ref: z.string().optional(),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  notes: z.string().optional(),
})

const rfqBodySchema = z.object({
  title: z.string().min(1),
  message: z.string().optional(),
  country: z.enum(['FR', 'PT']),
  items: z.array(rfqItemSchema).min(1),
})

// Lazy init — évite le crash au build CI quand SUPABASE_SERVICE_ROLE_KEY n'est pas défini
function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getSupabaseAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAnon().auth.getUser(token)

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const { data: rfqs, error } = await supabase
      .from('rfqs')
      .select('*, rfq_items(*), offers(id, supplier_name, total_price, delivery_days, status, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ rfqs })
  } catch (e) {
    console.error('[RFQ GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAnon().auth.getUser(token)

    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getSupabase()
    const rawBody = await req.json()
    const parsed = rfqBodySchema.safeParse(rawBody)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const { title, message, country, items } = parsed.data

    const { data: rfq, error: rfqError } = await supabase
      .from('rfqs')
      .insert({ user_id: user.id, title, message, country, status: 'pending' })
      .select()
      .single()

    if (rfqError || !rfq) throw rfqError

    const { data: rfqItems, error: itemsError } = await supabase
      .from('rfq_items')
      .insert(items.map(i => ({ ...i, rfq_id: rfq.id })))
      .select()

    if (itemsError) throw itemsError

    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('*')
      .eq('country', country)
      .eq('active', true)

    if (suppliers?.length) {
      const offerInserts = suppliers.map(s => ({
        rfq_id: rfq.id,
        supplier_id: s.id,
        supplier_name: s.name,
        supplier_email: s.email,
        status: 'pending' as const,
      }))

      const { data: createdOffers, error: offersError } = await supabase
        .from('offers')
        .insert(offerInserts)
        .select()

      if (!offersError && createdOffers) {
        const suppliersWithTokens = createdOffers.map(o => ({
          id: o.supplier_id,
          name: o.supplier_name,
          email: o.supplier_email,
          token: o.token,
        }))
        await sendRFQToSuppliers(rfq, rfqItems || [], suppliersWithTokens)
      }
    }

    return NextResponse.json({ rfq, itemCount: rfqItems?.length ?? 0 }, { status: 201 })
  } catch (e) {
    console.error('[RFQ POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
