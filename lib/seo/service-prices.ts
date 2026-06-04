// Mapping service slug → métier prix-travaux-2026 + coefficient zone PACA.
// Utilisé pour injecter des données prix propriétaires sur les pages
// programmatiques FR services × villes (anti-thin-content 2026).
//
// Méthodologie : `lib/prix-travaux-2026/data/*.ts` (sources Tier 1 CAPEB
// /FFB/INSEE/France Rénov', Tier 2 travaux.com/thermocom). Le multiplier
// PACA = 1.05 vient de `coefficients.ts` (CAPEB PACA 2026).

import type { PriceLine, Metier } from '@/lib/prix-travaux-2026/types'
import { PRIX_2026, COEFFICIENTS_ZONE_2026 } from '@/lib/prix-travaux-2026'

const SERVICE_TO_METIER: Record<string, Metier> = {
  plombier: 'plomberie',
  'debouchage-canalisation': 'plomberie',
  electricien: 'electricite',
  peintre: 'peinture',
  plaquiste: 'plaquiste',
  carreleur: 'carrelage',
  macon: 'maconnerie',
  couvreur: 'couverture',
  menuisier: 'menuiserie',
  climatisation: 'chauffage',
  chauffagiste: 'chauffage',
  paysagiste: 'paysagisme',
  jardinier: 'paysagisme',
  elagueur: 'paysagisme',
  'espaces-verts': 'paysagisme',
}

const PACA_COEFF = COEFFICIENTS_ZONE_2026.find(c => c.code === 'PACA')!.multiplier

export interface LocalPriceLine {
  taskId: string
  label: string
  unit: string
  description?: string
  priceMin: number
  priceMax: number
  priceUnit: 'EUR_HT' | 'EUR_TTC'
  tva: number
  sources: { name: string; url?: string; tier: 1 | 2 | 3 }[]
  lastVerified: string
}

/**
 * Retourne les principales lignes de prix pour un service donné, avec
 * application du coefficient zone PACA (1.05 - CAPEB PACA 2026).
 *
 * @param serviceSlug ex: 'plombier', 'electricien', 'peintre'
 * @param limit nombre max de lignes à retourner (défaut 4)
 */
export function getLocalPricesForService(serviceSlug: string, limit = 4): LocalPriceLine[] {
  const metier = SERVICE_TO_METIER[serviceSlug]
  if (!metier) return []

  const lines: PriceLine[] = PRIX_2026.filter(l => l.metier === metier).slice(0, limit)
  return lines.map(l => ({
    taskId: l.taskId,
    label: l.label,
    unit: l.unit,
    description: l.description,
    priceMin: Math.round(l.priceMin * PACA_COEFF),
    priceMax: Math.round(l.priceMax * PACA_COEFF),
    priceUnit: l.priceUnit,
    tva: l.tva,
    sources: l.sources.map(s => ({ name: s.name, url: s.url, tier: s.tier })),
    lastVerified: l.lastVerified,
  }))
}

/**
 * Schema.org PriceSpecification compatible - pour injection dans le
 * JSON-LD des pages programmatiques (signal SEO + AI engines).
 */
export function buildPriceSpecificationsSchema(prices: LocalPriceLine[]) {
  return prices.map(p => ({
    '@type': 'AggregateOffer',
    name: p.label,
    description: p.description,
    priceCurrency: 'EUR',
    lowPrice: p.priceMin,
    highPrice: p.priceMax,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: `${p.priceMin}-${p.priceMax}`,
      priceCurrency: 'EUR',
      referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitText: p.unit },
      valueAddedTaxIncluded: p.priceUnit === 'EUR_TTC',
    },
  }))
}
