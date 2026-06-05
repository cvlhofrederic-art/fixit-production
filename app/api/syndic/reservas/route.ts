import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicReservaSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/reservas — réservations d'espaces communs du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`reservas_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_reservas')
      .select('id, cabinet_id, espaco, quem, data, hora, estado, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('data', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const reservas = (data || []).map(r => ({
      id: r.id,
      espaco: r.espaco || '',
      quem: r.quem || '',
      data: r.data || '',
      hora: r.hora || '',
      estado: r.estado || 'pendente',
      notes: r.notes || '',
    }))

    return NextResponse.json({ reservas })
  } catch (err) {
    logger.error('[syndic/reservas/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/reservas — créer une réservation
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`reservas_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicReservaSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_reservas')
      .insert({
        cabinet_id: cabinetId,
        espaco: v.espaco,
        quem: v.quem || '',
        data: v.data || null,
        hora: v.hora || '',
        estado: v.estado || 'pendente',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/reservas/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ reserva: data })
  } catch (err) {
    logger.error('[syndic/reservas/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
