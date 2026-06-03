import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicFcrEdificioSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)

// GET /api/syndic/fcr-edificios — édifices configurés au FCR du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`fcredif_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_fcr_edificios')
      .select('id, cabinet_id, nome, endereco, orcamento_anual, percentagem_fcr, saldo_inicial, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    const edificios = (data || []).map(e => ({
      id: e.id,
      nome: e.nome || '',
      endereco: e.endereco || '',
      orcamentoAnual: num(e.orcamento_anual),
      percentagemFCR: num(e.percentagem_fcr),
      saldoInicial: num(e.saldo_inicial),
    }))

    return NextResponse.json({ edificios })
  } catch (err) {
    logger.error('[syndic/fcr-edificios/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/fcr-edificios — ajouter un édifice au FCR
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`fcredif_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()

    const validation = validateBody(syndicFcrEdificioSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_fcr_edificios')
      .insert({
        cabinet_id: cabinetId,
        nome: v.nome,
        endereco: v.endereco || '',
        orcamento_anual: v.orcamentoAnual ?? 0,
        percentagem_fcr: v.percentagemFCR ?? 10,
        saldo_inicial: v.saldoInicial ?? 0,
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/fcr-edificios/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ edificio: data })
  } catch (err) {
    logger.error('[syndic/fcr-edificios/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
