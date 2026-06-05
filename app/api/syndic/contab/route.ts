import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicContabFracaoSchema, syndicContabChamadaSchema, syndicContabDiarioSchema, syndicContabOrcamentoSchema, validateBody } from '@/lib/validation'
import { logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

/**
 * Route consolidée Contabilidade Condomínio (ModContabCond) — 4 entités plates.
 * GET → { fracoes, chamadas, diario, orcamentos } ; POST { entity, ... } route vers la bonne table.
 * Isolation cabinet_id. NE concerne pas les tables relationnelles syndic_appels_charges/impayes.
 */

const num = (x: unknown) => (typeof x === 'number' ? x : Number(x) || 0)
const asRows = (d: unknown): Record<string, unknown>[] => (Array.isArray(d) ? (d as Record<string, unknown>[]) : [])

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`contab_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const eq = (t: string, cols: string) => supabaseAdmin.from(t).select(cols).eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(500)

    const [fr, ch, di, or] = await Promise.all([
      eq('syndic_contab_fracoes', 'id, identificacao, permilagem, proprietario, tipo, notas'),
      eq('syndic_contab_chamadas', 'id, titulo, edificio, data_emissao, data_vencimento, montante, distribuicao, notas, liquidadas'),
      eq('syndic_contab_diario', 'id, data, tipo, conta, montante, descricao'),
      eq('syndic_contab_orcamentos', 'id, ano, edificio, total_previsto, rubricas, notas, aprovado'),
    ])

    const fracoes = asRows(fr.data).map((r) => ({ id: r.id, identificacao: r.identificacao || '', permilagem: num(r.permilagem), proprietario: r.proprietario || '', tipo: r.tipo || 'habitacao', notas: r.notas || '' }))
    const chamadas = asRows(ch.data).map((r) => ({ id: r.id, titulo: r.titulo || '', edificio: r.edificio || '', dataEmissao: r.data_emissao || '', dataVencimento: r.data_vencimento || '', montante: num(r.montante), distribuicao: r.distribuicao || 'milesimos', notas: r.notas || '', liquidadas: num(r.liquidadas) }))
    const diario = asRows(di.data).map((r) => ({ id: r.id, data: r.data || '', tipo: r.tipo || 'debito', conta: r.conta || '', montante: num(r.montante), descricao: r.descricao || '' }))
    const orcamentos = asRows(or.data).map((r) => ({ id: r.id, ano: r.ano || '', edificio: r.edificio || '', totalPrevisto: num(r.total_previsto), rubricas: r.rubricas || '', notas: r.notas || '', aprovado: r.aprovado === true }))

    return NextResponse.json({ fracoes, chamadas, diario, orcamentos })
  } catch (err) {
    logger.error('[syndic/contab/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`contab_post_${ip}`, 20, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    const body = await request.json()
    const entity = body?.entity

    let table: string
    let row: Record<string, unknown>
    if (entity === 'frac') {
      const v = validateBody(syndicContabFracaoSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      table = 'syndic_contab_fracoes'
      row = { identificacao: v.data.identificacao, permilagem: v.data.permilagem ?? 0, proprietario: v.data.proprietario || '', tipo: v.data.tipo || 'habitacao', notas: v.data.notas || '' }
    } else if (entity === 'cham') {
      const v = validateBody(syndicContabChamadaSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      table = 'syndic_contab_chamadas'
      row = { titulo: v.data.titulo, edificio: v.data.edificio || '', data_emissao: v.data.dataEmissao || null, data_vencimento: v.data.dataVencimento || null, montante: v.data.montante ?? 0, distribuicao: v.data.distribuicao || 'milesimos', notas: v.data.notas || '', liquidadas: 0 }
    } else if (entity === 'diar') {
      const v = validateBody(syndicContabDiarioSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      table = 'syndic_contab_diario'
      row = { data: v.data.data || null, tipo: v.data.tipo || 'debito', conta: v.data.conta, montante: v.data.montante ?? 0, descricao: v.data.descricao }
    } else if (entity === 'orc') {
      const v = validateBody(syndicContabOrcamentoSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      table = 'syndic_contab_orcamentos'
      row = { ano: v.data.ano, edificio: v.data.edificio || '', total_previsto: v.data.totalPrevisto ?? 0, rubricas: v.data.rubricas || '', notas: v.data.notas || '', aprovado: false }
    } else {
      return NextResponse.json({ error: 'Entité inconnue' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin.from(table).insert({ cabinet_id: cabinetId, ...row }).select().single()
    if (error) {
      logger.error('[syndic/contab/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ item: data })
  } catch (err) {
    logger.error('[syndic/contab/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
