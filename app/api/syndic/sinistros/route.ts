import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicSinistroSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/sinistros — sinistres du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`sinistros_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_sinistros')
      .select('id, cabinet_id, immeuble, tipo, descricao, seguradora, statut, montante_estimado, indemnizacao, data_declaracao, urgente, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const sinistros = (data || []).map(s => ({
      id: s.id,
      immeuble: s.immeuble || '',
      tipo: s.tipo || '',
      descricao: s.descricao || '',
      seguradora: s.seguradora || '',
      statut: s.statut || 'declarado',
      montanteEstimado: s.montante_estimado ?? 0,
      indemnizacao: s.indemnizacao ?? 0,
      dataDeclaracao: s.data_declaracao || '',
      urgente: s.urgente === true,
      notes: s.notes || '',
    }))

    return NextResponse.json({ sinistros })
  } catch (err) {
    logger.error('[syndic/sinistros/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/sinistros — déclarer un sinistre
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`sinistros_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicSinistroSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_sinistros')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        tipo: v.tipo || '',
        descricao: v.descricao || '',
        seguradora: v.seguradora || '',
        statut: v.statut || 'declarado',
        montante_estimado: v.montanteEstimado ?? 0,
        indemnizacao: v.indemnizacao ?? 0,
        data_declaracao: v.dataDeclaracao || null,
        urgente: v.urgente ?? false,
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/sinistros/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ sinistro: data })
  } catch (err) {
    logger.error('[syndic/sinistros/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
