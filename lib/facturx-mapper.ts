// ═══════════════════════════════════════════════
// FACTUR-X CII XML MAPPER
// Maps DevisFactureData → Cross-Industry Invoice XML (EN 16931)
// Profile: BASIC (sufficient for artisans BTP)
// ═══════════════════════════════════════════════

import type { DevisFactureData, ProductLine } from './devis-types'

// ── UN/ECE 5153 Tax category codes ──
function getTaxCategoryCode(rate: number): string {
  if (rate === 0) return 'E' // Exempt
  return 'S' // Standard
}

// ── UN/ECE 4461 Payment means codes ──
function getPaymentMeansCode(paymentMode: string): string {
  const mode = paymentMode.toLowerCase()
  if (mode.includes('virement')) return '30' // Credit transfer
  if (mode.includes('carte')) return '48' // Bank card
  if (mode.includes('chèque') || mode.includes('cheque')) return '20' // Cheque
  if (mode.includes('espèce') || mode.includes('espece')) return '10' // Cash
  if (mode.includes('prélèvement') || mode.includes('prelevement')) return '49' // Direct debit
  return '30' // Default: credit transfer
}

// ── UN/ECE Rec 20 unit codes ──
function getUnitCode(unit: string): string {
  const map: Record<string, string> = {
    'u': 'C62',    // One (unit)
    'm2': 'MTK',   // Square metre
    'ml': 'MTR',   // Metre (linear)
    'm3': 'MTQ',   // Cubic metre
    'h': 'HUR',    // Hour
    'j': 'DAY',    // Day
    'f': 'C62',    // Forfait → unit
    'lot': 'C62',  // Lot → unit
    'm': 'MTR',    // Metre
    'kg': 'KGM',   // Kilogram
    'L': 'LTR',    // Litre
    't': 'TNE',    // Tonne
    'pce': 'C62',  // Pièce → unit
    'ens': 'C62',  // Ensemble → unit
    'pt': 'C62',   // Point → unit
  }
  return map[unit] || 'C62'
}

// ── XML escaping ──
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Date formatting (YYYYMMDD for CII) ──
function formatCIIDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

// ── Tax breakdown by rate ──
interface TaxGroup {
  rate: number
  categoryCode: string
  basisAmount: number
  taxAmount: number
}

function computeTaxGroups(lines: ProductLine[], tvaEnabled: boolean): TaxGroup[] {
  if (!tvaEnabled) {
    const totalHT = lines.reduce((s, l) => s + l.totalHT, 0)
    return [{
      rate: 0,
      categoryCode: 'E',
      basisAmount: totalHT,
      taxAmount: 0,
    }]
  }

  const groups = new Map<number, TaxGroup>()
  for (const line of lines) {
    const rate = line.tvaRate || 0
    const existing = groups.get(rate)
    if (existing) {
      existing.basisAmount += line.totalHT
      existing.taxAmount += line.totalHT * rate / 100
    } else {
      groups.set(rate, {
        rate,
        categoryCode: getTaxCategoryCode(rate),
        basisAmount: line.totalHT,
        taxAmount: line.totalHT * rate / 100,
      })
    }
  }
  return Array.from(groups.values())
}

// ── Format amount to 2 decimal places ──
function amt(n: number): string {
  return n.toFixed(2)
}

// ═══════════════════════════════════════════════
// MAIN EXPORT: Generate Factur-X XML (CII)
// ═══════════════════════════════════════════════

export function generateFacturXML(data: DevisFactureData): string {
  const taxGroups = computeTaxGroups(data.lines, data.tvaEnabled)
  const subtotalHT = data.lines.reduce((s, l) => s + l.totalHT, 0)
  const totalTVA = taxGroups.reduce((s, g) => s + g.taxAmount, 0)
  const totalTTC = subtotalHT + totalTVA

  // Due date: use paymentDue or docDate + 30 days
  const dueDate = data.paymentDue || data.docDate

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">

  <!-- ═══ CONTEXT ═══ -->
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>

  <!-- ═══ DOCUMENT HEADER ═══ -->
  <rsm:ExchangedDocument>
    <ram:ID>${esc(data.docNumber)}</ram:ID>
    <ram:TypeCode>${data.docType === 'facture' ? '380' : '325'}</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatCIIDate(data.docDate)}</udt:DateTimeString>
    </ram:IssueDateTime>
    <ram:IncludedNote>
      <ram:Content>${esc(data.notes || '')}</ram:Content>
    </ram:IncludedNote>
  </rsm:ExchangedDocument>

  <!-- ═══ SUPPLY CHAIN ═══ -->
  <rsm:SupplyChainTradeTransaction>

    <!-- ── LINE ITEMS ── -->
${data.lines.map((line, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc(line.description.replace(/\n/g, ' '))}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amt(line.priceHT)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${getUnitCode(line.unit)}">${line.qty}</ram:BilledQuantity>
      </ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax>
          <ram:TypeCode>VAT</ram:TypeCode>
          <ram:CategoryCode>${getTaxCategoryCode(data.tvaEnabled ? line.tvaRate : 0)}</ram:CategoryCode>
          <ram:RateApplicablePercent>${data.tvaEnabled ? amt(line.tvaRate) : '0.00'}</ram:RateApplicablePercent>
        </ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation>
          <ram:LineTotalAmount>${amt(line.totalHT)}</ram:LineTotalAmount>
        </ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join('\n')}

    <!-- ── HEADER TRADE AGREEMENT ── -->
    <ram:ApplicableHeaderTradeAgreement>
      <!-- Seller -->
      <ram:SellerTradeParty>
        <ram:Name>${esc(data.companyName)}</ram:Name>
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(data.companySiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>
        <ram:PostalTradeAddress>
          <ram:LineOne>${esc(data.companyAddress)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${esc(data.companyEmail)}</ram:URIID>
        </ram:URIUniversalCommunication>${data.tvaEnabled && data.tvaNumber ? `
        <ram:SpecifiedTaxRegistration>
          <ram:ID schemeID="VA">${esc(data.tvaNumber)}</ram:ID>
        </ram:SpecifiedTaxRegistration>` : ''}
      </ram:SellerTradeParty>

      <!-- Buyer -->
      <ram:BuyerTradeParty>
        <ram:Name>${esc(data.clientName)}</ram:Name>${data.clientSiret ? `
        <ram:SpecifiedLegalOrganization>
          <ram:ID schemeID="0002">${esc(data.clientSiret)}</ram:ID>
        </ram:SpecifiedLegalOrganization>` : ''}
        <ram:PostalTradeAddress>
          <ram:LineOne>${esc(data.clientAddress)}</ram:LineOne>
          <ram:CountryID>FR</ram:CountryID>
        </ram:PostalTradeAddress>${data.clientEmail ? `
        <ram:URIUniversalCommunication>
          <ram:URIID schemeID="EM">${esc(data.clientEmail)}</ram:URIID>
        </ram:URIUniversalCommunication>` : ''}
      </ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>

    <!-- ── DELIVERY ── -->
    <ram:ApplicableHeaderTradeDelivery/>

    <!-- ── SETTLEMENT ── -->
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>

      <!-- Payment means -->
      <ram:SpecifiedTradeSettlementPaymentMeans>
        <ram:TypeCode>${getPaymentMeansCode(data.paymentMode || 'Virement bancaire')}</ram:TypeCode>${data.iban ? `
        <ram:PayeePartyCreditorFinancialAccount>
          <ram:IBANID>${esc(data.iban)}</ram:IBANID>
        </ram:PayeePartyCreditorFinancialAccount>` : ''}${data.bic ? `
        <ram:PayeeSpecifiedCreditorFinancialInstitution>
          <ram:BICID>${esc(data.bic)}</ram:BICID>
        </ram:PayeeSpecifiedCreditorFinancialInstitution>` : ''}
      </ram:SpecifiedTradeSettlementPaymentMeans>

      <!-- Tax breakdown -->
${taxGroups.map(g => `      <ram:ApplicableTradeTax>
        <ram:CalculatedAmount>${amt(g.taxAmount)}</ram:CalculatedAmount>
        <ram:TypeCode>VAT</ram:TypeCode>
        <ram:BasisAmount>${amt(g.basisAmount)}</ram:BasisAmount>
        <ram:CategoryCode>${g.categoryCode}</ram:CategoryCode>
        <ram:RateApplicablePercent>${amt(g.rate)}</ram:RateApplicablePercent>
      </ram:ApplicableTradeTax>`).join('\n')}

      <!-- Payment terms -->
      <ram:SpecifiedTradePaymentTerms>
        <ram:DueDateDateTime>
          <udt:DateTimeString format="102">${formatCIIDate(dueDate)}</udt:DateTimeString>
        </ram:DueDateDateTime>
      </ram:SpecifiedTradePaymentTerms>

      <!-- Totals -->
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
        <ram:LineTotalAmount>${amt(subtotalHT)}</ram:LineTotalAmount>
        <ram:TaxBasisTotalAmount>${amt(subtotalHT)}</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">${amt(totalTVA)}</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>${amt(totalTTC)}</ram:GrandTotalAmount>
        <ram:DuePayableAmount>${amt(totalTTC)}</ram:DuePayableAmount>
      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>

  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`

  return xml
}
