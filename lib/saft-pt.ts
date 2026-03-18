// ══════════════════════════════════════════════════════════════════════════════
// SAF-T PT (Standard Audit File for Tax Purposes — Portugal)
// ══════════════════════════════════════════════════════════════════════════════
// Generates XML files compliant with Portaria n.º 321-A/2007 (as amended)
// for submission to AT (Autoridade Tributária e Aduaneira).
//
// This module produces SAF-T PT version 1.04_01 XML.
// ══════════════════════════════════════════════════════════════════════════════

import { AT_CERT_NUMBER, type PTDocType, type PTDocStatus, type FiscalSpace } from './portugal-fiscal'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SAFTHeader {
  auditFileVersion: string    // "1.04_01"
  companyID: string           // NIF do contribuinte
  taxRegistrationNumber: string // NIF
  taxAccountingBasis: string  // "F" for faturação
  companyName: string
  companyAddress: {
    street: string
    city: string
    postalCode: string
    country: string           // "PT"
  }
  fiscalYear: number
  dateCreated: string         // YYYY-MM-DD
  taxEntity: string           // "Global"
  productCompanyTaxID: string // NIF de la société éditrice du logiciel
  softwareCertificateNumber: string // AT cert number
  productID: string           // "Vitfix Pro/Vitfix SAS"
  productVersion: string      // "1.0"
  startDate: string           // YYYY-MM-DD (début de la période)
  endDate: string             // YYYY-MM-DD (fin de la période)
  currencyCode: string        // "EUR"
}

export interface SAFTCustomer {
  customerID: string
  customerTaxID: string       // NIF, or "999999990" for final consumer
  companyName: string
  billingAddress: {
    street: string
    city: string
    postalCode: string
    country: string
  }
}

export interface SAFTProduct {
  productType: string         // "S" for service, "P" for product
  productCode: string
  productDescription: string
  productNumberCode: string
}

export interface SAFTTaxEntry {
  taxType: string             // "IVA"
  taxCountryRegion: string    // "PT", "PT-AC", "PT-MA"
  taxCode: string             // "NOR", "INT", "RED", "ISE"
  taxPercentage: number
}

export interface SAFTInvoiceLine {
  lineNumber: number
  productCode: string
  quantity: number
  unitOfMeasure: string
  unitPrice: number
  description: string
  creditAmount?: number       // For invoices
  debitAmount?: number        // For credit notes
  tax: SAFTTaxEntry
  taxExemptionReason?: string // When tax rate is 0
  taxExemptionCode?: string   // e.g., "M01" for art. 53.º CIVA
  settlementAmount?: number
}

export interface SAFTInvoice {
  invoiceNo: string           // "FT VTF/1"
  atcud: string
  documentStatus: {
    invoiceStatus: PTDocStatus
    invoiceStatusDate: string // YYYY-MM-DDTHH:MM:SS
    sourceID: string          // User who created
    sourceBilling: string     // "P" (program)
  }
  hash: string                // Full RSA hash
  hashControl: string         // "1" if hash is present
  period: number              // Month (1-12)
  invoiceDate: string         // YYYY-MM-DD
  invoiceType: PTDocType
  specialRegimes: {
    selfBillingIndicator: number  // 0
    cashVATSchemeIndicator: number // 0
    thirdPartiesBillingIndicator: number // 0
  }
  sourceID: string            // Artisan ID or email
  systemEntryDate: string     // YYYY-MM-DDTHH:MM:SS
  customerID: string
  lines: SAFTInvoiceLine[]
  documentTotals: {
    taxPayable: number
    netTotal: number
    grossTotal: number
  }
}

export interface SAFTData {
  header: SAFTHeader
  customers: SAFTCustomer[]
  products: SAFTProduct[]
  taxTable: SAFTTaxEntry[]
  invoices: SAFTInvoice[]
}

// ─── XML Helpers ────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function xmlTag(name: string, value: string | number, indent: number = 0): string {
  const pad = '  '.repeat(indent)
  return `${pad}<${name}>${escapeXml(String(value))}</${name}>`
}

// ─── Tax Code Mapping ───────────────────────────────────────────────────────

export function getTaxCode(taxRate: number): string {
  if (taxRate === 0) return 'ISE'         // Isento
  if (taxRate <= 6) return 'RED'          // Reduzida
  if (taxRate <= 13) return 'INT'         // Intermédia
  return 'NOR'                            // Normal
}

export function getTaxExemptionCode(reason?: string): string {
  // M01 = Art. 53.º CIVA (regime de isenção para pequenas empresas)
  // M02 = Art. 6.º do CIVA
  // M04 = Isento art. 13.º do CIVA
  // M05 = Isento art. 14.º do CIVA
  // M06 = Isento art. 15.º do CIVA
  // M07 = Isento art. 9.º do CIVA
  // M09 = IVA não confere direito a dedução
  // M10 = IVA regime de isenção
  // M99 = Não sujeito / outras
  if (reason?.includes('53')) return 'M01'
  return 'M01' // Default to art. 53.º for small business
}

// ─── SAF-T PT XML Generator ─────────────────────────────────────────────────

/**
 * Generate a complete SAF-T PT XML file.
 *
 * @param data - All the structured data for the SAF-T file
 * @returns XML string ready for submission to AT
 */
export function generateSAFTXML(data: SAFTData): string {
  const lines: string[] = []

  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01"')
  lines.push('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">')

  // ── Header ──
  lines.push('  <Header>')
  lines.push(xmlTag('AuditFileVersion', data.header.auditFileVersion, 2))
  lines.push(xmlTag('CompanyID', data.header.companyID, 2))
  lines.push(xmlTag('TaxRegistrationNumber', data.header.taxRegistrationNumber, 2))
  lines.push(xmlTag('TaxAccountingBasis', data.header.taxAccountingBasis, 2))
  lines.push(xmlTag('CompanyName', data.header.companyName, 2))
  lines.push('    <CompanyAddress>')
  lines.push(xmlTag('AddressDetail', data.header.companyAddress.street, 3))
  lines.push(xmlTag('City', data.header.companyAddress.city, 3))
  lines.push(xmlTag('PostalCode', data.header.companyAddress.postalCode, 3))
  lines.push(xmlTag('Country', data.header.companyAddress.country, 3))
  lines.push('    </CompanyAddress>')
  lines.push(xmlTag('FiscalYear', data.header.fiscalYear, 2))
  lines.push(xmlTag('DateCreated', data.header.dateCreated, 2))
  lines.push(xmlTag('TaxEntity', data.header.taxEntity, 2))
  lines.push(xmlTag('ProductCompanyTaxID', data.header.productCompanyTaxID, 2))
  lines.push(xmlTag('SoftwareCertificateNumber', data.header.softwareCertificateNumber, 2))
  lines.push(xmlTag('ProductID', data.header.productID, 2))
  lines.push(xmlTag('ProductVersion', data.header.productVersion, 2))
  lines.push(xmlTag('HeaderComment', 'Generated by Vitfix Pro — https://vitfix.io', 2))
  lines.push(xmlTag('StartDate', data.header.startDate, 2))
  lines.push(xmlTag('EndDate', data.header.endDate, 2))
  lines.push(xmlTag('CurrencyCode', data.header.currencyCode, 2))
  lines.push('  </Header>')

  // ── MasterFiles ──
  lines.push('  <MasterFiles>')

  // Customers
  for (const customer of data.customers) {
    lines.push('    <Customer>')
    lines.push(xmlTag('CustomerID', customer.customerID, 3))
    lines.push(xmlTag('AccountID', 'Desconhecido', 3))
    lines.push(xmlTag('CustomerTaxID', customer.customerTaxID, 3))
    lines.push(xmlTag('CompanyName', customer.companyName, 3))
    lines.push('      <BillingAddress>')
    lines.push(xmlTag('AddressDetail', customer.billingAddress.street || 'Desconhecido', 4))
    lines.push(xmlTag('City', customer.billingAddress.city || 'Desconhecido', 4))
    lines.push(xmlTag('PostalCode', customer.billingAddress.postalCode || '0000-000', 4))
    lines.push(xmlTag('Country', customer.billingAddress.country || 'PT', 4))
    lines.push('      </BillingAddress>')
    lines.push(xmlTag('SelfBillingIndicator', 0, 3))
    lines.push('    </Customer>')
  }

  // Products
  for (const product of data.products) {
    lines.push('    <Product>')
    lines.push(xmlTag('ProductType', product.productType, 3))
    lines.push(xmlTag('ProductCode', product.productCode, 3))
    lines.push(xmlTag('ProductDescription', product.productDescription, 3))
    lines.push(xmlTag('ProductNumberCode', product.productNumberCode, 3))
    lines.push('    </Product>')
  }

  // Tax Table
  lines.push('    <TaxTable>')
  for (const tax of data.taxTable) {
    lines.push('      <TaxTableEntry>')
    lines.push(xmlTag('TaxType', tax.taxType, 4))
    lines.push(xmlTag('TaxCountryRegion', tax.taxCountryRegion, 4))
    lines.push(xmlTag('TaxCode', tax.taxCode, 4))
    lines.push(xmlTag('Description', `IVA - ${tax.taxCode}`, 4))
    lines.push(xmlTag('TaxPercentage', tax.taxPercentage.toFixed(2), 4))
    lines.push('      </TaxTableEntry>')
  }
  lines.push('    </TaxTable>')

  lines.push('  </MasterFiles>')

  // ── SourceDocuments ──
  lines.push('  <SourceDocuments>')

  if (data.invoices.length > 0) {
    lines.push('    <SalesInvoices>')
    lines.push(xmlTag('NumberOfEntries', data.invoices.length, 3))

    // Total debit/credit
    const totalDebit = data.invoices
      .filter(i => i.invoiceType === 'NC')
      .reduce((sum, i) => sum + i.documentTotals.grossTotal, 0)
    const totalCredit = data.invoices
      .filter(i => i.invoiceType !== 'NC')
      .reduce((sum, i) => sum + i.documentTotals.grossTotal, 0)

    lines.push(xmlTag('TotalDebit', totalDebit.toFixed(2), 3))
    lines.push(xmlTag('TotalCredit', totalCredit.toFixed(2), 3))

    for (const invoice of data.invoices) {
      lines.push('      <Invoice>')
      lines.push(xmlTag('InvoiceNo', invoice.invoiceNo, 4))
      lines.push(xmlTag('ATCUD', invoice.atcud, 4))

      // DocumentStatus
      lines.push('        <DocumentStatus>')
      lines.push(xmlTag('InvoiceStatus', invoice.documentStatus.invoiceStatus, 5))
      lines.push(xmlTag('InvoiceStatusDate', invoice.documentStatus.invoiceStatusDate, 5))
      lines.push(xmlTag('SourceID', invoice.documentStatus.sourceID, 5))
      lines.push(xmlTag('SourceBilling', invoice.documentStatus.sourceBilling, 5))
      lines.push('        </DocumentStatus>')

      lines.push(xmlTag('Hash', invoice.hash, 4))
      lines.push(xmlTag('HashControl', invoice.hashControl, 4))
      lines.push(xmlTag('Period', invoice.period, 4))
      lines.push(xmlTag('InvoiceDate', invoice.invoiceDate, 4))
      lines.push(xmlTag('InvoiceType', invoice.invoiceType, 4))

      // SpecialRegimes
      lines.push('        <SpecialRegimes>')
      lines.push(xmlTag('SelfBillingIndicator', invoice.specialRegimes.selfBillingIndicator, 5))
      lines.push(xmlTag('CashVATSchemeIndicator', invoice.specialRegimes.cashVATSchemeIndicator, 5))
      lines.push(xmlTag('ThirdPartiesBillingIndicator', invoice.specialRegimes.thirdPartiesBillingIndicator, 5))
      lines.push('        </SpecialRegimes>')

      lines.push(xmlTag('SourceID', invoice.sourceID, 4))
      lines.push(xmlTag('SystemEntryDate', invoice.systemEntryDate, 4))
      lines.push(xmlTag('CustomerID', invoice.customerID, 4))

      // Lines
      for (const line of invoice.lines) {
        lines.push('        <Line>')
        lines.push(xmlTag('LineNumber', line.lineNumber, 5))

        // OrderReferences not mandatory for now
        lines.push(xmlTag('ProductCode', line.productCode, 5))
        lines.push(xmlTag('ProductDescription', line.description, 5))
        lines.push(xmlTag('Quantity', line.quantity.toFixed(2), 5))
        lines.push(xmlTag('UnitOfMeasure', line.unitOfMeasure, 5))
        lines.push(xmlTag('UnitPrice', line.unitPrice.toFixed(4), 5))

        if (line.creditAmount !== undefined) {
          lines.push(xmlTag('CreditAmount', line.creditAmount.toFixed(2), 5))
        }
        if (line.debitAmount !== undefined) {
          lines.push(xmlTag('DebitAmount', line.debitAmount.toFixed(2), 5))
        }

        // Tax
        lines.push('          <Tax>')
        lines.push(xmlTag('TaxType', line.tax.taxType, 6))
        lines.push(xmlTag('TaxCountryRegion', line.tax.taxCountryRegion, 6))
        lines.push(xmlTag('TaxCode', line.tax.taxCode, 6))
        lines.push(xmlTag('TaxPercentage', line.tax.taxPercentage.toFixed(2), 6))
        lines.push('          </Tax>')

        if (line.taxExemptionReason) {
          lines.push(xmlTag('TaxExemptionReason', line.taxExemptionReason, 5))
        }
        if (line.taxExemptionCode) {
          lines.push(xmlTag('TaxExemptionCode', line.taxExemptionCode, 5))
        }

        if (line.settlementAmount !== undefined && line.settlementAmount > 0) {
          lines.push('          <SettlementAmount>' + line.settlementAmount.toFixed(2) + '</SettlementAmount>')
        }

        lines.push('        </Line>')
      }

      // DocumentTotals
      lines.push('        <DocumentTotals>')
      lines.push(xmlTag('TaxPayable', invoice.documentTotals.taxPayable.toFixed(2), 5))
      lines.push(xmlTag('NetTotal', invoice.documentTotals.netTotal.toFixed(2), 5))
      lines.push(xmlTag('GrossTotal', invoice.documentTotals.grossTotal.toFixed(2), 5))
      lines.push('        </DocumentTotals>')

      lines.push('      </Invoice>')
    }

    lines.push('    </SalesInvoices>')
  }

  lines.push('  </SourceDocuments>')
  lines.push('</AuditFile>')

  return lines.join('\n')
}

// ─── Helper: Build SAF-T data from database records ─────────────────────────

export interface FiscalDocumentRecord {
  id: string
  artisan_id: string
  doc_type: PTDocType
  doc_number: string
  atcud: string
  hash: string
  status: PTDocStatus
  issue_date: string
  system_entry_date: string
  issuer_nif: string
  issuer_name: string
  issuer_address: string
  issuer_city: string
  issuer_postal_code: string
  client_id: string
  client_nif: string
  client_name: string
  client_address: string
  client_city: string
  client_postal_code: string
  client_country: string
  fiscal_space: FiscalSpace
  net_total: number
  tax_total: number
  gross_total: number
  lines: Array<{
    line_number: number
    product_code: string
    description: string
    quantity: number
    unit: string
    unit_price: number
    tax_rate: number
    line_total: number
    tax_exemption_reason?: string
  }>
}

/**
 * Build complete SAF-T data structure from database records.
 * Ready to be passed to generateSAFTXML().
 */
export function buildSAFTData(
  companyInfo: {
    nif: string
    name: string
    address: string
    city: string
    postalCode: string
  },
  documents: FiscalDocumentRecord[],
  period: { startDate: string; endDate: string }
): SAFTData {
  const fiscalYear = new Date(period.startDate).getFullYear()

  // Build unique customers
  const customerMap = new Map<string, SAFTCustomer>()
  for (const doc of documents) {
    if (!customerMap.has(doc.client_id)) {
      customerMap.set(doc.client_id, {
        customerID: doc.client_id,
        customerTaxID: doc.client_nif || '999999990',
        companyName: doc.client_name || 'Consumidor Final',
        billingAddress: {
          street: doc.client_address || 'Desconhecido',
          city: doc.client_city || 'Desconhecido',
          postalCode: doc.client_postal_code || '0000-000',
          country: doc.client_country || 'PT',
        },
      })
    }
  }

  // Build unique products
  const productMap = new Map<string, SAFTProduct>()
  for (const doc of documents) {
    for (const line of doc.lines) {
      if (!productMap.has(line.product_code)) {
        productMap.set(line.product_code, {
          productType: 'S', // Services
          productCode: line.product_code,
          productDescription: line.description,
          productNumberCode: line.product_code,
        })
      }
    }
  }

  // Tax table — standard PT rates
  const taxTable: SAFTTaxEntry[] = [
    { taxType: 'IVA', taxCountryRegion: 'PT', taxCode: 'NOR', taxPercentage: 23 },
    { taxType: 'IVA', taxCountryRegion: 'PT', taxCode: 'INT', taxPercentage: 13 },
    { taxType: 'IVA', taxCountryRegion: 'PT', taxCode: 'RED', taxPercentage: 6 },
    { taxType: 'IVA', taxCountryRegion: 'PT', taxCode: 'ISE', taxPercentage: 0 },
  ]

  // Build invoices
  const invoices: SAFTInvoice[] = documents.map(doc => ({
    invoiceNo: doc.doc_number,
    atcud: doc.atcud,
    documentStatus: {
      invoiceStatus: doc.status,
      invoiceStatusDate: doc.system_entry_date,
      sourceID: doc.artisan_id,
      sourceBilling: 'P', // Program
    },
    hash: doc.hash,
    hashControl: doc.hash ? '1' : '0',
    period: new Date(doc.issue_date).getMonth() + 1,
    invoiceDate: doc.issue_date,
    invoiceType: doc.doc_type,
    specialRegimes: {
      selfBillingIndicator: 0,
      cashVATSchemeIndicator: 0,
      thirdPartiesBillingIndicator: 0,
    },
    sourceID: doc.artisan_id,
    systemEntryDate: doc.system_entry_date,
    customerID: doc.client_id,
    lines: doc.lines.map(line => ({
      lineNumber: line.line_number,
      productCode: line.product_code,
      quantity: line.quantity,
      unitOfMeasure: line.unit,
      unitPrice: line.unit_price,
      description: line.description,
      creditAmount: doc.doc_type !== 'NC' ? line.line_total : undefined,
      debitAmount: doc.doc_type === 'NC' ? line.line_total : undefined,
      tax: {
        taxType: 'IVA',
        taxCountryRegion: doc.fiscal_space || 'PT',
        taxCode: getTaxCode(line.tax_rate),
        taxPercentage: line.tax_rate,
      },
      taxExemptionReason: line.tax_rate === 0 ? (line.tax_exemption_reason || 'Artigo 53.º do CIVA') : undefined,
      taxExemptionCode: line.tax_rate === 0 ? getTaxExemptionCode(line.tax_exemption_reason) : undefined,
    })),
    documentTotals: {
      taxPayable: doc.tax_total,
      netTotal: doc.net_total,
      grossTotal: doc.gross_total,
    },
  }))

  return {
    header: {
      auditFileVersion: '1.04_01',
      companyID: companyInfo.nif,
      taxRegistrationNumber: companyInfo.nif,
      taxAccountingBasis: 'F', // Faturação
      companyName: companyInfo.name,
      companyAddress: {
        street: companyInfo.address,
        city: companyInfo.city,
        postalCode: companyInfo.postalCode,
        country: 'PT',
      },
      fiscalYear,
      dateCreated: new Date().toISOString().split('T')[0],
      taxEntity: 'Global',
      productCompanyTaxID: process.env.VITFIX_PT_NIF || '000000000',
      softwareCertificateNumber: AT_CERT_NUMBER,
      productID: 'Vitfix Pro/Vitfix SAS',
      productVersion: '1.0',
      startDate: period.startDate,
      endDate: period.endDate,
      currencyCode: 'EUR',
    },
    customers: Array.from(customerMap.values()),
    products: Array.from(productMap.values()),
    taxTable,
    invoices,
  }
}
