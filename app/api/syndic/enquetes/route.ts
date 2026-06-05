import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicEnqueteSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

interface RawOption { label?: unknown; votes?: unknown }

function normalizeOptions(raw: unknown): { label: string; votes: number }[] {
  if (!Array.isArray(raw)) return []
  return raw.map((o: RawOption) => ({
    label: typeof o?.label === 'string' ? o.label : '',
    votes: typeof o?.votes === 'number' ? o.votes : Number(o?.votes) || 0,
  }))
}

// GET /api/syndic/enquetes — enquêtes & sondages du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`enquetes_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_enquetes')
      .select('id, cabinet_id, titulo, descricao, estado, tipo, edificio, prazo, total, options, anonima, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const enquetes = (data || []).map(e => ({
      id: e.id,
      titulo: e.titulo || '',
      descricao: e.descricao || '',
      estado: e.estado || 'ativa',
      tipo: e.tipo || '',
      edificio: e.edificio || '',
      prazo: e.prazo || '',
      total: typeof e.total === 'number' ? e.total : Number(e.total) || 0,
      options: normalizeOptions(e.options),
      anonima: !!e.anonima,
    }))

    return NextResponse.json({ enquetes })
  } catch (err) {
    logger.error('[syndic/enquetes/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/enquetes — créer une enquête
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`enquetes_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicEnqueteSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_enquetes')
      .insert({
        cabinet_id: cabinetId,
        titulo: v.titulo,
        descricao: v.descricao || '',
        estado: v.estado || 'ativa',
        tipo: v.tipo || '',
        edificio: v.edificio || '',
        prazo: v.prazo || null,
        total: v.total ?? 0,
        options: v.options ?? [],
        anonima: v.anonima ?? false,
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/enquetes/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ enquete: data })
  } catch (err) {
    logger.error('[syndic/enquetes/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
