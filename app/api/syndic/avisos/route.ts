import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicAvisoSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/avisos — quadro de avisos du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`avisos_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_avisos')
      .select('id, cabinet_id, immeuble, titulo, descricao, categoria, prioridade, fixado, views, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const avisos = (data || []).map(a => ({
      id: a.id,
      immeuble: a.immeuble || '',
      titulo: a.titulo || '',
      descricao: a.descricao || '',
      categoria: a.categoria || 'outro',
      prioridade: a.prioridade || 'normal',
      fixado: a.fixado === true,
      views: a.views ?? 0,
      createdAt: a.created_at || '',
    }))

    return NextResponse.json({ avisos })
  } catch (err) {
    logger.error('[syndic/avisos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/avisos — publier un aviso
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`avisos_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicAvisoSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_avisos')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        titulo: v.titulo,
        descricao: v.descricao || '',
        categoria: v.categoria || 'outro',
        prioridade: v.prioridade || 'normal',
        fixado: v.fixado ?? false,
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/avisos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ aviso: data })
  } catch (err) {
    logger.error('[syndic/avisos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
