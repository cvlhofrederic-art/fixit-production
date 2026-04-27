import { COEFFICIENTS_ZONE_2026 } from './coefficients'
import type { ZoneCode } from './types'

/**
 * Extract the département code from a French postal code.
 * - Metropolitan: first 2 digits (75008 → "75")
 * - DOM: first 3 digits if starts with 97 (97200 → "972")
 * - Returns null if invalid.
 */
function extractDepartement(postalCode: string): string | null {
  const cleaned = postalCode.replace(/\s+/g, '')
  if (!/^\d{2,5}$/.test(cleaned)) return null

  // DOM (97x or 98x)
  if (cleaned.startsWith('97') || cleaned.startsWith('98')) {
    return cleaned.length >= 3 ? cleaned.slice(0, 3) : null
  }

  // Metropolitan
  return cleaned.slice(0, 2)
}

export function detectZoneFromDepartement(dept: string): ZoneCode {
  const cleaned = dept.replace(/\s+/g, '')

  // Find a zone whose departement list explicitly includes this dept.
  // Skip the wildcard STANDARD-FRANCE entry; we use it as fallback.
  for (const zone of COEFFICIENTS_ZONE_2026) {
    if (zone.code === 'STANDARD-FRANCE') continue
    if (zone.departements.includes(cleaned)) return zone.code
  }
  return 'STANDARD-FRANCE'
}

export function detectZoneFromPostalCode(postalCode: string): ZoneCode {
  const dept = extractDepartement(postalCode)
  if (!dept) return 'STANDARD-FRANCE'
  return detectZoneFromDepartement(dept)
}
