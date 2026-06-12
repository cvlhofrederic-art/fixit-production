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
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    // Tables et colonnes en littéraux : le client typé <Database> ne peut pas
    // inférer les types avec un nom de table dynamique (ancien helper eq(t, cols)).
    const [fr, ch, di, or] = await Promise.all([
      supabaseAdmin.from('syndic_contab_fracoes').select('id, identificacao, permilagem, proprietario, tipo, notas').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('syndic_contab_chamadas').select('id, titulo, edificio, data_emissao, data_vencimento, montante, distribuicao, notas, liquidadas').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('syndic_contab_diario').select('id, data, tipo, conta, montante, descricao').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(500),
      supabaseAdmin.from('syndic_contab_orcamentos').select('id, ano, edificio, total_previsto, rubricas, notas, aprovado').eq('cabinet_id', cabinetId).order('created_at', { ascending: false }).limit(500),
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
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()
    const entity = body?.entity

    // Réponse commune aux 4 inserts typés (nom de table en littéral requis par le client <Database>)
    const respond = (res: { data: unknown; error: { message: string } | null }) => {
      if (res.error) {
        logger.error('[syndic/contab/POST] insert error:', res.error)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }
      return NextResponse.json({ item: res.data })
    }

    if (entity === 'frac') {
      const v = validateBody(syndicContabFracaoSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      return respond(await supabaseAdmin.from('syndic_contab_fracoes')
        .insert({ cabinet_id: cabinetId, identificacao: v.data.identificacao, permilagem: v.data.permilagem ?? 0, proprietario: v.data.proprietario || '', tipo: v.data.tipo || 'habitacao', notas: v.data.notas || '' })
        .select().single())
    }
    if (entity === 'cham') {
      const v = validateBody(syndicContabChamadaSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      return respond(await supabaseAdmin.from('syndic_contab_chamadas')
        .insert({ cabinet_id: cabinetId, titulo: v.data.titulo, edificio: v.data.edificio || '', data_emissao: v.data.dataEmissao || null, data_vencimento: v.data.dataVencimento || null, montante: v.data.montante ?? 0, distribuicao: v.data.distribuicao || 'milesimos', notas: v.data.notas || '', liquidadas: 0 })
        .select().single())
    }
    if (entity === 'diar') {
      const v = validateBody(syndicContabDiarioSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      return respond(await supabaseAdmin.from('syndic_contab_diario')
        .insert({ cabinet_id: cabinetId, data: v.data.data || null, tipo: v.data.tipo || 'debito', conta: v.data.conta, montante: v.data.montante ?? 0, descricao: v.data.descricao })
        .select().single())
    }
    if (entity === 'orc') {
      const v = validateBody(syndicContabOrcamentoSchema, body)
      if (!v.success) return NextResponse.json({ error: 'Données invalides', details: v.error }, { status: 400 })
      return respond(await supabaseAdmin.from('syndic_contab_orcamentos')
        .insert({ cabinet_id: cabinetId, ano: v.data.ano, edificio: v.data.edificio || '', total_previsto: v.data.totalPrevisto ?? 0, rubricas: v.data.rubricas || '', notas: v.data.notas || '', aprovado: false })
        .select().single())
    }
    return NextResponse.json({ error: 'Entité inconnue' }, { status: 400 })
  } catch (err) {
    logger.error('[syndic/contab/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
