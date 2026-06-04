import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicRecouvrementSchema, syndicRecouvrementUpdateSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/recouvrement — procédures de recouvrement du cabinet (table existante)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`recouvr_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_recouvrement')
      .select('id, cabinet_id, immeuble_id, coproprio_id, impaye_id, procedure, statut, montant_initial, montant_recouvre, date_ouverture, date_cloture, avocat_huissier, prochaine_echeance, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const recouvrements = (data || []).map((r) => ({
      id: r.id,
      immeubleId: r.immeuble_id || '',
      coproprioId: r.coproprio_id || '',
      impayeId: r.impaye_id || '',
      procedure: r.procedure || 'amiable',
      statut: r.statut || 'en_cours',
      montantInitial: num(r.montant_initial),
      montantRecouvre: num(r.montant_recouvre),
      dateOuverture: r.date_ouverture || '',
      dateCloture: r.date_cloture || '',
      avocatHuissier: r.avocat_huissier || '',
      prochaineEcheance: r.prochaine_echeance || '',
      notes: r.notes || '',
    }))

    return NextResponse.json({ recouvrements })
  } catch (err) {
    logger.error('[syndic/recouvrement/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/recouvrement — ouvrir une procédure
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`recouvr_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const validation = validateBody(syndicRecouvrementSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_recouvrement')
      .insert({
        cabinet_id: cabinetId,
        immeuble_id: v.immeubleId && v.immeubleId.length > 0 ? v.immeubleId : null,
        coproprio_id: v.coproprioId && v.coproprioId.length > 0 ? v.coproprioId : null,
        procedure: v.procedure || 'amiable',
        statut: v.statut || 'en_cours',
        montant_initial: v.montantInitial ?? 0,
        montant_recouvre: v.montantRecouvre ?? 0,
        date_ouverture: v.dateOuverture || null,
        avocat_huissier: v.avocatHuissier || null,
        prochaine_echeance: v.prochaineEcheance || null,
        notes: v.notes || null,
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/recouvrement/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ recouvrement: data })
  } catch (err) {
    logger.error('[syndic/recouvrement/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/syndic/recouvrement — faire avancer la procédure / statut / montant recouvré
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`recouvr_patch_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const validation = validateBody(syndicRecouvrementUpdateSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    const v = validation.data

    const patch: Record<string, unknown> = {}
    if (v.procedure) patch.procedure = v.procedure
    if (v.statut) patch.statut = v.statut
    if (v.montantRecouvre !== undefined) patch.montant_recouvre = v.montantRecouvre
    if (v.avocatHuissier !== undefined) patch.avocat_huissier = v.avocatHuissier
    if (v.prochaineEcheance !== undefined) patch.prochaine_echeance = v.prochaineEcheance
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Rien à mettre à jour' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('syndic_recouvrement')
      .update(patch)
      .eq('id', v.id)
      .eq('cabinet_id', cabinetId)
      .select()
      .single()

    if (error) {
      logger.error('[syndic/recouvrement/PATCH] update error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ recouvrement: data })
  } catch (err) {
    logger.error('[syndic/recouvrement/PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
