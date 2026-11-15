import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { CreateRFQPayload } from '@/lib/rfq-types'
import { sendRFQToSuppliers } from '@/lib/email-rfq'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { isProSocieteRole } from '@/lib/auth-helpers'

// Ce qui est saisi ici part par e-mail, depuis l'adresse d'envoi de la plateforme, à chaque fournisseur actif du
// pays (lib/email-rfq.ts) : chaque champ a une longueur maximale, et une demande porte 100 lignes au plus.
const rfqItemSchema = z.object({
  product_name: z.string().min(1).max(200),
  product_ref: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(30),
  notes: z.string().max(500).optional(),
})

const rfqBodySchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().max(2000).optional(),
  country: z.enum(['FR', 'PT']),
  items: z.array(rfqItemSchema).min(1).max(100),
})

// Plafonds par compte (et non par adresse Internet) : une demande fait partir un e-mail par fournisseur.
const DEMANDES_MAX_PAR_MINUTE = 5
const DEMANDES_MAX_PAR_JOUR = 20
const JOUR_MS = 24 * 60 * 60 * 1000

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

    // Module proposé aux seules sociétés (rfq_btp, app/(commun)/pro/dashboard/page.tsx) : le serveur applique la
    // même règle. Rôle lu dans app_metadata, que le compte ne peut pas modifier lui-même.
    if (!isProSocieteRole(user)) {
      return NextResponse.json({ error: 'Les demandes de prix aux fournisseurs sont réservées aux sociétés.' }, { status: 403 })
    }
    if (!(await checkRateLimit(`rfq_post_${user.id}`, DEMANDES_MAX_PAR_MINUTE, 60_000))) return rateLimitResponse()

    const supabase = getSupabase()
    const rawBody = await req.json()
    const parsed = rfqBodySchema.safeParse(rawBody)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    // Compté après la validation : une demande refusée ne consomme pas le plafond ; avant toute écriture.
    if (!(await checkRateLimit(`rfq_post_jour_${user.id}`, DEMANDES_MAX_PAR_JOUR, JOUR_MS))) {
      logger.warn('[RFQ POST] plafond des 24 heures atteint', { compte: user.id })
      return NextResponse.json(
        { error: `Limite de ${DEMANDES_MAX_PAR_JOUR} demandes par 24 heures atteinte. Réessayez demain.` },
        { status: 429 },
      )
    }

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
