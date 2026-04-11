/**
 * GET    /api/marketplace-btp/[id] — détail annonce + incrément vues
 * PUT    /api/marketplace-btp/[id] — modifier annonce (owner)
 * DELETE /api/marketplace-btp/[id] — soft delete (owner)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

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
    const { id } = await params
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
    supabase.rpc('increment_listing_vues', { listing_id: id }).then(() => {}).catch(() => {})

    return NextResponse.json({ listing: { ...data, marketplace_demandes: demandes } })
  } catch (e) {
    logger.error('[MPL GET ID]', e)
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

    const raw = await req.json()
    // Aligné sur les colonnes réelles du schema POST (listingBodySchema)
    const ALLOWED_FIELDS = [
      'title', 'description', 'categorie', 'type_annonce', 'etat',
      'prix_vente', 'prix_location_jour', 'prix_location_semaine', 'prix_location_mois',
      'disponible_de', 'disponible_jusqu', 'localisation', 'country',
      'marque', 'modele', 'annee', 'caracteristiques',
      'vendeur_nom', 'vendeur_phone', 'status',
    ] as const
    const body: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in raw) body[key] = raw[key]
    }
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
