import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { createMarcheSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { haversineDistance } from '@/lib/geo'
import crypto from 'crypto'

// ── Geocoding helper ────────────────────────────────────────────────────────
async function geocodeLocation(city: string, postal?: string): Promise<{lat: number, lng: number} | null> {
  try {
    // Try French geocoder first
    const query = postal ? `${postal} ${city}` : city
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      const data = await res.json()
      if (data.features?.length > 0) {
        const [lng, lat] = data.features[0].geometry.coordinates
        return { lat, lng }
      }
    }
    // Fallback: Nominatim for Portugal
    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, {
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': 'Fixit/1.0' }
    })
    if (nomRes.ok) {
      const nomData = await nomRes.json()
      if (nomData.length > 0) return { lat: parseFloat(nomData[0].lat), lng: parseFloat(nomData[0].lon) }
    }
    return null
  } catch { return null }
}

// GET /api/marches — liste publique des appels d'offres ouverts
export async function GET(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_get_${ip}`, 60, 60_000))) return rateLimitResponse()

  const url = new URL(request.url)
  const { from, to } = parsePagination(url)

  // Filtres optionnels
  const category = url.searchParams.get('category')
  const city = url.searchParams.get('city')
  const budgetMin = url.searchParams.get('budget_min')
  const budgetMax = url.searchParams.get('budget_max')
  const urgency = url.searchParams.get('urgency')
  const artisanUserId = url.searchParams.get('artisan_user_id')
  const myBids = url.searchParams.get('my_bids')
  const artisanId = url.searchParams.get('artisan_id')
  const publisherUserId = url.searchParams.get('publisher_user_id')
  const sourceType = url.searchParams.get('source_type')

  // ── Publisher mode: return all marches published by a user ─────────────────
  if (publisherUserId) {
    const { data: publisherMarches, error: pubError } = await supabaseAdmin
      .from('marches')
      .select('id, title, description, category, location_city, budget_min, budget_max, deadline, urgency, candidatures_count, max_candidatures, status, access_token, created_at')
      .eq('publisher_user_id', publisherUserId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (pubError) {
      logger.error('[marches] GET publisher error', { error: pubError.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ marches: publisherMarches || [] })
  }

  // ── My bids mode: return all candidatures for an artisan ──────────────────
  if (myBids === 'true' && artisanId) {
    const { data: candidatures, error: candError } = await supabaseAdmin
      .from('marches_candidatures')
      .select('*, marches(id, title, category, location_city, budget_min, budget_max, deadline, urgency, status, publisher_name, publisher_type)')
      .eq('artisan_id', artisanId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (candError) {
      logger.error('[marches] GET my_bids error', { error: candError.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    // Flatten: merge marche data into each candidature
    const enriched = (candidatures || []).map((c: any) => ({
      ...c,
      marche: c.marches,
      my_candidature_id: c.id,
    }))

    return NextResponse.json({ candidatures: enriched })
  }

  const today = new Date().toISOString().split('T')[0]

  let query = supabaseAdmin
    .from('marches')
    .select('id, title, description, category, publisher_name, publisher_type, location_city, location_postal, location_lat, location_lng, budget_min, budget_max, deadline, urgency, photos, candidatures_count, max_candidatures, require_rc_pro, require_decennale, require_rge, require_qualibat, preferred_work_mode, matched_artisans, status, created_at')
    .eq('status', 'open')
    .gte('deadline', today)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (category) query = query.eq('category', category)
  if (city) query = query.ilike('location_city', `%${city}%`)
  if (budgetMin) query = query.gte('budget_min', parseInt(budgetMin))
  if (budgetMax) query = query.lte('budget_max', parseInt(budgetMax))
  if (urgency) query = query.eq('urgency', urgency)
  if (sourceType) query = query.eq('source_type', sourceType)

  // Filter for artisan-specific matched marches
  if (artisanUserId) {
    query = query.contains('matched_artisans', [artisanUserId])
  }

  const { data, error } = await query

  if (error) {
    logger.error('[marches] GET error', { error: error.message })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  let marches: any[] = data || []

  // If artisan_user_id provided, enrich with distance calculation
  if (artisanUserId && marches.length > 0) {
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('latitude, longitude')
      .eq('user_id', artisanUserId)
      .single()

    if (artisan?.latitude && artisan?.longitude) {
      marches = marches.map((m: any) => {
        const mLat = m.location_lat as number | null
        const mLng = m.location_lng as number | null
        if (mLat && mLng) {
          const distance_km = Math.round(haversineDistance(artisan.latitude, artisan.longitude, mLat, mLng) * 10) / 10
          return { ...m, distance_km }
        }
        return { ...m, distance_km: null }
      })
    }
  }

  const response = NextResponse.json({ marches })
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=120, stale-while-revalidate=300')
  return response
}

// POST /api/marches — créer un appel d'offres (public, pas d'auth requise)
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_post_${ip}`, 5, 60_000))) return rateLimitResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const validation = validateBody(createMarcheSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  const access_token = crypto.randomUUID()

  // Build dynamic fields object — only include fields that have values
  const dynamicFields: Record<string, unknown> = {}
  if (v.publisher_company) dynamicFields.publisher_company = v.publisher_company
  if (v.publisher_siret) dynamicFields.publisher_siret = v.publisher_siret
  if (v.immeuble_nom) dynamicFields.immeuble_nom = v.immeuble_nom
  if (v.immeuble_adresse) dynamicFields.immeuble_adresse = v.immeuble_adresse
  if (v.partie_commune !== undefined) dynamicFields.partie_commune = v.partie_commune
  if (v.nb_lots) dynamicFields.nb_lots = v.nb_lots
  if (v.type_hebergement) dynamicFields.type_hebergement = v.type_hebergement
  if (v.nb_unites) dynamicFields.nb_unites = v.nb_unites
  if (v.contrainte_calendrier) dynamicFields.contrainte_calendrier = v.contrainte_calendrier
  if (v.lot_technique) dynamicFields.lot_technique = v.lot_technique
  if (v.reference_chantier) dynamicFields.reference_chantier = v.reference_chantier
  if (v.programme_immobilier) dynamicFields.programme_immobilier = v.programme_immobilier
  if (v.phase_chantier) dynamicFields.phase_chantier = v.phase_chantier
  if (v.nb_logements) dynamicFields.nb_logements = v.nb_logements
  if (v.type_etablissement) dynamicFields.type_etablissement = v.type_etablissement
  if (v.mise_aux_normes !== undefined) dynamicFields.mise_aux_normes = v.mise_aux_normes
  if (v.numero_sinistre) dynamicFields.numero_sinistre = v.numero_sinistre
  if (v.type_sinistre) dynamicFields.type_sinistre = v.type_sinistre
  if (v.expert_referent) dynamicFields.expert_referent = v.expert_referent

  const { data, error } = await supabaseAdmin
    .from('marches')
    .insert({
      publisher_name: v.publisher_name,
      publisher_email: v.publisher_email,
      publisher_phone: v.publisher_phone || null,
      publisher_type: v.publisher_type,
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
      access_token,
      status: 'open',
      candidatures_count: 0,
      // V2 fields
      max_candidatures: v.max_candidatures,
      require_rc_pro: v.require_rc_pro,
      require_decennale: v.require_decennale,
      require_rge: v.require_rge,
      require_qualibat: v.require_qualibat,
      preferred_work_mode: v.preferred_work_mode || null,
      // V2.1 dynamic fields
      ...dynamicFields,
    })
    .select()
    .single()

  if (error) {
    logger.error('[marches] POST insert error', { error: error.message })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  // ── V2: Geocode location & match artisans ──────────────────────────────────
  // Run async — don't block the response if geocoding/matching fails
  const marcheId = data.id
  try {
    // 1. Geocode the marche location
    const coords = await geocodeLocation(v.location_city, v.location_postal || undefined)
    if (coords) {
      await supabaseAdmin
        .from('marches')
        .update({ location_lat: coords.lat, location_lng: coords.lng })
        .eq('id', marcheId)

      // 2. Query eligible artisans
      const { data: artisans } = await supabaseAdmin
        .from('profiles_artisan')
        .select('id, user_id, latitude, longitude, zone_radius_km, rating_avg, rc_pro_valid, decennale_valid, rge_valid, qualibat_valid, marches_work_mode, marches_categories, company_name')
        .eq('marches_opt_in', true)
        .eq('subscription_tier', 'artisan_pro')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

      if (artisans && artisans.length > 0) {
        // 3. Filter by category
        const categoryMatched = artisans.filter((a: Record<string, unknown>) => {
          const cats = a.marches_categories as string[] | null
          if (!cats || cats.length === 0) return true // no prefs = accept all
          return cats.includes(v.category)
        })

        // 4-5. Calculate distance & filter by zone
        const withDistance = categoryMatched
          .map((a: any) => {
            const dist = haversineDistance(
              coords.lat, coords.lng,
              a.latitude as number, a.longitude as number
            )
            return { ...a, distance_km: dist }
          })
          .filter((a: any) => {
            const radius = (a.zone_radius_km as number) || 50
            return a.distance_km <= radius
          })

        // 6. Check compliance requirements
        const compliant = withDistance.filter((a: any) => {
          if (v.require_rc_pro && !a.rc_pro_valid) return false
          if (v.require_decennale && !a.decennale_valid) return false
          if (v.require_rge && !a.rge_valid) return false
          if (v.require_qualibat && !a.qualibat_valid) return false
          return true
        })

        // 7. Sort by distance ASC, then rating_avg DESC
        compliant.sort((a: any, b: any) => {
          const distDiff = a.distance_km - b.distance_km
          if (Math.abs(distDiff) > 0.5) return distDiff
          return ((b.rating_avg as number) || 0) - ((a.rating_avg as number) || 0)
        })

        // 8. Store matched artisan user_ids
        const matchedUserIds = compliant.map((a: any) => a.user_id as string)
        if (matchedUserIds.length > 0) {
          await supabaseAdmin
            .from('marches')
            .update({ matched_artisans: matchedUserIds })
            .eq('id', marcheId)

          // 9. Create notifications for matched artisans
          const artisanIds = compliant.map((a: any) => a.id as string)
          const notifications = artisanIds.map((artisanId: string) => ({
            artisan_id: artisanId,
            type: 'marche_new',
            title: `Nouveau marché : ${v.title}`,
            body: `Un appel d'offres "${v.category}" à ${v.location_city} correspond à votre profil.`,
            read: false,
          }))
          await supabaseAdmin
            .from('artisan_notifications')
            .insert(notifications)
            .then(null, (err: Error) => {
              logger.error('[marches] Notification insert error', { error: err.message })
            })
        }

        logger.info('[marches] V2 matching complete', {
          marcheId,
          eligible: artisans.length,
          categoryMatch: categoryMatched.length,
          inZone: withDistance.length,
          compliant: compliant.length,
          matched: matchedUserIds.length,
        })
      }
    } else {
      logger.info('[marches] Geocoding failed, no matching performed', { marcheId, city: v.location_city })
    }
  } catch (matchErr) {
    logger.error('[marches] V2 matching error (non-blocking)', { error: matchErr instanceof Error ? matchErr.message : matchErr, marcheId })
  }

  return NextResponse.json({
    marche: data,
    access_token,
    management_url: `/marches/${data.id}?token=${access_token}`,
  }, { status: 201 })
}
