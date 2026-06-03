import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicCadernetaSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/caderneta — interventions de la caderneta de manutenção du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`caderneta_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_caderneta')
      .select('id, cabinet_id, data, estado, natureza, edificio, localizacao, prestador, custo, garantia, cee, notas, created_at')
      .eq('cabinet_id', cabinetId)
      .order('data', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const caderneta = (data || []).map(c => ({
      id: c.id,
      data: c.data || '',
      estado: c.estado || 'realizado',
      natureza: c.natureza || '',
      edificio: c.edificio || '',
      localizacao: c.localizacao || '',
      prestador: c.prestador || '',
      custo: typeof c.custo === 'number' ? c.custo : Number(c.custo) || 0,
      garantia: c.garantia || '',
      cee: c.cee || 'na',
      notas: c.notas || '',
    }))

    return NextResponse.json({ caderneta })
  } catch (err) {
    logger.error('[syndic/caderneta/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/caderneta — enregistrer une intervention
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`caderneta_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicCadernetaSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_caderneta')
      .insert({
        cabinet_id: cabinetId,
        data: v.data || null,
        estado: v.estado || 'realizado',
        natureza: v.natureza,
        edificio: v.edificio || '',
        localizacao: v.localizacao || '',
        prestador: v.prestador || '',
        custo: v.custo ?? 0,
        garantia: v.garantia || '',
        cee: v.cee || 'na',
        notas: v.notas || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/caderneta/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ caderneta: data })
  } catch (err) {
    logger.error('[syndic/caderneta/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
