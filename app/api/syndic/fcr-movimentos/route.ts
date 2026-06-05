import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicFcrMovimentoSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/fcr-movimentos — mouvements FCR du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`fcrmov_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_fcr_movimentos')
      .select('id, cabinet_id, edificio, tipo, data, montante, descricao, created_at')
      .eq('cabinet_id', cabinetId)
      .order('data', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const movimentos = (data || []).map(mv => ({
      id: mv.id,
      edificio: mv.edificio || '',
      tipo: mv.tipo || 'entrada',
      data: mv.data || '',
      montante: num(mv.montante),
      descricao: mv.descricao || '',
    }))

    return NextResponse.json({ movimentos })
  } catch (err) {
    logger.error('[syndic/fcr-movimentos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/fcr-movimentos — enregistrer un mouvement FCR
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`fcrmov_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicFcrMovimentoSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_fcr_movimentos')
      .insert({
        cabinet_id: cabinetId,
        edificio: v.edificio || '',
        tipo: v.tipo || 'entrada',
        data: v.data || null,
        montante: v.montante ?? 0,
        descricao: v.descricao,
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/fcr-movimentos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ movimento: data })
  } catch (err) {
    logger.error('[syndic/fcr-movimentos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
