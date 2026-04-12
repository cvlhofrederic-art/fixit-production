/**
 * GET    /api/marketplace-btp/[id] — détail annonce + incrément vues
 * PUT    /api/marketplace-btp/[id] — modifier annonce (owner)
 * DELETE /api/marketplace-btp/[id] — soft delete (owner)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { VALID_UUID } from '@/lib/validation'

const marketplaceUpdateSchema = z.object({
  title: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  categorie: z.string().max(100).optional(),
  type_annonce: z.enum(['vente', 'location']).optional(),
  etat: z.string().max(50).optional(),
  prix_vente: z.number().nonnegative().optional(),
  prix_location_jour: z.number().nonnegative().optional(),
  prix_location_semaine: z.number().nonnegative().optional(),
  prix_location_mois: z.number().nonnegative().optional(),
  disponible_de: z.string().max(50).optional(),
  disponible_jusqu: z.string().max(50).optional(),
  localisation: z.string().max(200).optional(),
  country: z.string().max(5).optional(),
  marque: z.string().max(100).optional(),
  modele: z.string().max(100).optional(),
  annee: z.number().int().min(1900).max(2100).optional(),
  caracteristiques: z.string().max(2000).optional(),
  vendeur_nom: z.string().max(200).optional(),
  vendeur_phone: z.string().max(30).optional(),
  status: z.enum(['active', 'vendu', 'suspendu', 'archive']).optional(),
}).strict()

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}
function getAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`mpl_${ip}`, 30, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    const supabase = getAdmin()

    // Vérifier si l'appelant est authentifié (pour inclure ses demandes)
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    let userId: string | null = null
    if (token) {
      const { data: { user } } = await getAnon().auth.getUser(token)
      userId = user?.id || null
    }

    // Listing public sans demandes par défaut
    const { data, error } = await supabase
      .from('marketplace_listings')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Inclure les demandes UNIQUEMENT si l'appelant est le propriétaire
    let demandes = null
    if (userId && data.user_id === userId) {
      const { data: d } = await supabase
        .from('marketplace_demandes')
        .select('id, type_demande, status, created_at')
        .eq('listing_id', id)
      demandes = d
    }

    // Incrémenter vues atomiquement via RPC (évite race condition read-modify-write)
    void supabase.rpc('increment_listing_vues', { listing_id: id }).then(() => {})

    return NextResponse.json({ listing: { ...data, marketplace_demandes: demandes } })
  } catch (e) {
    logger.error('[MPL GET ID]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const raw = await req.json()
    const parsed = marketplaceUpdateSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })
    }
    const body: Record<string, unknown> = { ...parsed.data }
    const AE_CATS = ['mini_engins', 'materiel_leger']
    if (body.categorie && typeof body.categorie === 'string') body.accessible_ae = AE_CATS.includes(body.categorie)

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
    logger.error('[MPL PUT]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
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
    logger.error('[MPL DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
