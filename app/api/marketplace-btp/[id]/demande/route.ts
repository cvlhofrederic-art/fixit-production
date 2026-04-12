/**
 * POST   /api/marketplace-btp/[id]/demande  — créer une demande (acheteur)
 * GET    /api/marketplace-btp/[id]/demande  — lister demandes (vendeur ou acheteur)
 * PATCH  /api/marketplace-btp/[id]/demande  — accepter/rejeter (vendeur)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { VALID_UUID } from '@/lib/validation'
import { logger } from '@/lib/logger'

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}
function getAnon() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

async function auth(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user }, error } = await getAnon().auth.getUser(token)
  return error || !user ? null : user
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`mpl_dem_${ip}`, 20, 60_000))) return rateLimitResponse()

    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    const user = await auth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await getAdmin()
      .from('marketplace_demandes')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    // Filtrer : vendeur voit toutes, acheteur voit les siennes
    const listing = await getAdmin().from('marketplace_listings').select('user_id').eq('id', id).single()
    const isOwner = listing.data?.user_id === user.id
    const demandes = isOwner ? data : data?.filter(d => d.buyer_user_id === user.id)

    return NextResponse.json({ demandes: demandes ?? [] })
  } catch (e) {
    logger.error('[MPL DEMANDE GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    const user = await auth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { type_demande, date_debut, date_fin, prix_propose } = body
    const message = typeof body.message === 'string' ? body.message.slice(0, 2000) : ''
    if (!type_demande || !['achat', 'location'].includes(type_demande)) return NextResponse.json({ error: 'type_demande requis (achat ou location)' }, { status: 400 })
    if (prix_propose !== undefined && (typeof prix_propose !== 'number' || prix_propose < 0)) return NextResponse.json({ error: 'prix_propose invalide' }, { status: 400 })

    // Vérifier que l'acheteur n'est pas le vendeur
    const { data: listing } = await getAdmin()
      .from('marketplace_listings').select('user_id, title, vendeur_nom').eq('id', id).single()
    if (!listing) return NextResponse.json({ error: 'Annonce introuvable' }, { status: 404 })
    if (listing.user_id === user.id) return NextResponse.json({ error: 'Vous ne pouvez pas contacter votre propre annonce' }, { status: 400 })

    const { data: demande, error } = await getAdmin()
      .from('marketplace_demandes')
      .insert({ listing_id: id, buyer_user_id: user.id, type_demande, date_debut, date_fin, message, prix_propose })
      .select()
      .single()

    if (error) throw error

    // Notifier le vendeur
    await getAdmin().from('artisan_notifications').insert({
      artisan_id: listing.user_id,
      type: 'marketplace_demande',
      title: type_demande === 'achat'
        ? `💰 Demande d'achat — ${listing.title}`
        : `📅 Demande de location — ${listing.title}`,
      body: message || (type_demande === 'achat' ? 'Un acheteur est intéressé par votre annonce.' : 'Un professionnel souhaite louer votre matériel.'),
      read: false,
      data_json: JSON.stringify({ listing_id: id, demande_id: demande.id }),
    }).then(() => {})

    return NextResponse.json({ demande }, { status: 201 })
  } catch (e) {
    logger.error('[MPL DEMANDE POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    if (!VALID_UUID.test(id)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    const user = await auth(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { demande_id, status, reponse_vendeur } = await req.json()
    if (!demande_id || !status) return NextResponse.json({ error: 'demande_id et status requis' }, { status: 400 })

    const validStatuses = ['pending', 'accepted', 'rejected', 'cancelled']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
    }

    // Vérifier que c'est bien le vendeur
    const { data: listing } = await getAdmin()
      .from('marketplace_listings').select('user_id').eq('id', id).single()
    if (!listing || listing.user_id !== user.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

    const { data, error } = await getAdmin()
      .from('marketplace_demandes')
      .update({ status, reponse_vendeur })
      .eq('id', demande_id)
      .eq('listing_id', id)
      .select()
      .single()

    if (error) throw error

    // Notifier l'acheteur
    if (data) {
      await getAdmin().from('artisan_notifications').insert({
        artisan_id: data.buyer_user_id,
        type: status === 'accepted' ? 'marketplace_accepte' : 'marketplace_refuse',
        title: status === 'accepted' ? '✅ Demande acceptée' : '❌ Demande refusée',
        body: reponse_vendeur || (status === 'accepted' ? 'Le vendeur a accepté votre demande.' : 'Le vendeur a refusé votre demande.'),
        read: false,
        data_json: JSON.stringify({ listing_id: id, demande_id }),
      }).then(() => {})
    }

    return NextResponse.json({ demande: data })
  } catch (e) {
    logger.error('[MPL DEMANDE PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
