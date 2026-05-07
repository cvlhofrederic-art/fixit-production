import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import type { CreateRFQPayload } from '@/lib/rfq-types'
import { sendRFQToSuppliers } from '@/lib/email-rfq'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { authenticateRequest, getAuthedClient, getBearerToken } from '@/lib/supabase-clients'

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

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`rfq_${ip}`, 15, 60_000))) return rateLimitResponse()

    const token = getBearerToken(req)
    const user = await authenticateRequest(req)
    if (!user || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getAuthedClient(token)
    const { data: rfqs, error } = await supabase
      .from('rfqs')
      .select('*, rfq_items(*), offers(id, supplier_name, total_price, delivery_days, status, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ rfqs })
  } catch (e) {
    logger.error('[RFQ GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req)
    const user = await authenticateRequest(req)
    if (!user || !token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = getAuthedClient(token)
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
    logger.error('[RFQ POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
