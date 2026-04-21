import type { Service } from '@/lib/types'

/** Parse the range tag embedded in service.description: [unit:forfait|min:50|max:100] */
export function parseServiceRange(service: Service): { min: number; max: number; unit: string } {
  const desc = service.description || ''
  const match = desc.match(/\[unit:([^|]+)\|min:([\d.]+)\|max:([\d.]+)\]/)
  if (match) {
    return { unit: match[1], min: parseFloat(match[2]), max: parseFloat(match[3]) }
  }
  // Fallback: legacy format
  const unit = desc.includes('[m²]') ? 'm2' : desc.includes('[heure]') ? 'heure' : desc.includes('[unité]') ? 'unite' : 'forfait'
  return { unit, min: service.price_ht || 0, max: service.price_ttc || 0 }
}

/** Human-readable price range label: "50 – 100€/m²" */
export function getPriceRangeLabel(service: Service, onQuoteLabel: string): string {
  const { min, max, unit } = parseServiceRange(service)
  if (min === 0 && max === 0) return onQuoteLabel
  const suffix: Record<string, string> = {
    m2: '€/m²', ml: '€/ml', m3: '€/m³', heure: '€/h',
    forfait: '€', unite: '€/u', arbre: '€/u', kg: '€/kg',
    tonne: '€/t', lot: '€/lot',
  }
  const s = suffix[unit] || '€'
  if (min === max) return `${min}${s}`
  return `${min} – ${max}${s}`
}

/** Get pricing unit suffix: "/m²", "/h", "forfait" */
export function getPricingUnit(service: Service): string {
  const { unit } = parseServiceRange(service)
  const labels: Record<string, string> = {
    m2: '/m²', ml: '/ml', m3: '/m³', heure: '/h',
    forfait: 'forfait', unite: '/u', arbre: '/u', kg: '/kg',
    tonne: '/t', lot: '/lot',
  }
  return labels[unit] || 'forfait'
}

/** Strip range tags from description for display */
export function getCleanDescription(service: Service): string {
  return (service.description || '')
    .replace(/\s*\[unit:[^\]]+\]\s*/g, '')
    .replace(/\s*\[(m²|heure|unité|forfait|ml)\]\s*/g, '')
    .replace(/\s*\[scope:(mo|mat|frais)\]\s*/g, '')
    .trim()
}

/** Artisan scope: 'mo' (main d'œuvre, public), 'mat' (matériau, interne) ou 'frais' (frais divers, interne) */
export type ServiceScope = 'mo' | 'mat' | 'frais'

/** Extrait le scope depuis la description (tag [scope:mo|mat|frais]). Défaut = 'mo'. */
export function parseServiceScope(service: Service): ServiceScope {
  const m = (service.description || '').match(/\[scope:(mo|mat|frais)\]/)
  return (m?.[1] as ServiceScope) || 'mo'
}
