// ══════════════════════════════════════════════════════════════════════════════
// POST /api/portugal-fiscal/register-document
// ══════════════════════════════════════════════════════════════════════════════
// Registers a fiscal document (invoice/quote) in the hash chain.
// Returns: sequential number, hash, ATCUD, QR code string.
// Called by the frontend BEFORE generating the PDF.
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import {
  registerDocument,
  mapDocTypeToSAFT,
  validateNIF,
  type DocumentRegistrationInput,
  type InvoiceLine,
  type FiscalSpace,
} from '@/lib/portugal-fiscal'
import { validateBody, ptFiscalRegisterDocSchema } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // ── Auth ──
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  // ── Rate limit ──
  const allowed = await checkRateLimit(`pt_fiscal_${user.id}`, 10, 60_000)
  if (!allowed) return rateLimitResponse()

  try {
    const body = await request.json()
    const validation = validateBody(ptFiscalRegisterDocSchema, body)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const {
      docType,          // 'devis' | 'facture'
      issuerNIF,        // NIF do emitente
      issuerName,       // Company name
      issuerAddress,    // Company address
      issuerCity,
      issuerPostalCode,
      clientNIF,        // NIF do cliente (optional)
      clientName,
      clientAddress,
      clientCity,
      clientPostalCode,
      clientCountry,
      fiscalSpace = 'PT',
      lines,            // Array of { description, quantity, unitPrice, taxRate, lineTotal }
      issueDate,        // YYYY-MM-DD
      isSimplified,     // boolean
    } = validation.data

    if (!validateNIF(issuerNIF)) {
      return NextResponse.json({ error: 'NIF do emitente inválido' }, { status: 400 })
    }

    if (clientNIF && clientNIF !== '999999990' && !validateNIF(clientNIF)) {
      return NextResponse.json({ error: 'NIF do cliente inválido' }, { status: 400 })
    }

    // ── Get or create series ──
    const saftDocType = mapDocTypeToSAFT(docType as 'devis' | 'facture', isSimplified)
    const fiscalYear = new Date(issueDate).getFullYear()

    let { data: series } = await supabaseAdmin
      .from('pt_fiscal_series')
      .select('id, series_prefix, validation_code, current_seq')
      .eq('artisan_id', user.id)
      .eq('doc_type', saftDocType)
      .eq('fiscal_year', fiscalYear)
      .eq('is_active', true)
      .single()

    // Auto-create series if not exists (with placeholder validation code)
    if (!series) {
      const { data: newSeries, error: createErr } = await supabaseAdmin
        .from('pt_fiscal_series')
        .insert({
          artisan_id: user.id,
          series_prefix: 'VTF',  // Vitfix default prefix
          doc_type: saftDocType,
          validation_code: '0',  // Placeholder — must be updated with AT-assigned code
          current_seq: 0,
          fiscal_year: fiscalYear,
          fiscal_space: fiscalSpace,
        })
        .select('id, series_prefix, validation_code, current_seq')
        .single()

      if (createErr || !newSeries) {
        logger.error('[portugal-fiscal] Failed to create series:', createErr?.message)
        return NextResponse.json({ error: 'Erro ao criar série de documentos' }, { status: 500 })
      }
      series = newSeries
    }

    // ── Atomic sequential number ──
    const { data: seqResult, error: seqErr } = await supabaseAdmin
      .rpc('pt_fiscal_next_seq', { p_series_id: series.id })

    if (seqErr || seqResult === null || seqResult === undefined) {
      logger.error('[portugal-fiscal] Failed to get next seq:', seqErr?.message)
      return NextResponse.json({ error: 'Erro ao gerar número sequencial' }, { status: 500 })
    }
    const sequentialNumber = seqResult as number

    // ── Get previous hash ──
    const { data: prevHashResult } = await supabaseAdmin
      .rpc('pt_fiscal_previous_hash', { p_series_id: series.id })
    const previousHash = (prevHashResult as string) || ''

    // ── Register document ──
    const invoiceLines: InvoiceLine[] = lines.map((l: Record<string, unknown>) => ({
      description: String(l.description || ''),
      quantity: Number(l.quantity || l.qty || 0),
      unitPrice: Number(l.unitPrice || l.priceHT || 0),
      taxRate: Number(l.taxRate || l.tvaRate || 0),
      lineTotal: Number(l.lineTotal || l.totalHT || 0),
    }))

    const input: DocumentRegistrationInput = {
      artisanId: user.id,
      docType: docType as 'devis' | 'facture',
      issuerNIF,
      clientNIF: clientNIF || '999999990',
      clientCountry: clientCountry || 'PT',
      fiscalSpace: (fiscalSpace || 'PT') as FiscalSpace,
      lines: invoiceLines,
      issueDate,
      isSimplified,
    }

    const result = await registerDocument(
      input,
      series.series_prefix,
      series.validation_code,
      sequentialNumber,
      previousHash
    )

    // ── Store in database ──
    const { error: insertErr } = await supabaseAdmin
      .from('pt_fiscal_documents')
      .insert({
        artisan_id: user.id,
        series_id: series.id,
        doc_type: result.saftDocType,
        doc_number: result.docNumber,
        seq_number: result.sequentialNumber,
        atcud: result.atcud,
        hash: result.hash || 'DEV_MODE_NO_KEY',
        hash_control: result.hash ? '1' : '0',
        previous_hash: previousHash || null,
        status: 'N',
        issue_date: issueDate,
        system_entry_date: result.systemEntryDate,
        issuer_nif: issuerNIF,
        issuer_name: issuerName || '',
        issuer_address: issuerAddress || '',
        issuer_city: issuerCity || '',
        issuer_postal_code: issuerPostalCode || '',
        client_nif: clientNIF || '999999990',
        client_name: clientName || 'Consumidor Final',
        client_address: clientAddress || '',
        client_city: clientCity || '',
        client_postal_code: clientPostalCode || '',
        client_country: clientCountry || 'PT',
        net_total: result.taxBreakdown.totalBase,
        tax_total: result.taxBreakdown.totalTax,
        gross_total: result.taxBreakdown.grossTotal,
        tax_exempt_base: result.taxBreakdown.exemptBase,
        reduced_rate_base: result.taxBreakdown.reducedBase,
        reduced_rate_tax: result.taxBreakdown.reducedTax,
        intermediate_rate_base: result.taxBreakdown.intermediateBase,
        intermediate_rate_tax: result.taxBreakdown.intermediateTax,
        normal_rate_base: result.taxBreakdown.normalBase,
        normal_rate_tax: result.taxBreakdown.normalTax,
        qr_code_string: result.qrCodeString,
        fiscal_space: fiscalSpace || 'PT',
        lines: invoiceLines.map((l, i) => ({
          line_number: i + 1,
          product_code: `SRV${String(i + 1).padStart(3, '0')}`,
          description: l.description,
          quantity: l.quantity,
          unit: 'UN',
          unit_price: l.unitPrice,
          tax_rate: l.taxRate,
          line_total: l.lineTotal,
        })),
      })

    if (insertErr) {
      logger.error('[portugal-fiscal] Failed to insert document:', insertErr.message)
      return NextResponse.json({ error: 'Erro ao registar documento fiscal' }, { status: 500 })
    }

    // ── Return fiscal data for PDF generation ──
    return NextResponse.json({
      success: true,
      fiscal: {
        docNumber: result.docNumber,
        sequentialNumber: result.sequentialNumber,
        hash: result.hash,
        hashDisplay: result.hashDisplay,
        atcud: result.atcud,
        atcudDisplay: result.atcudDisplay,
        qrCodeString: result.qrCodeString,
        certNumber: result.certNumber,
        systemEntryDate: result.systemEntryDate,
        taxBreakdown: result.taxBreakdown,
      },
    })
  } catch (err) {
    logger.error('[portugal-fiscal] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
