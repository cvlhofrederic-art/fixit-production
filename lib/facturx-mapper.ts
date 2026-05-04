// ═══════════════════════════════════════════════
// FACTUR-X CII XML MAPPER
// Maps FacturXMappingInput → Cross-Industry Invoice XML (EN 16931)
// Profile: BASIC (suffisant pour artisans BTP)
// Spec : Factur-X 1.0.07 / ZUGFeRD 2.3 (FNFE-MPE + FeRD, sept 2024)
//
// HOTFIX AUDIT INTERNE 04/05/2026 :
//   - Type d'entrée explicite FacturXMappingInput (sous-ensemble strict de
//     DevisFactureData) au lieu d'un cast `as unknown as DevisFactureData`
//     côté caller qui masquait des champs manquants → crash silencieux.
//   - Calculs avec round2/sumMoney from lib/money (BOFiP §50, anti-drift).
//   - Line qty escapé via String() (anti-injection XML par type coercion).
//   - BT-10 BuyerReference ajouté (champ obligatoire EN 16931 BASIC).
//   - Bloc IncludedNote retiré si notes vide (XML plus propre).
// ═══════════════════════════════════════════════

import { round2, sumMoney, mulMoney } from './money'

// ── Type d'entrée strict ──
// Tous les champs accédés par le mapper sont OBLIGATOIRES ici. Si un caller
// oublie un champ, TypeScript le rejette à la compilation au lieu de crash
// silencieux à runtime via `esc(undefined)`.
export interface FacturXMappingInput {
  // Document
  docNumber: string
  docDate: string             // ISO YYYY-MM-DD
  docType: 'devis' | 'facture'
  paymentDue?: string         // ISO ou nombre de jours
  notes?: string
  // Émetteur
  companyName: string
  companySiret: string
  companyAddress: string
  companyEmail: string        // requis (BT-43 SellerEmail)
  tvaEnabled: boolean
  tvaNumber?: string
  // Destinataire
  clientName: string
  clientSiret?: string
  clientAddress: string
  clientEmail?: string
  buyerReference?: string     // BT-10 (obligatoire BASIC FR-PPF)
  // Paiement
  paymentMode?: string
  iban?: string
  bic?: string
  // Lignes
  lines: Array<{
    description: string
    qty: number
    unit: string
    priceHT: number
    totalHT: number
    tvaRate: number
  }>
}

// ── UN/ECE 5153 Tax category codes ──
function getTaxCategoryCode(rate: number): string {
  if (rate === 0) return 'E' // Exempt
  return 'S' // Standard
}

// ── UN/ECE 4461 Payment means codes ──
function getPaymentMeansCode(paymentMode: string): string {
  const mode = (paymentMode || '').toLowerCase()
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

// ── XML escaping (5 entités XML standard + control chars) ──
function esc(str: string | number | null | undefined): string {
  const s = String(str ?? '')
  return s
    // Strip control chars (corruption XML)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Date formatting (YYYYMMDD pour CII) ──
function formatCIIDate(dateStr: string): string {
  // Accepte ISO YYYY-MM-DD ; ignore les autres formats (fallback aujourd'hui)
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr || '')) {
    return dateStr.substring(0, 10).replace(/-/g, '')
  }
  // Fallback : aujourd'hui
  return new Date().toISOString().substring(0, 10).replace(/-/g, '')
}

// ── Tax breakdown by rate ──
interface TaxGroup {
  rate: number
  categoryCode: string
  basisAmount: number
  taxAmount: number
}

function computeTaxGroups(
  lines: FacturXMappingInput['lines'],
  tvaEnabled: boolean,
): TaxGroup[] {
  if (!tvaEnabled) {
    const totalHT = sumMoney(lines.map(l => l.totalHT))
    return [{ rate: 0, categoryCode: 'E', basisAmount: totalHT, taxAmount: 0 }]
  }

  // Agrégation par taux : on accumule la base brute puis on arrondit
  // par taux APRÈS pour que le XML corresponde au PDF visuel (qui fait
  // pareil via lib/money.ts).
  const accBase = new Map<number, number>()
  for (const line of lines) {
    const rate = line.tvaRate || 0
    accBase.set(rate, round2((accBase.get(rate) || 0) + (line.totalHT || 0)))
  }
  const groups: TaxGroup[] = []
  accBase.forEach((basisAmount, rate) => {
    groups.push({
      rate,
      categoryCode: getTaxCategoryCode(rate),
      basisAmount,
      taxAmount: mulMoney(basisAmount, rate / 100),
    })
  })
  return groups.sort((a, b) => b.rate - a.rate)
}

// ── Format amount à 2 décimales (round2 avant formatage) ──
function amt(n: number): string {
  return round2(n || 0).toFixed(2)
}

// ═══════════════════════════════════════════════
// MAIN EXPORT: Generate Factur-X XML (CII)
// ═══════════════════════════════════════════════

export function generateFacturXML(data: FacturXMappingInput): string {
  // Defense-in-depth : un devis ne devrait jamais être encodé en CII
  // (TypeCode 325 = Proforma, pas un format facture). Le caller filtre
  // déjà côté V3 mais on bloque ici aussi.
  if (data.docType !== 'facture') {
    throw new Error('Factur-X ne supporte que les factures (TypeCode 380)')
  }

  const taxGroups = computeTaxGroups(data.lines, data.tvaEnabled)
  const subtotalHT = sumMoney(data.lines.map(l => l.totalHT))
  const totalTVA = sumMoney(taxGroups.map(g => g.taxAmount))
  const totalTTC = round2(subtotalHT + totalTVA)

  // Due date: paymentDue ISO ou docDate par défaut
  const dueDate = (data.paymentDue && /^\d{4}-\d{2}-\d{2}/.test(data.paymentDue))
    ? data.paymentDue
    : data.docDate

  // BT-10 BuyerReference : obligatoire BASIC FR-PPF. Fallback sur SIRET
  // client (pour les pros) puis email puis "N/A" (devrait être renseigné
  // côté form pour être conforme à 100 %).
  const buyerRef = data.buyerReference
    || data.clientSiret
    || data.clientEmail
    || 'N/A'

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
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">${formatCIIDate(data.docDate)}</udt:DateTimeString>
    </ram:IssueDateTime>${data.notes && data.notes.trim() ? `
    <ram:IncludedNote>
      <ram:Content>${esc(data.notes)}</ram:Content>
    </ram:IncludedNote>` : ''}
  </rsm:ExchangedDocument>

  <!-- ═══ SUPPLY CHAIN ═══ -->
  <rsm:SupplyChainTradeTransaction>

    <!-- ── LINE ITEMS ── -->
${data.lines.map((line, i) => `    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument>
        <ram:LineID>${i + 1}</ram:LineID>
      </ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct>
        <ram:Name>${esc((line.description || '').replace(/\n/g, ' '))}</ram:Name>
      </ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement>
        <ram:NetPriceProductTradePrice>
          <ram:ChargeAmount>${amt(line.priceHT)}</ram:ChargeAmount>
        </ram:NetPriceProductTradePrice>
      </ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery>
        <ram:BilledQuantity unitCode="${getUnitCode(line.unit)}">${esc(Number(line.qty) || 0)}</ram:BilledQuantity>
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
      <!-- BT-10 Buyer Reference (obligatoire BASIC FR-PPF) -->
      <ram:BuyerReference>${esc(buyerRef)}</ram:BuyerReference>
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
