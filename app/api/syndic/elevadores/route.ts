import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicElevadorSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/elevadores — parc d'ascenseurs du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`elevadores_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_elevadores')
      .select('id, cabinet_id, immeuble, marca, categoria, ema, ultima_inspecao, proxima_inspecao, estado, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const elevadores = (data || []).map(e => ({
      id: e.id,
      immeuble: e.immeuble || '',
      marca: e.marca || '',
      categoria: e.categoria || 'habitacional',
      ema: e.ema || '',
      ultimaInspecao: e.ultima_inspecao || '',
      proximaInspecao: e.proxima_inspecao || '',
      estado: e.estado || 'conforme',
      notes: e.notes || '',
    }))

    return NextResponse.json({ elevadores })
  } catch (err) {
    logger.error('[syndic/elevadores/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/elevadores — enregistrer un ascenseur
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`elevadores_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicElevadorSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_elevadores')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        marca: v.marca || '',
        categoria: v.categoria || 'habitacional',
        ema: v.ema || '',
        ultima_inspecao: v.ultimaInspecao || null,
        proxima_inspecao: v.proximaInspecao || null,
        estado: v.estado || 'conforme',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/elevadores/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ elevador: data })
  } catch (err) {
    logger.error('[syndic/elevadores/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
