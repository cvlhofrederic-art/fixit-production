import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicDeclEncargosSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/decl-encargos — déclarations d'encargos du cabinet (Lei 8/2022)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`declencargos_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_decl_encargos')
      .select('id, cabinet_id, fracao, condomino, edificio, data_pedido, prazo_limite, encargos_correntes, divida, estado, notas, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const declaracoes = (data || []).map(d => ({
      id: d.id,
      fracao: d.fracao || '',
      condomino: d.condomino || '',
      edificio: d.edificio || '',
      dataPedido: d.data_pedido || '',
      prazoLimite: d.prazo_limite || '',
      encargosCorrentes: typeof d.encargos_correntes === 'number' ? d.encargos_correntes : Number(d.encargos_correntes) || 0,
      divida: typeof d.divida === 'number' ? d.divida : Number(d.divida) || 0,
      estado: d.estado || 'pendente',
      notas: d.notas || '',
    }))

    return NextResponse.json({ declaracoes })
  } catch (err) {
    logger.error('[syndic/decl-encargos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/decl-encargos — enregistrer une déclaration d'encargos
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`declencargos_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()

    const validation = validateBody(syndicDeclEncargosSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_decl_encargos')
      .insert({
        cabinet_id: cabinetId,
        fracao: v.fracao,
        condomino: v.condomino,
        edificio: v.edificio || '',
        data_pedido: v.dataPedido || null,
        prazo_limite: v.prazoLimite || null,
        encargos_correntes: v.encargosCorrentes ?? 0,
        divida: v.divida ?? 0,
        estado: 'pendente',
        notas: v.notas || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/decl-encargos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ declaracao: data })
  } catch (err) {
    logger.error('[syndic/decl-encargos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
