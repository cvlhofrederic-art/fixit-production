import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicReembolsoSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/reembolsos — reembolsos du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`reembolsos_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_reembolsos')
      .select('id, cabinet_id, immeuble, antigo_proprietario, fracao, data_venda, quotas_pagas, montante_reembolso, metodo, statut, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const reembolsos = (data || []).map(r => ({
      id: r.id,
      immeuble: r.immeuble || '',
      antigoProprietario: r.antigo_proprietario || '',
      fracao: r.fracao || '',
      dataVenda: r.data_venda || '',
      quotasPagas: r.quotas_pagas ?? 0,
      montanteReembolso: r.montante_reembolso ?? 0,
      metodo: r.metodo || '',
      statut: r.statut || 'pendente',
      notes: r.notes || '',
    }))

    return NextResponse.json({ reembolsos })
  } catch (err) {
    logger.error('[syndic/reembolsos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/reembolsos — enregistrer un reembolso
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`reembolsos_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()

    const validation = validateBody(syndicReembolsoSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_reembolsos')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        antigo_proprietario: v.antigoProprietario,
        fracao: v.fracao || '',
        data_venda: v.dataVenda || null,
        quotas_pagas: v.quotasPagas ?? 0,
        montante_reembolso: v.montanteReembolso ?? 0,
        metodo: v.metodo || '',
        statut: v.statut || 'pendente',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/reembolsos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ reembolso: data })
  } catch (err) {
    logger.error('[syndic/reembolsos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
