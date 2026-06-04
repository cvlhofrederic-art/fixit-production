import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicFaturaSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/factures-copro — factures condomínio du cabinet (table existante)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`factcopro_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_factures_copro')
      .select('id, cabinet_id, coproprio_id, immeuble_id, numero_facture, emise_le, echeance, montant_ht, tva_taux, montant_ttc, description, statut, pdf_url, created_at')
      .eq('cabinet_id', cabinetId)
      .order('emise_le', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const faturas = (data || []).map((r) => ({
      id: r.id,
      coproprioId: r.coproprio_id || '',
      immeubleId: r.immeuble_id || '',
      numeroFatura: r.numero_facture || '',
      emiseLe: r.emise_le || '',
      echeance: r.echeance || '',
      montantHt: num(r.montant_ht),
      tvaTaux: num(r.tva_taux),
      montantTtc: num(r.montant_ttc),
      description: r.description || '',
      statut: r.statut || 'a_regler',
      pdfUrl: r.pdf_url || '',
    }))

    return NextResponse.json({ faturas })
  } catch (err) {
    logger.error('[syndic/factures-copro/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/factures-copro — émettre une facture (montant_ttc calculé serveur)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`factcopro_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const validation = validateBody(syndicFaturaSchema, body)
    if (!validation.success) return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    const v = validation.data

    const ht = v.montantHt ?? 0
    const tva = v.tvaTaux ?? 23
    const ttc = Math.round(ht * (1 + tva / 100) * 100) / 100

    const { data, error } = await supabaseAdmin
      .from('syndic_factures_copro')
      .insert({
        cabinet_id: cabinetId,
        coproprio_id: v.coproprioId && v.coproprioId.length > 0 ? v.coproprioId : null,
        immeuble_id: v.immeubleId && v.immeubleId.length > 0 ? v.immeubleId : null,
        numero_facture: v.numeroFatura || '',
        emise_le: v.emiseLe || null,
        echeance: v.echeance || null,
        montant_ht: ht,
        tva_taux: tva,
        montant_ttc: ttc,
        description: v.description || '',
        statut: v.statut || 'a_regler',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/factures-copro/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ fatura: data })
  } catch (err) {
    logger.error('[syndic/factures-copro/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
