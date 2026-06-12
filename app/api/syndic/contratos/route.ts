import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { syndicContratSchema, validateBody } from '@/lib/validation'
import { parsePagination, logger } from '@/lib/logger'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// GET /api/syndic/contratos — contrats prestataires du cabinet
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`contratos_get_${ip}`, 30, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const { from, to } = parsePagination(new URL(request.url))

    const { data, error } = await supabaseAdmin
      .from('syndic_contrats')
      .select('id, cabinet_id, immeuble, fornecedor, categoria, custo_mensal, custo_anual, data_inicio, data_fim, statut, notes, created_at')
      .eq('cabinet_id', cabinetId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

    // snake_case → camelCase pour le frontend
    const contratos = (data || []).map(c => ({
      id: c.id,
      immeuble: c.immeuble || '',
      fornecedor: c.fornecedor || '',
      categoria: c.categoria || 'outros',
      custoMensal: c.custo_mensal ?? 0,
      custoAnual: c.custo_anual ?? 0,
      dataInicio: c.data_inicio || '',
      dataFim: c.data_fim || '',
      statut: c.statut || 'ativo',
      notes: c.notes || '',
    }))

    return NextResponse.json({ contratos })
  } catch (err) {
    logger.error('[syndic/contratos/GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/syndic/contratos — créer un contrat prestataire
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !isSyndicRole(user)) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const ip = getClientIP(request)
    if (!(await checkRateLimit(`contratos_post_${ip}`, 10, 60_000))) return rateLimitResponse()

    const cabinetId = await resolveCabinetId(user, supabaseAdmin)
    if (!cabinetId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    const body = await request.json()

    // Validation Zod — empêche l'injection de champs arbitraires
    const validation = validateBody(syndicContratSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
    }
    const v = validation.data

    const { data, error } = await supabaseAdmin
      .from('syndic_contrats')
      .insert({
        cabinet_id: cabinetId,
        immeuble: v.immeuble || '',
        fornecedor: v.fornecedor,
        categoria: v.categoria || 'outros',
        custo_mensal: v.custoMensal ?? 0,
        custo_anual: v.custoAnual ?? 0,
        data_inicio: v.dataInicio || null,
        data_fim: v.dataFim || null,
        statut: v.statut || 'ativo',
        notes: v.notes || '',
      })
      .select()
      .single()

    if (error) {
      logger.error('[syndic/contratos/POST] insert error:', error)
      return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
    }
    return NextResponse.json({ contrato: data })
  } catch (err) {
    logger.error('[syndic/contratos/POST] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
