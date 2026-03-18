// ── Financial arithmetic helpers (centimes-based) ────────────────────────────
// All internal calculations use integer centimes to avoid IEEE 754 float errors.
// Convert to/from cents at the boundary (user input/display).

/**
 * Convert a decimal amount to integer centimes
 * e.g., 19.99 → 1999
 */
export function toCents(amount: number): number {
  return Math.round(amount * 100)
}

/**
 * Convert integer centimes to decimal amount
 * e.g., 1999 → 19.99
 */
export function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Calculate tax amount in centimes
 * @param amountHTCents - HT amount in centimes
 * @param taxRate - Tax rate as percentage (e.g., 20 for 20%)
 * @returns Tax amount in centimes
 */
export function calculateTaxCents(amountHTCents: number, taxRate: number): number {
  return Math.round(amountHTCents * taxRate / 100)
}

/**
 * Calculate TTC amount in centimes
 * @param amountHTCents - HT amount in centimes
 * @param taxRate - Tax rate as percentage (e.g., 20 for 20%)
 * @returns TTC amount in centimes
 */
export function calculateTTCCents(amountHTCents: number, taxRate: number): number {
  return amountHTCents + calculateTaxCents(amountHTCents, taxRate)
}

/**
 * Calculate HT from TTC in centimes (reverse calculation)
 * @param amountTTCCents - TTC amount in centimes
 * @param taxRate - Tax rate as percentage
 * @returns HT amount in centimes
 */
export function calculateHTFromTTCCents(amountTTCCents: number, taxRate: number): number {
  return Math.round(amountTTCCents / (1 + taxRate / 100))
}

/**
 * Calculate line item total in centimes
 * @param priceHTCents - Unit price HT in centimes
 * @param quantity - Quantity
 * @param taxRate - Tax rate as percentage
 * @returns { totalHTCents, taxCents, totalTTCCents }
 */
export function calculateLineItem(
  priceHTCents: number,
  quantity: number,
  taxRate: number,
): { totalHTCents: number; taxCents: number; totalTTCCents: number } {
  const totalHTCents = priceHTCents * quantity
  const taxCents = calculateTaxCents(totalHTCents, taxRate)
  const totalTTCCents = totalHTCents + taxCents
  return { totalHTCents, taxCents, totalTTCCents }
}

/**
 * Sum multiple line items and return invoice totals in centimes
 */
export function calculateInvoiceTotals(
  items: Array<{ priceHT: number; quantity: number; taxRate: number }>,
): { totalHTCents: number; totalTaxCents: number; totalTTCCents: number } {
  let totalHTCents = 0
  let totalTaxCents = 0

  for (const item of items) {
    const htCents = toCents(item.priceHT) * item.quantity
    const taxCents = calculateTaxCents(htCents, item.taxRate)
    totalHTCents += htCents
    totalTaxCents += taxCents
  }

  return {
    totalHTCents,
    totalTaxCents,
    totalTTCCents: totalHTCents + totalTaxCents,
  }
}

/**
 * Format centimes as a display amount
 * e.g., 1999 → "19,99 €" (FR) or "19.99 €" (PT)
 */
export function formatCents(cents: number, locale: string = 'fr'): string {
  const amount = fromCents(cents)
  return new Intl.NumberFormat(locale === 'pt' ? 'pt-PT' : 'fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Generate next sequential number for devis/factures
 * Format: D-2026-0001 (devis) or F-2026-0001 (factures)
 */
export function generateDocumentNumber(prefix: 'D' | 'F', year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`
}
