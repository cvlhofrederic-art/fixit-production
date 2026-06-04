import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicVistoriaSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/vistorias — vistorias techniques du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`vistorias_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_vistorias')
      .select('id, cabinet_id, immeuble, titulo, statut, pontos_vigiar, pontos_deficientes, data_vistoria, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const vistorias = (data || []).map(v => ({
      id: v.id,
      immeuble: v.immeuble || '',
      titulo: v.titulo || '',
      statut: v.statut || 'em_curso',
      pontosVigiar: v.pontos_vigiar ?? 0,
      pontosDeficientes: v.pontos_deficientes ?? 0,
      dataVistoria: v.data_vistoria || '',
      notes: v.notes || '',
    }))

    return NextResponse.json({ vistorias })
  } catch (err) {
    logger.error('[syndic/vistorias/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/vistorias — créer une vistoria
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`vistorias_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicVistoriaSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_vistorias')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        titulo: v.titulo,
        statut: v.statut || 'em_curso',
        pontos_vigiar: v.pontosVigiar ?? 0,
        pontos_deficientes: v.pontosDeficientes ?? 0,
        data_vistoria: v.dataVistoria || null,
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/vistorias/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ vistoria: data })
  } catch (err) {
    logger.error('[syndic/vistorias/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
