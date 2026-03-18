// ══════════════════════════════════════════════════════════════════════════════
// GET /api/portugal-fiscal/saft-export?start=YYYY-MM-DD&end=YYYY-MM-DD
// ══════════════════════════════════════════════════════════════════════════════
// Exports SAF-T PT XML file for a given period.
// Required for AT audits and monthly/annual submissions.
// ══════════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { buildSAFTData, generateSAFTXML, type FiscalDocumentRecord } from '@/lib/saft-pt'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  // ── Auth ──
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('start')
  const endDate = searchParams.get('end')

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Parâmetros start e end obrigatórios (YYYY-MM-DD)' }, { status: 400 })
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: 'Formato de data inválido. Usar YYYY-MM-DD' }, { status: 400 })
  }

  try {
    // ── Fetch documents for the period ──
    const { data: documents, error } = await supabaseAdmin
      .from('pt_fiscal_documents')
      .select('*')
      .eq('artisan_id', user.id)
      .gte('issue_date', startDate)
      .lte('issue_date', endDate)
      .order('issue_date', { ascending: true })
      .order('seq_number', { ascending: true })

    if (error) {
      logger.error('[saft-export] Query error:', error.message)
      return NextResponse.json({ error: 'Erro ao consultar documentos' }, { status: 500 })
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json({ error: 'Nenhum documento encontrado no período indicado' }, { status: 404 })
    }

    // ── Get artisan company info ──
    const { data: artisan } = await supabaseAdmin
      .from('profiles_artisan')
      .select('company_name, siret, company_address, city, postal_code')
      .eq('user_id', user.id)
      .single()

    const companyInfo = {
      nif: artisan?.siret || documents[0].issuer_nif || '000000000',
      name: artisan?.company_name || documents[0].issuer_name || 'Empresa',
      address: artisan?.company_address || documents[0].issuer_address || '',
      city: artisan?.city || documents[0].issuer_city || '',
      postalCode: artisan?.postal_code || documents[0].issuer_postal_code || '',
    }

    // ── Map to SAF-T records ──
    const fiscalRecords: FiscalDocumentRecord[] = documents.map(doc => ({
      id: doc.id,
      artisan_id: doc.artisan_id,
      doc_type: doc.doc_type,
      doc_number: doc.doc_number,
      atcud: doc.atcud,
      hash: doc.hash,
      status: doc.status,
      issue_date: doc.issue_date,
      system_entry_date: doc.system_entry_date,
      issuer_nif: doc.issuer_nif,
      issuer_name: doc.issuer_name,
      issuer_address: doc.issuer_address,
      issuer_city: doc.issuer_city,
      issuer_postal_code: doc.issuer_postal_code,
      client_id: doc.client_nif || '999999990',
      client_nif: doc.client_nif,
      client_name: doc.client_name,
      client_address: doc.client_address,
      client_city: doc.client_city,
      client_postal_code: doc.client_postal_code,
      client_country: doc.client_country,
      fiscal_space: doc.fiscal_space,
      net_total: doc.net_total,
      tax_total: doc.tax_total,
      gross_total: doc.gross_total,
      lines: (doc.lines || []).map((line: Record<string, unknown>, idx: number) => ({
        line_number: Number(line.line_number) || idx + 1,
        product_code: String(line.product_code || `SRV${String(idx + 1).padStart(3, '0')}`),
        description: String(line.description || ''),
        quantity: Number(line.quantity || 0),
        unit: String(line.unit || 'UN'),
        unit_price: Number(line.unit_price || 0),
        tax_rate: Number(line.tax_rate || 0),
        line_total: Number(line.line_total || 0),
        tax_exemption_reason: line.tax_exemption_reason ? String(line.tax_exemption_reason) : undefined,
      })),
    }))

    // ── Generate SAF-T XML ──
    const saftData = buildSAFTData(companyInfo, fiscalRecords, { startDate, endDate })
    const xml = generateSAFTXML(saftData)

    // ── Return XML file ──
    const filename = `SAFT-PT_${companyInfo.nif}_${startDate}_${endDate}.xml`

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    logger.error('[saft-export] Unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
