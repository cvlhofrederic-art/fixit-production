import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicImpayeSchema, syndicImpayeUpdateSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/impayes — impayés du cabinet (table relationnelle existante)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`impayes_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_impayes')
      .select('id, cabinet_id, immeuble_id, coproprio_id, montant, nature, depuis, derniere_relance_at, nb_relances, statut, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('depuis', { ascending: true })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const impayes = (data || []).map((r) => ({
      id: r.id,
      immeubleId: r.immeuble_id || '',
      coproprioId: r.coproprio_id || '',
      montant: num(r.montant),
      nature: r.nature || 'autre',
      depuis: r.depuis || '',
      derniereRelanceAt: r.derniere_relance_at || '',
      nbRelances: num(r.nb_relances),
      statut: r.statut || 'ouvert',
      notes: r.notes || '',
    }))

    return NextResponse.json({ impayes })
  } catch (err) {
    logger.error('[syndic/impayes/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/impayes — ouvrir un impayé
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`impayes_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()
    const validation = validateBody(syndicImpayeSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_impayes')
      .insert({
        cabinet_id: cabinetId,
        immeuble_id: v.immeubleId && v.immeubleId.length > 0 ? v.immeubleId : null,
        coproprio_id: v.coproprioId && v.coproprioId.length > 0 ? v.coproprioId : null,
        montant: v.montant,
        nature: v.nature || 'charges_courantes',
        depuis: v.depuis,
        statut: v.statut || 'ouvert',
        notes: v.notes || null,
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/impayes/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ impaye: data })
  } catch (err) {
    logger.error('[syndic/impayes/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/impayes — relance (nb_relances++) ou changement de statut
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`impayes_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()
    const validation = validateBody(syndicImpayeUpdateSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    const v = validation.data

    const patch: Record<string, unknown> = {}
    if (v.statut) patch.statut = v.statut
    if (v.nbRelances !== undefined) patch.nb_relances = v.nbRelances
    if (v.derniereRelanceAt) patch.derniere_relance_at = v.derniereRelanceAt
    if (v.notes !== undefined) patch.notes = v.notes
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('syndic_impayes')
      .update(patch)
      .eq('id', v.id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) {
      logger.error('[syndic/impayes/PATCH] update error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ impaye: data })
  } catch (err) {
    logger.error('[syndic/impayes/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
