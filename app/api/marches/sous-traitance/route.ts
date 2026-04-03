import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createSousTraitanceOffreSchema, validateBody } from '@/lib/validation'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { haversineDistance } from '@/lib/geo'
import crypto from 'crypto'

// ── Geocoding helper (shared with main marches route) ────────────────────────
async function geocodeLocation(city: string, postal?: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = postal ? `${postal} ${city}` : city
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`,
      { signal: AbortSignal.timeout(3000) }
    )
    if (res.ok) {
      const data = await res.json()
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates
        return { lat, lng }
      }
    }
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'Fixit/1.0' } }
    )
    if (nomRes.ok) {
      const nomData = await nomRes.json()
      if (nomData.length > 0) return { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) }
    }
    return null
  } catch {
    return null
  }
}

// ── GET /api/marches/sous-traitance ──────────────────────────────────────────
// Deux modes :
//   ?btp_company_id=xxx  → offres publiées par cette entreprise (avec nb candidatures)
//   ?mode=browse         → toutes les offres ouvertes (pour artisans)
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`st_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const url = new URL(request.url)
  const btpCompanyId = url.searchParams.get('btp_company_id')
  const mode = url.searchParams.get('mode')
  const category = url.searchParams.get('category')
  const city = url.searchParams.get('city')
  const artisanUserId = url.searchParams.get('artisan_user_id')
  const offerId = url.searchParams.get('offer_id')

  // ── Mode: candidatures for one offer (BTP company view) ──────────────────
  if (offerId && btpCompanyId) {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: offer } = await supabaseAdmin
      .from('marches')
      .select('id, publisher_user_id')
      .eq('id', offerId)
      .eq('source_type', 'btp_sous_traitance')
      .single()

    if (!offer || offer.publisher_user_id !== user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    const { data: candidatures, error } = await supabaseAdmin
      .from('marches_candidatures')
      .select('id, artisan_id, artisan_user_id, price, timeline, description, disponibilites, experience_years, artisan_company_name, artisan_rating, artisan_phone, materials_included, guarantee, status, created_at')
      .eq('marche_id', offerId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[st] GET candidatures error', { error: error.message })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    // Enrich with artisan profile
    const enriched = await Promise.all(
      (candidatures || []).map(async (c: { artisan_id: string; [key: string]: unknown }) => {
        const { data: profile } = await supabaseAdmin
          .from('profiles_artisan')
          .select('company_name, rating_avg, photo_url, city, services_offered, rc_pro_valid, decennale_valid, qualibat_valid')
          .eq('id', c.artisan_id)
          .single()
        return { ...c, profile: profile || null }
      })
    )

    return NextResponse.json({ candidatures: enriched })
  }

  // ── Mode: list offers published by a BTP company ──────────────────────────
  if (btpCompanyId) {
    const { data: offers, error } = await supabaseAdmin
      .from('marches')
      .select('id, title, description, category, mission_type, location_city, location_postal, budget_min, budget_max, start_date, duration_text, deadline, urgency, candidatures_count, max_candidatures, status, require_rc_pro, require_decennale, require_qualibat, nb_intervenants_souhaite, created_at')
      .eq('source_type', 'btp_sous_traitance')
      .eq('btp_company_id', btpCompanyId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('[st] GET company offers error', { error: error.message })
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({ offers: offers || [] })
  }

  // ── Mode: browse all open BTP offers (artisan side) ───────────────────────
  const today = new Date().toISOString().split('T')[0]

  let query = supabaseAdmin
    .from('marches')
    .select('id, title, description, category, mission_type, publisher_name, btp_company_name, location_city, location_postal, location_lat, location_lng, budget_min, budget_max, start_date, duration_text, deadline, urgency, candidatures_count, max_candidatures, require_rc_pro, require_decennale, require_qualibat, nb_intervenants_souhaite, status, created_at')
    .eq('source_type', 'btp_sous_traitance')
    .eq('status', 'open')
    .gte('deadline', today)
    .order('created_at', { ascending: false })
    .limit(50)

  if (category) query = query.eq('category', category)
  if (city) query = query.ilike('location_city', `%${city}%`)

  const { data, error } = await query

  if (error) {
    logger.error('[st] GET browse error', { error: error.message })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  let offers: Record<string, unknown>[] = (data || []) as Record<string, unknown>[]

  // Enrich with distance if artisan coords provided
  if (artisanUserId && offers.length > 0) {
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('latitude, longitude')
      .eq('user_id', artisanUserId)
      .single()

    if (artisan?.latitude && artisan?.longitude) {
      offers = offers.map((o) => {
        if (o.location_lat && o.location_lng) {
          const distance_km = Math.round(
            haversineDistance(artisan.latitude, artisan.longitude, o.location_lat as number, o.location_lng as number) * 10
          ) / 10
          return { ...o, distance_km }
        }
        return { ...o, distance_km: null }
      })
    }
  }

  const response = NextResponse.json({ offers })
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=120')
  return response
}

// ── POST /api/marches/sous-traitance — BTP company publishes an offer ────────
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`st_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const validation = validateBody(createSousTraitanceOffreSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  // Vérifier que l'utilisateur authentifié correspond au publisher
  if (user.id !== v.publisher_user_id) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const access_token = crypto.randomUUID()

  const { data, error } = await supabaseAdmin
    .from('marches')
    .insert({
      // Publisher
      publisher_name: v.publisher_name,
      publisher_email: v.publisher_email,
      publisher_phone: v.publisher_phone || null,
      publisher_type: 'entreprise',
      publisher_user_id: v.publisher_user_id,
      // BTP fields
      source_type: 'btp_sous_traitance',
      btp_company_id: v.btp_company_id,
      btp_company_name: v.btp_company_name,
      mission_type: v.mission_type,
      start_date: v.start_date || null,
      duration_text: v.duration_text || null,
      nb_intervenants_souhaite: v.nb_intervenants_souhaite || null,
      // Marché fields
      title: v.title,
      description: v.description,
      category: v.category,
      location_city: v.location_city,
      location_postal: v.location_postal || null,
      location_address: v.location_address || null,
      budget_min: v.budget_min ?? null,
      budget_max: v.budget_max ?? null,
      deadline: v.deadline,
      urgency: v.urgency,
      photos: v.photos || [],
      require_rc_pro: v.require_rc_pro,
      require_decennale: v.require_decennale,
      require_qualibat: v.require_qualibat,
      access_token,
      status: 'open',
      candidatures_count: 0,
    })
    .select()
    .single()

  if (error) {
    logger.error('[st] POST insert error', { error: error.message })
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Geocode + notify matching artisans (non-blocking)
  const marcheId = data.id
  try {
    const coords = await geocodeLocation(v.location_city, v.location_postal || undefined)
    if (coords) {
      await supabaseAdmin
        .from('marches')
        .update({ location_lat: coords.lat, location_lng: coords.lng })
        .eq('id', marcheId)

      // Notify artisans in the area matching the category
      const { data: artisans } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id, user_id, latitude, longitude, zone_radius_km, marches_categories')
        .eq('marches_opt_in', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (artisans && artisans.length > 0) {
        const matched = artisans
          .filter((a) => {
            const cats = a.marches_categories as string[] | null
            return !cats || cats.length === 0 || cats.includes(v.category)
          })
          .map((a) => ({
            ...a,
            distance_km: haversineDistance(coords.lat, coords.lng, a.latitude as number, a.longitude as number),
          }))
          .filter((a) => (a.distance_km as number) <= ((a.zone_radius_km as number) || 50))

        if (matched.length > 0) {
          const notifications = matched.map((a) => ({
            artisan_id: a.id,
            type: 'marche_new',
            title: `Offre sous-traitance : ${v.title}`,
            body: `L'entreprise "${v.btp_company_name}" recherche un(e) ${v.category} à ${v.location_city}.`,
            read: false,
          }))
          await supabaseAdmin.from('artisan_notifications').insert(notifications)
        }
      }
    }
  } catch (err) {
    logger.error('[st] POST geocode/notify error (non-blocking)', {
      error: err instanceof Error ? err.message : err,
      marcheId,
    })
  }

  logger.info('[st] Offer created', { marcheId, btpCompanyId: v.btp_company_id, category: v.category, city: v.location_city })

  return NextResponse.json({ offer: data, access_token }, { status: 201 })
}
