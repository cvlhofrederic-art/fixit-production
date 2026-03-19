// ══════════════════════════════════════════════════════════════════════════════
// Portugal Fiscal Engine — AT (Autoridade Tributária) Compliance
// ══════════════════════════════════════════════════════════════════════════════
// Implements:
//   - RSA Hash Chain (Portaria n.º 363/2010)
//   - ATCUD generation (Decreto-Lei n.º 28/2019)
//   - QR Code fiscal (Portaria n.º 195/2020)
//   - Document validation for SAF-T PT compliance
//
// Requirements:
//   - Environment variables:
//     PT_FISCAL_PRIVATE_KEY   — PEM-encoded RSA private key (software key)
//     PT_FISCAL_PUBLIC_KEY    — PEM-encoded RSA public key (submitted to AT)
//     PT_FISCAL_CERT_NUMBER   — AT certification number (e.g., "1234/AT")
// ══════════════════════════════════════════════════════════════════════════════

import crypto from 'crypto'

// ─── Configuration ───────────────────────────────────────────────────────────

/** AT certification number — assigned after certification process */
export const AT_CERT_NUMBER = process.env.PT_FISCAL_CERT_NUMBER || '0000/AT'

/** Fiscal space codes */
export type FiscalSpace = 'PT' | 'PT-AC' | 'PT-MA'

/** Document types per SAF-T PT specification */
export type PTDocType =
  | 'FT'   // Fatura (Invoice)
  | 'FR'   // Fatura-Recibo (Invoice-Receipt)
  | 'FS'   // Fatura Simplificada (Simplified Invoice)
  | 'NC'   // Nota de Crédito (Credit Note)
  | 'ND'   // Nota de Débito (Debit Note)
  | 'OR'   // Orçamento (Quote — not mandatory but supported)

/** Document status codes */
export type PTDocStatus = 'N' | 'A' | 'F'
// N = Normal, A = Anulado (Cancelled), F = Faturado (Invoiced — for quotes)

/** IVA rates in Portugal */
export const PT_IVA_RATES = {
  normal: 23,        // Taxa normal
  intermediate: 13,  // Taxa intermédia
  reduced: 6,        // Taxa reduzida
  exempt: 0,         // Isento (art. 53.º CIVA)
} as const

/** IVA rates for Açores (PT-AC) */
export const PT_AC_IVA_RATES = {
  normal: 16,
  intermediate: 9,
  reduced: 4,
  exempt: 0,
} as const

/** IVA rates for Madeira (PT-MA) */
export const PT_MA_IVA_RATES = {
  normal: 22,
  intermediate: 12,
  reduced: 5,
  exempt: 0,
} as const

// ─── RSA Key Management ─────────────────────────────────────────────────────
// The software uses ONE RSA key pair for all documents (Portaria n.º 363/2010)
// The public key is submitted to AT during the certification process
// The private key is stored securely as an environment variable

/**
 * Get the software's private key from environment.
 * Returns null if not configured (development mode).
 */
function getPrivateKey(): string | null {
  return process.env.PT_FISCAL_PRIVATE_KEY || null
}

// ─── Hash Chain (Portaria n.º 363/2010) ─────────────────────────────────────
// Each document's hash = RSA-SHA1 signature of:
//   "{InvoiceDate};{SystemEntryDate};{InvoiceNo};{GrossTotal};{PreviousHash}"
//
// - InvoiceDate:     YYYY-MM-DD
// - SystemEntryDate: YYYY-MM-DDTHH:MM:SS
// - InvoiceNo:       Series prefix + number (e.g., "FT 2024/1")
// - GrossTotal:      Total with 2 decimal places (e.g., "1230.00")
// - PreviousHash:    Full Base64 hash of previous document, or "" for first

export interface HashChainInput {
  invoiceDate: string       // YYYY-MM-DD
  systemEntryDate: string   // YYYY-MM-DDTHH:MM:SS
  invoiceNo: string         // e.g., "FT VTF/1"
  grossTotal: string        // e.g., "1230.00"
  previousHash: string      // Base64 hash of previous doc, or "" for first in series
}

/**
 * Generate the cryptographic hash for a document (RSA-SHA1).
 * This creates the chain link for this document.
 *
 * @returns Full Base64-encoded hash string
 */
export function generateDocumentHash(input: HashChainInput, privateKeyPem: string): string {
  const dataToSign = [
    input.invoiceDate,
    input.systemEntryDate,
    input.invoiceNo,
    input.grossTotal,
    input.previousHash,
  ].join(';')

  const sign = crypto.createSign('SHA1')
  sign.update(dataToSign)
  sign.end()

  return sign.sign(privateKeyPem, 'base64')
}

/**
 * Verify a document hash against the chain.
 */
export function verifyDocumentHash(
  input: HashChainInput,
  hash: string,
  publicKeyPem: string
): boolean {
  const dataToVerify = [
    input.invoiceDate,
    input.systemEntryDate,
    input.invoiceNo,
    input.grossTotal,
    input.previousHash,
  ].join(';')

  const verify = crypto.createVerify('SHA1')
  verify.update(dataToVerify)
  verify.end()

  return verify.verify(publicKeyPem, hash, 'base64')
}

/**
 * Get the first 4 characters of the hash for display on the document.
 * (Required by AT specification)
 */
export function getHashDisplay(hash: string): string {
  return hash.substring(0, 4)
}

// ─── ATCUD (Código Único de Documento) ──────────────────────────────────────
// Format: {ValidationCode}-{SequentialNumber}
// - ValidationCode: assigned by AT when registering a document series
// - SequentialNumber: sequential number within the series
//
// Displayed on document as: "ATCUD: {ValidationCode}-{SequentialNumber}"

export interface ATCUDInput {
  validationCode: string   // Assigned by AT for this series
  sequentialNumber: number // Sequential within the series
}

/**
 * Generate the ATCUD code for a document.
 */
export function generateATCUD(input: ATCUDInput): string {
  return `${input.validationCode}-${input.sequentialNumber}`
}

/**
 * Format ATCUD for display on document.
 */
export function formatATCUDDisplay(atcud: string): string {
  return `ATCUD: ${atcud}`
}

// ─── QR Code Fiscal (Portaria n.º 195/2020) ────────────────────────────────
// The QR code contains structured fiscal data separated by '*'
// Fields: A through R (see specification)

export interface QRCodeFiscalData {
  // A — NIF do emitente (issuer)
  issuerNIF: string
  // B — NIF do adquirente (client) — '999999990' for final consumer
  clientNIF: string
  // C — País do adquirente (ISO 3166-1 alpha-2)
  clientCountry: string
  // D — Tipo de documento (FT, FR, FS, NC, ND)
  docType: PTDocType
  // E — Estado do documento (N, A, F)
  docStatus: PTDocStatus
  // F — Data do documento (YYYYMMDD)
  docDate: string
  // G — Identificação única do documento (InvoiceNo)
  docNumber: string
  // H — ATCUD
  atcud: string
  // I1 — Espaço fiscal
  fiscalSpace: FiscalSpace

  // Tax breakdown by rate
  // I2 — Base tributável isenta de IVA
  taxExemptBase?: number
  // I3 — Base tributável à taxa reduzida
  reducedRateBase?: number
  // I4 — Total IVA à taxa reduzida
  reducedRateTax?: number
  // I5 — Base tributável à taxa intermédia
  intermediateRateBase?: number
  // I6 — Total IVA à taxa intermédia
  intermediateRateTax?: number
  // I7 — Base tributável à taxa normal
  normalRateBase?: number
  // I8 — Total IVA à taxa normal
  normalRateTax?: number

  // N — Total de IVA
  totalTax: number
  // O — Total do documento com impostos (gross total)
  grossTotal: number
  // P — Retenção na fonte (withholding tax) — optional
  withholdingTax?: number
  // Q — 4 caracteres do Hash
  hashChars: string
  // R — Número do certificado do programa
  certNumber: string
}

/**
 * Generate the QR code data string per Portaria n.º 195/2020.
 * This string is encoded into the QR code displayed on the document.
 */
export function generateQRCodeString(data: QRCodeFiscalData): string {
  const fields: string[] = []

  // Required fields
  fields.push(`A:${data.issuerNIF}`)
  fields.push(`B:${data.clientNIF || '999999990'}`)
  fields.push(`C:${data.clientCountry || 'PT'}`)
  fields.push(`D:${data.docType}`)
  fields.push(`E:${data.docStatus}`)
  fields.push(`F:${data.docDate}`)
  fields.push(`G:${data.docNumber}`)
  fields.push(`H:${data.atcud}`)
  fields.push(`I1:${data.fiscalSpace}`)

  // Tax breakdown — only include non-zero values
  if (data.taxExemptBase && data.taxExemptBase > 0) {
    fields.push(`I2:${data.taxExemptBase.toFixed(2)}`)
  }
  if (data.reducedRateBase && data.reducedRateBase > 0) {
    fields.push(`I3:${data.reducedRateBase.toFixed(2)}`)
    fields.push(`I4:${(data.reducedRateTax || 0).toFixed(2)}`)
  }
  if (data.intermediateRateBase && data.intermediateRateBase > 0) {
    fields.push(`I5:${data.intermediateRateBase.toFixed(2)}`)
    fields.push(`I6:${(data.intermediateRateTax || 0).toFixed(2)}`)
  }
  if (data.normalRateBase && data.normalRateBase > 0) {
    fields.push(`I7:${data.normalRateBase.toFixed(2)}`)
    fields.push(`I8:${(data.normalRateTax || 0).toFixed(2)}`)
  }

  // Totals
  fields.push(`N:${data.totalTax.toFixed(2)}`)
  fields.push(`O:${data.grossTotal.toFixed(2)}`)

  // Optional: withholding tax
  if (data.withholdingTax && data.withholdingTax > 0) {
    fields.push(`P:${data.withholdingTax.toFixed(2)}`)
  }

  // Hash and cert
  fields.push(`Q:${data.hashChars}`)
  fields.push(`R:${data.certNumber}`)

  return fields.join('*')
}

// ─── Document Number Formatting ─────────────────────────────────────────────

/** Map our docType to SAF-T PT document type code */
export function mapDocTypeToSAFT(docType: 'devis' | 'facture', isSimplified?: boolean): PTDocType {
  if (docType === 'devis') return 'OR' // Orçamento
  if (isSimplified) return 'FS' // Fatura Simplificada (< 100€ or B2C under threshold)
  return 'FT' // Fatura
}

/**
 * Format a document number for SAF-T PT compliance.
 * Format: "{TypeCode} {SeriesPrefix}/{SequentialNumber}"
 * Example: "FT VTF/1", "OR VTF/42"
 */
export function formatPTDocNumber(
  docTypeCode: PTDocType,
  seriesPrefix: string,
  sequentialNumber: number
): string {
  return `${docTypeCode} ${seriesPrefix}/${sequentialNumber}`
}

// ─── NIF Validation ─────────────────────────────────────────────────────────

/**
 * Validate a Portuguese NIF (Número de Identificação Fiscal).
 * Uses the official check-digit algorithm (modulus 11).
 */
export function validateNIF(nif: string): boolean {
  const cleaned = nif.replace(/[\s.-]/g, '')
  if (!/^\d{9}$/.test(cleaned)) return false

  // Valid first digits: 1, 2, 3, 5, 6, 7, 8, 9
  const firstDigit = parseInt(cleaned[0])
  if (![1, 2, 3, 5, 6, 7, 8, 9].includes(firstDigit)) return false

  // Check digit calculation (modulus 11)
  let sum = 0
  for (let i = 0; i < 8; i++) {
    sum += parseInt(cleaned[i]) * (9 - i)
  }
  const remainder = sum % 11
  const checkDigit = remainder < 2 ? 0 : 11 - remainder

  return parseInt(cleaned[8]) === checkDigit
}

// ─── Tax Computation Helpers ────────────────────────────────────────────────

export interface TaxBreakdown {
  exemptBase: number
  reducedBase: number
  reducedTax: number
  intermediateBase: number
  intermediateTax: number
  normalBase: number
  normalTax: number
  totalBase: number
  totalTax: number
  grossTotal: number
}

export interface InvoiceLine {
  description: string
  quantity: number
  unitPrice: number  // Price excluding tax
  taxRate: number    // IVA rate percentage (0, 6, 13, 23)
  lineTotal: number  // quantity * unitPrice
}

/**
 * Compute tax breakdown from invoice lines.
 * Groups amounts by IVA rate for QR code and SAF-T.
 */
export function computeTaxBreakdown(
  lines: InvoiceLine[],
  fiscalSpace: FiscalSpace = 'PT'
): TaxBreakdown {
  const rates = fiscalSpace === 'PT-AC' ? PT_AC_IVA_RATES
    : fiscalSpace === 'PT-MA' ? PT_MA_IVA_RATES
    : PT_IVA_RATES

  const breakdown: TaxBreakdown = {
    exemptBase: 0,
    reducedBase: 0,
    reducedTax: 0,
    intermediateBase: 0,
    intermediateTax: 0,
    normalBase: 0,
    normalTax: 0,
    totalBase: 0,
    totalTax: 0,
    grossTotal: 0,
  }

  for (const line of lines) {
    const base = line.lineTotal
    const tax = base * (line.taxRate / 100)

    if (line.taxRate === 0) {
      breakdown.exemptBase += base
    } else if (line.taxRate === rates.reduced) {
      breakdown.reducedBase += base
      breakdown.reducedTax += tax
    } else if (line.taxRate === rates.intermediate) {
      breakdown.intermediateBase += base
      breakdown.intermediateTax += tax
    } else {
      // Default to normal rate bucket for any other rate
      breakdown.normalBase += base
      breakdown.normalTax += tax
    }

    breakdown.totalBase += base
    breakdown.totalTax += tax
  }

  breakdown.grossTotal = breakdown.totalBase + breakdown.totalTax

  // Round all values to 2 decimal places
  for (const key of Object.keys(breakdown) as (keyof TaxBreakdown)[]) {
    breakdown[key] = Math.round(breakdown[key] * 100) / 100
  }

  return breakdown
}

// ─── Full Document Registration ─────────────────────────────────────────────
// Combines all the above into a single registration flow

export interface DocumentRegistrationInput {
  artisanId: string
  docType: 'devis' | 'facture'
  issuerNIF: string
  clientNIF?: string
  clientCountry?: string
  fiscalSpace?: FiscalSpace
  lines: InvoiceLine[]
  issueDate: string         // YYYY-MM-DD
  isSimplified?: boolean
}

export interface DocumentRegistrationResult {
  docNumber: string         // Formatted: "FT VTF/1"
  sequentialNumber: number
  hash: string              // Full Base64 hash
  hashDisplay: string       // First 4 chars
  atcud: string             // ValidationCode-SeqNumber
  atcudDisplay: string      // "ATCUD: ValidationCode-SeqNumber"
  qrCodeString: string      // Full QR code data string
  taxBreakdown: TaxBreakdown
  certNumber: string
  systemEntryDate: string   // YYYY-MM-DDTHH:MM:SS
  saftDocType: PTDocType
}

/**
 * Register a document and generate all fiscal data.
 * This is called by the API route before PDF generation.
 *
 * @param input - Document data
 * @param seriesPrefix - Series prefix (e.g., "VTF")
 * @param validationCode - AT-assigned validation code for the series
 * @param sequentialNumber - Next sequential number in the series
 * @param previousHash - Hash of the previous document in the series (or "" for first)
 *
 * @returns All fiscal data needed for the PDF and database storage
 */
export function registerDocument(
  input: DocumentRegistrationInput,
  seriesPrefix: string,
  validationCode: string,
  sequentialNumber: number,
  previousHash: string
): DocumentRegistrationResult {
  const privateKey = getPrivateKey()
  const saftDocType = mapDocTypeToSAFT(input.docType, input.isSimplified)
  const docNumber = formatPTDocNumber(saftDocType, seriesPrefix, sequentialNumber)
  const fiscalSpace = input.fiscalSpace || 'PT'
  const systemEntryDate = new Date().toISOString().replace(/\.\d{3}Z$/, '')
  const taxBreakdown = computeTaxBreakdown(input.lines, fiscalSpace)

  // Generate hash
  let hash = ''
  let hashDisplay = '0000'
  if (privateKey) {
    const hashInput: HashChainInput = {
      invoiceDate: input.issueDate,
      systemEntryDate,
      invoiceNo: docNumber,
      grossTotal: taxBreakdown.grossTotal.toFixed(2),
      previousHash,
    }
    hash = generateDocumentHash(hashInput, privateKey)
    hashDisplay = getHashDisplay(hash)
  }

  // Generate ATCUD
  const atcud = generateATCUD({ validationCode, sequentialNumber })
  const atcudDisplay = formatATCUDDisplay(atcud)

  // Generate QR code string
  const qrCodeString = generateQRCodeString({
    issuerNIF: input.issuerNIF,
    clientNIF: input.clientNIF || '999999990',
    clientCountry: input.clientCountry || 'PT',
    docType: saftDocType,
    docStatus: 'N',
    docDate: input.issueDate.replace(/-/g, ''),
    docNumber,
    atcud,
    fiscalSpace,
    taxExemptBase: taxBreakdown.exemptBase || undefined,
    reducedRateBase: taxBreakdown.reducedBase || undefined,
    reducedRateTax: taxBreakdown.reducedTax || undefined,
    intermediateRateBase: taxBreakdown.intermediateBase || undefined,
    intermediateRateTax: taxBreakdown.intermediateTax || undefined,
    normalRateBase: taxBreakdown.normalBase || undefined,
    normalRateTax: taxBreakdown.normalTax || undefined,
    totalTax: taxBreakdown.totalTax,
    grossTotal: taxBreakdown.grossTotal,
    hashChars: hashDisplay,
    certNumber: AT_CERT_NUMBER,
  })

  return {
    docNumber,
    sequentialNumber,
    hash,
    hashDisplay,
    atcud,
    atcudDisplay,
    qrCodeString,
    taxBreakdown,
    certNumber: AT_CERT_NUMBER,
    systemEntryDate,
    saftDocType,
  }
}
