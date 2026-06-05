import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicChecklistSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

interface RawItem { label?: unknown; done?: unknown }

function normalizeItems(raw: unknown): { label: string; done: boolean }[] {
  if (!Array.isArray(raw)) return []
  return raw.map((i: RawItem) => ({
    label: typeof i?.label === 'string' ? i.label : '',
    done: !!i?.done,
  }))
}

// GET /api/syndic/checklists — checklists opérationnelles du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`checklists_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_checklists')
      .select('id, cabinet_id, titulo, tipo, edificio, estado, items, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const checklists = (data || []).map(c => ({
      id: c.id,
      titulo: c.titulo || '',
      tipo: c.tipo || '',
      edificio: c.edificio || '',
      estado: c.estado || 'em_curso',
      items: normalizeItems(c.items),
    }))

    return NextResponse.json({ checklists })
  } catch (err) {
    logger.error('[syndic/checklists/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/checklists — créer une checklist
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`checklists_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicChecklistSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_checklists')
      .insert({
        cabinet_id: cabinetId,
        titulo: v.titulo,
        tipo: v.tipo || '',
        edificio: v.edificio || '',
        estado: v.estado || 'em_curso',
        items: v.items ?? [],
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/checklists/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ checklist: data })
  } catch (err) {
    logger.error('[syndic/checklists/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
