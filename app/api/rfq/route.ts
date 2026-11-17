import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { CreateRFQPayload } from '@/lib/rfq-types'
import { sendRFQToSuppliers } from '@/lib/email-rfq'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}
function getSupabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`rfq_${ip}`, 15, 60_000))) return rateLimitResponse()

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
    logger.error('[RFQ GET]', e)
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
    logger.error('[RFQ POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

const decisionOffreSchema = z.object({
  offer_id: z.string().uuid(),
  status: z.enum(['accepted', 'rejected']),
})

// PATCH /api/rfq — la société accepte ou refuse l'offre d'un fournisseur. La table des offres n'accorde que la lecture
// au compte (supabase/migrations/025_rfq_btp.sql) : la décision passe donc par le serveur, qui vérifie d'abord que la
// demande de prix est bien celle du compte appelant.
export async function PATCH(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`rfq_decision_${ip}`, 30, 60_000))) return rateLimitResponse()

    const authHeader = req.headers.get('authorization')
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await getSupabaseAnon().auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Corps lu à part, comme /api/doc-number : un corps qui n'est pas du JSON est une demande invalide (400), pas une
    // erreur du serveur à journaliser.
    let corps: unknown
    try {
      corps = await req.json()
    } catch {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    }
    const parsed = decisionOffreSchema.safeParse(corps)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 })
    const { offer_id, status } = parsed.data

    const supabase = getSupabase()
    const { data: offre, error: offreError } = await supabase
      .from('offers')
      .select('id, rfq_id, status, total_price')
      .eq('id', offer_id)
      .maybeSingle()
    if (offreError) throw offreError
    if (!offre) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })

    const { data: demande, error: demandeError } = await supabase
      .from('rfqs')
      .select('id, status')
      .eq('id', offre.rfq_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (demandeError) throw demandeError
    if (!demande) return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })

    // Seule une offre répondue (prix reçu), encore en attente, sur une demande non close, se décide.
    if (offre.status !== 'pending' || offre.total_price == null || demande.status === 'closed') {
      return NextResponse.json({ error: 'Cette offre ne peut plus être acceptée ni refusée' }, { status: 409 })
    }

    const { error: decisionError } = await supabase.from('offers').update({ status }).eq('id', offer_id)
    if (decisionError) throw decisionError

    if (status === 'accepted') {
      // Comme le faisait l'écran : les autres offres de la demande sont refusées et la demande est close.
      const { error: autresError } = await supabase
        .from('offers')
        .update({ status: 'rejected' })
        .eq('rfq_id', offre.rfq_id)
        .neq('id', offer_id)
      if (autresError) throw autresError
      const { error: clotureError } = await supabase
        .from('rfqs')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', offre.rfq_id)
      if (clotureError) throw clotureError
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    logger.error('[RFQ PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
