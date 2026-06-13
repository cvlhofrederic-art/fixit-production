import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { createCandidatureSchema, validateBody, VALID_UUID } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { haversineDistance } from '@/lib/geo'

// POST /api/marches/[id]/candidature — soumettre une candidature (artisan pro uniquement)
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_candidature_post_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const { id: marcheId } = await params
  if (!VALID_UUID.test(marcheId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  // Vérifier que le marché existe et est ouvert
  const { data: marche, error: marcheError } = await supabaseAdmin
    .from('marches')
    .select('id, status, deadline, candidatures_count, max_candidatures, require_rc_pro, require_decennale, require_rge, require_qualibat, location_lat, location_lng')
    .eq('id', marcheId)
    .single()

  if (marcheError || !marche) {
    return NextResponse.json({ error: 'Marché non trouvé' }, { status: 404 })
  }

  if (marche.status !== 'open') {
    return NextResponse.json({ error: 'Ce marché n\'est plus ouvert aux candidatures' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  if (marche.deadline < today) {
    return NextResponse.json({ error: 'La date limite de candidature est dépassée' }, { status: 400 })
  }

  // V2: Vérifier le nombre maximum de candidatures
  if (marche.max_candidatures && (marche.candidatures_count ?? 0) >= marche.max_candidatures) {
    return NextResponse.json({ error: 'Nombre maximum de candidatures atteint' }, { status: 409 })
  }

  // Vérifier que l'utilisateur est un artisan pro
  // (colonne réelle : company_city — `city` n'existe pas sur profiles_artisan,
  // la requête échouait en prod → 403 systématique sur toute candidature)
  const { data: artisan, error: artisanError } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id, subscription_tier, company_name, company_city, rc_pro_valid, decennale_valid, rge_valid, qualibat_valid, rating_avg, rating_count, latitude, longitude, marches_work_mode, marches_tarif_journalier, marches_tarif_horaire')
    .eq('user_id', user.id)
    .single()

  if (artisanError || !artisan) {
    return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 403 })
  }

  // Vérifier l'abonnement Pro (via profil ou table subscriptions)
  // (colonne réelle : plan_id — `plan` n'existe pas sur subscriptions, la requête
  // échouait en prod → les abonnés Stripe sans subscription_tier étaient rejetés)
  let isPro = artisan.subscription_tier === 'artisan_pro'
  if (!isPro) {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('status, plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    isPro = !!sub && sub.plan_id === 'artisan_pro'
  }

  if (!isPro) {
    return NextResponse.json({ error: 'Abonnement Artisan Pro requis pour candidater' }, { status: 403 })
  }

  // V2: Vérifier la conformité de l'artisan aux exigences du marché
  if (marche.require_rc_pro && !artisan.rc_pro_valid) {
    return NextResponse.json({ error: 'RC Pro requise' }, { status: 403 })
  }
  if (marche.require_decennale && !artisan.decennale_valid) {
    return NextResponse.json({ error: 'Assurance décennale requise' }, { status: 403 })
  }
  if (marche.require_rge && !artisan.rge_valid) {
    return NextResponse.json({ error: 'Certification RGE requise' }, { status: 403 })
  }
  if (marche.require_qualibat && !artisan.qualibat_valid) {
    return NextResponse.json({ error: 'Certification QualiBAT requise' }, { status: 403 })
  }

  // Vérifier qu'il n'a pas déjà candidaté sur ce marché
  const { data: existing } = await supabaseAdmin
    .from('marches_candidatures')
    .select('id')
    .eq('marche_id', marcheId)
    .eq('artisan_id', artisan.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Vous avez déjà soumis une candidature pour ce marché' }, { status: 409 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const validation = validateBody(createCandidatureSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const v = validation.data

  // Distance artisan ↔ chantier (snapshot, en km arrondi à 0,1) si les deux
  // couples de coordonnées sont connus.
  const artisanDistanceKm =
    artisan.latitude != null && artisan.longitude != null &&
    marche.location_lat != null && marche.location_lng != null
      ? Math.round(haversineDistance(artisan.latitude, artisan.longitude, marche.location_lat, marche.location_lng) * 10) / 10
      : null

  // Insérer la candidature
  // (colonne réelle : artisan_company_name — `artisan_name` et `artisan_city`
  // n'existent pas sur marches_candidatures, l'insert échouait en prod)
  // Les colonnes artisan_* sont un SNAPSHOT du profil au moment de la candidature :
  // le publisher les lit via le GET (aliasées sans préfixe) — sans elles, les badges
  // RC Pro / décennale / RGE / QualiBAT, la note et la distance restaient vides.
  const { data: candidature, error: insertError } = await supabaseAdmin
    .from('marches_candidatures')
    .insert({
      marche_id: marcheId,
      artisan_id: artisan.id,
      artisan_user_id: user.id,
      artisan_company_name: artisan.company_name || 'Artisan',
      artisan_rc_pro_valid: artisan.rc_pro_valid,
      artisan_decennale_valid: artisan.decennale_valid,
      artisan_rge_valid: artisan.rge_valid,
      artisan_qualibat_valid: artisan.qualibat_valid,
      artisan_rating: artisan.rating_avg,
      artisan_rating_count: artisan.rating_count,
      artisan_distance_km: artisanDistanceKm,
      artisan_work_mode: artisan.marches_work_mode,
      artisan_tarif_journalier: artisan.marches_tarif_journalier,
      artisan_tarif_horaire: artisan.marches_tarif_horaire,
      price: v.price,
      timeline: v.timeline,
      description: v.description,
      materials_included: v.materials_included,
      guarantee: v.guarantee || null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError) {
    logger.error('[marches/candidature] POST insert error', { error: insertError.message, marcheId })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  // Mettre à jour le compteur de candidatures sur le marché.
  // La RPC increment_counter n'existe pas en base (l'appel échouait toujours) et
  // l'ancien fallback read-modify-write (valeur lue + 1) perdait des incréments
  // concurrents. À la place : COUNT serveur sur marches_candidatures (source de
  // vérité) puis update — convergent même en cas de candidatures simultanées.
  const { count, error: countError } = await supabaseAdmin
    .from('marches_candidatures')
    .select('id', { count: 'exact', head: true })
    .eq('marche_id', marcheId)

  if (countError) {
    logger.error('[marches/candidature] candidatures count error', { error: countError.message, marcheId })
  } else {
    const { error: counterError } = await supabaseAdmin
      .from('marches')
      .update({ candidatures_count: count ?? 0 })
      .eq('id', marcheId)
    if (counterError) {
      logger.error('[marches/candidature] candidatures_count update error', { error: counterError.message, marcheId })
    }
  }

  return NextResponse.json({ candidature }, { status: 201 })
}

// GET /api/marches/[id]/candidature — lister les candidatures
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`marches_candidature_get_${ip}`, 30, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  const { id: marcheId } = await params
  if (!VALID_UUID.test(marcheId)) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  const url = new URL(request.url)
  const myBids = url.searchParams.get('my') === 'true'
  const { from, to } = parsePagination(url)

  // Mode "mes candidatures" : toutes les candidatures de l'artisan à travers tous les marchés
  if (myBids) {
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!artisan) {
      return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 403 })
    }

    const { data: candidatures, error } = await supabaseAdmin
      .from('marches_candidatures')
      .select('*, marches!inner(id, title, category, status, location_city, deadline)')
      .eq('artisan_id', artisan.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      logger.error('[marches/candidature] GET my bids error', { error: error.message })
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }

    return NextResponse.json({ candidatures: candidatures || [] })
  }

  // Vérifier si l'utilisateur est le publisher du marché (via token)
  const token = url.searchParams.get('token')
  if (token) {
    const { data: marche } = await supabaseAdmin
      .from('marches')
      .select('access_token')
      .eq('id', marcheId)
      .single()

    if (marche && token === marche.access_token) {
      // Publisher : voir toutes les candidatures.
      // Le front (app/fr/marches/gerer/GererMarcheClient.tsx) lit les champs SANS
      // préfixe (c.rc_pro_valid, c.rating, c.distance…) alors que les colonnes live
      // sont préfixées artisan_* → alias PostgREST vers les noms attendus.
      // NB : artisan_city n'a AUCUNE colonne sur marches_candidatures — le front la
      // conditionne (rien ne s'affiche si absente) ; à ajouter via migration si besoin.
      const { data: candidatures, error } = await supabaseAdmin
        .from('marches_candidatures')
        .select(
          '*, artisan_name:artisan_company_name, rc_pro_valid:artisan_rc_pro_valid, decennale_valid:artisan_decennale_valid, rge_valid:artisan_rge_valid, qualibat_valid:artisan_qualibat_valid, rating:artisan_rating, review_count:artisan_rating_count, distance:artisan_distance_km, work_mode:artisan_work_mode, tarif_journalier:artisan_tarif_journalier, tarif_horaire:artisan_tarif_horaire'
        )
        .eq('marche_id', marcheId)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        logger.error('[marches/candidature] GET publisher view error', { error: error.message })
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }

      return NextResponse.json({ candidatures: candidatures || [] })
    }
  }

  // Artisan : voir uniquement sa propre candidature pour ce marché
  const { data: artisan } = await supabaseAdmin
    .from('profiles_artisan')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!artisan) {
    return NextResponse.json({ error: 'Profil artisan non trouvé' }, { status: 403 })
  }

  const { data: candidatures, error } = await supabaseAdmin
    .from('marches_candidatures')
    .select('*')
    .eq('marche_id', marcheId)
    .eq('artisan_id', artisan.id)

  if (error) {
    logger.error('[marches/candidature] GET own candidature error', { error: error.message })
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }

  return NextResponse.json({ candidatures: candidatures || [] })
}
