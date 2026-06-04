import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicSegEdificioSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/seg-edificio — classifications SCIE du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`segedificio_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_seg_edificio')
      .select('id, cabinet_id, immeuble, categoria, encarregado, plano_emergencia, ultimo_exercicio, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const segEdificios = (data || []).map(s => ({
      id: s.id,
      immeuble: s.immeuble || '',
      categoria: s.categoria || '1',
      encarregado: s.encarregado || '',
      planoEmergencia: s.plano_emergencia === true,
      ultimoExercicio: s.ultimo_exercicio || '',
      notes: s.notes || '',
    }))

    return NextResponse.json({ segEdificios })
  } catch (err) {
    logger.error('[syndic/seg-edificio/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/seg-edificio — classifier un édifice
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`segedificio_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicSegEdificioSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_seg_edificio')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble,
        categoria: v.categoria || '1',
        encarregado: v.encarregado || '',
        plano_emergencia: v.planoEmergencia ?? false,
        ultimo_exercicio: v.ultimoExercicio || null,
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/seg-edificio/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ segEdificio: data })
  } catch (err) {
    logger.error('[syndic/seg-edificio/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
