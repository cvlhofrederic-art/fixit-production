/**
 * GET  /api/marketplace-btp  — liste des annonces (filtrable)
 * POST /api/marketplace-btp  — créer une annonce (auth requis)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { CreateListingPayload } from '@/lib/marketplace-btp-types'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const MARKETPLACE_CATEGORIE_IDS = [
  'engins_tp', 'grues_levage', 'camions', 'echafaudages', 'outillage_pro',
  'materiaux_gros', 'materiaux_second', 'materiel_electro', 'autre_pro',
  'mini_engins', 'materiel_leger',
] as const

const listingBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  categorie: z.enum(MARKETPLACE_CATEGORIE_IDS),
  type_annonce: z.enum(['vente', 'location', 'vente_location']),
  etat: z.enum(['neuf', 'bon', 'correct', 'use']),
  prix_vente: z.number().positive().optional(),
  prix_location_jour: z.number().positive().optional(),
  prix_location_semaine: z.number().positive().optional(),
  prix_location_mois: z.number().positive().optional(),
  disponible_de: z.string().optional(),
  disponible_jusqu: z.string().optional(),
  localisation: z.string().optional(),
  country: z.string().optional(),
  marque: z.string().optional(),
  modele: z.string().optional(),
  annee: z.number().int().min(1900).max(2100).optional(),
  caracteristiques: z.record(z.string(), z.string()).optional(),
  vendeur_nom: z.string().optional(),
  vendeur_phone: z.string().optional(),
})

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

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`mpl_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const { searchParams } = new URL(req.url)
    const categorie   = searchParams.get('categorie')
    const country     = searchParams.get('country')
    const type        = searchParams.get('type')          // vente | location
    const ae_only     = searchParams.get('ae_only')       // true → only accessible_ae
    const user_id     = searchParams.get('user_id')       // mes annonces
    const limit       = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 100)

    let query = getAdmin()
      .from('marketplace_listings')
      .select('*')
      .neq('status', 'deleted')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (user_id) {
      // "Mes annonces" — requiert auth et vérifie que c'est bien l'utilisateur
      const token = req.headers.get('authorization')?.replace('Bearer ', '')
      if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: { user }, error: authErr } = await getAnon().auth.getUser(token)
      if (authErr || !user || user.id !== user_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      query = query.eq('user_id', user_id)
    } else {
      query = query.eq('status', 'active')    // publiques = actives seulement
    }
    if (categorie) query = query.eq('categorie', categorie)
    if (country)   query = query.eq('country', country)
    if (type)      query = query.or(`type_annonce.eq.${type},type_annonce.eq.vente_location`)
    if (ae_only === 'true') query = query.eq('accessible_ae', true)

    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ listings: data ?? [] }, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' },
    })
  } catch (e) {
    console.error('[MPL GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req)
    if (!(await checkRateLimit(`mpl_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: { user }, error: authErr } = await getAnon().auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rawBody = await req.json()
    const parsed = listingBodySchema.safeParse(rawBody)
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten().fieldErrors }, { status: 400 })

    const body = parsed.data

    // Déterminer accessible_ae selon la catégorie
    const AE_CATS = ['mini_engins', 'materiel_leger']
    const accessible_ae = AE_CATS.includes(body.categorie)

    const { data, error } = await getAdmin()
      .from('marketplace_listings')
      .insert({
        user_id: user.id,
        title:           body.title,
        description:     body.description,
        categorie:       body.categorie,
        type_annonce:    body.type_annonce,
        prix_vente:      body.prix_vente,
        prix_location_jour:     body.prix_location_jour,
        prix_location_semaine:  body.prix_location_semaine,
        prix_location_mois:     body.prix_location_mois,
        disponible_de:   body.disponible_de,
        disponible_jusqu: body.disponible_jusqu,
        localisation:    body.localisation,
        country:         body.country || 'FR',
        marque:          body.marque,
        modele:          body.modele,
        annee:           body.annee,
        etat:            body.etat,
        caracteristiques: body.caracteristiques || {},
        vendeur_nom:     body.vendeur_nom,
        vendeur_phone:   body.vendeur_phone,
        accessible_ae,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ listing: data }, { status: 201 })
  } catch (e) {
    console.error('[MPL POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
