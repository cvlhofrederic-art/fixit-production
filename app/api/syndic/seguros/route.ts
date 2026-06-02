import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicSeguroSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/seguros — apólices de seguro du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`seguros_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_seguros')
      .select('id, cabinet_id, immeuble, seguradora, tipo, apolice, premio_anual, capital, data_inicio, data_fim, statut, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const seguros = (data || []).map(s => ({
      id: s.id,
      immeuble: s.immeuble || '',
      seguradora: s.seguradora || '',
      tipo: s.tipo || 'multirriscos',
      apolice: s.apolice || '',
      premioAnual: s.premio_anual ?? 0,
      capital: s.capital ?? 0,
      dataInicio: s.data_inicio || '',
      dataFim: s.data_fim || '',
      statut: s.statut || 'ativa',
      notes: s.notes || '',
    }))

    return NextResponse.json({ seguros })
  } catch (err) {
    logger.error('[syndic/seguros/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/seguros — créer une apólice
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`seguros_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicSeguroSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_seguros')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        seguradora: v.seguradora,
        tipo: v.tipo || 'multirriscos',
        apolice: v.apolice || '',
        premio_anual: v.premioAnual ?? 0,
        capital: v.capital ?? 0,
        data_inicio: v.dataInicio || null,
        data_fim: v.dataFim || null,
        statut: v.statut || 'ativa',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/seguros/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ seguro: data })
  } catch (err) {
    logger.error('[syndic/seguros/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
