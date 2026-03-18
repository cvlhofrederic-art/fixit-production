// ══════════════════════════════════════════════════════════════════════════════
// /api/portugal-fiscal/series — Manage document series
// ══════════════════════════════════════════════════════════════════════════════
// GET  — List artisan's series
// POST — Create or update a series (with AT validation code)
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

// GET /api/portugal-fiscal/series — List artisan's document series
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('pt_fiscal_series')
    .select('*')
    .eq('artisan_id', user.id)
    .order('fiscal_year', { ascending: false })
    .order('doc_type', { ascending: true })

  if (error) {
    logger.error('[pt-series] GET error:', error.message)
    return NextResponse.json({ error: 'Erro ao consultar séries' }, { status: 500 })
  }

  return NextResponse.json({ series: data || [] })
}

// POST /api/portugal-fiscal/series — Create or update a series
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const body = await request.json()
  const {
    seriesPrefix = 'VTF',
    docType,           // "FT", "FR", "FS", "NC", "ND", "OR"
    validationCode,    // AT-assigned code
    fiscalYear,
    fiscalSpace = 'PT',
  } = body

  if (!docType || !validationCode || !fiscalYear) {
    return NextResponse.json({ error: 'Campos obrigatórios: docType, validationCode, fiscalYear' }, { status: 400 })
  }

  // Valid doc types
  const validTypes = ['FT', 'FR', 'FS', 'NC', 'ND', 'OR']
  if (!validTypes.includes(docType)) {
    return NextResponse.json({ error: `Tipo de documento inválido. Valores aceites: ${validTypes.join(', ')}` }, { status: 400 })
  }

  // Check if series already exists
  const { data: existing } = await supabaseAdmin
    .from('pt_fiscal_series')
    .select('id')
    .eq('artisan_id', user.id)
    .eq('series_prefix', seriesPrefix)
    .eq('doc_type', docType)
    .eq('fiscal_year', fiscalYear)
    .single()

  if (existing) {
    // Update validation code
    const { data, error } = await supabaseAdmin
      .from('pt_fiscal_series')
      .update({
        validation_code: validationCode,
        fiscal_space: fiscalSpace,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) {
      logger.error('[pt-series] Update error:', error.message)
      return NextResponse.json({ error: 'Erro ao atualizar série' }, { status: 500 })
    }

    return NextResponse.json({ series: data, updated: true })
  }

  // Create new series
  const { data, error } = await supabaseAdmin
    .from('pt_fiscal_series')
    .insert({
      artisan_id: user.id,
      series_prefix: seriesPrefix,
      doc_type: docType,
      validation_code: validationCode,
      current_seq: 0,
      fiscal_year: fiscalYear,
      fiscal_space: fiscalSpace,
    })
    .select()
    .single()

  if (error) {
    logger.error('[pt-series] Insert error:', error.message)
    return NextResponse.json({ error: 'Erro ao criar série' }, { status: 500 })
  }

  return NextResponse.json({ series: data, created: true })
}
