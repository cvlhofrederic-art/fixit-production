/**
 * Market Rates — BTP Reference Pricing Data
 *
 * Hourly rates by trade and country.
 * Sources: FFB 2024, Capeb, Batiactu (FR) / AICCOPN, IMPIC (PT)
 *
 * Rates = €/hour HT charged to client (not cost, but selling price)
 */

import type { Country } from '@/lib/config/companyTypes'

export interface MarketRate {
  trade: string
  label_fr: string
  label_pt: string
  country: Country
  min_hour: number    // €/h HT — low end (rural, small jobs)
  avg_hour: number    // €/h HT — average market
  max_hour: number    // €/h HT — high end (urban, specialized)
  min_day: number     // €/day HT
  avg_day: number
  max_day: number
}

// ════════════════════════════════════════════
//  FRANCE — Tarifs horaires artisans BTP 2025
// ════════════════════════════════════════════

export const FR_MARKET_RATES: MarketRate[] = [
  { trade: 'macon', label_fr: 'Maçon', label_pt: 'Pedreiro', country: 'FR', min_hour: 35, avg_hour: 50, max_hour: 70, min_day: 280, avg_day: 400, max_day: 560 },
  { trade: 'plombier', label_fr: 'Plombier', label_pt: 'Canalizador', country: 'FR', min_hour: 40, avg_hour: 55, max_hour: 80, min_day: 320, avg_day: 440, max_day: 640 },
  { trade: 'electricien', label_fr: 'Électricien', label_pt: 'Eletricista', country: 'FR', min_hour: 35, avg_hour: 50, max_hour: 75, min_day: 280, avg_day: 400, max_day: 600 },
  { trade: 'peintre', label_fr: 'Peintre', label_pt: 'Pintor', country: 'FR', min_hour: 30, avg_hour: 40, max_hour: 55, min_day: 240, avg_day: 320, max_day: 440 },
  { trade: 'carreleur', label_fr: 'Carreleur', label_pt: 'Ladrilhador', country: 'FR', min_hour: 35, avg_hour: 50, max_hour: 70, min_day: 280, avg_day: 400, max_day: 560 },
  { trade: 'menuisier', label_fr: 'Menuisier', label_pt: 'Carpinteiro', country: 'FR', min_hour: 35, avg_hour: 50, max_hour: 70, min_day: 280, avg_day: 400, max_day: 560 },
  { trade: 'couvreur', label_fr: 'Couvreur', label_pt: 'Telhador', country: 'FR', min_hour: 40, avg_hour: 55, max_hour: 80, min_day: 320, avg_day: 440, max_day: 640 },
  { trade: 'charpentier', label_fr: 'Charpentier', label_pt: 'Carpinteiro estrutural', country: 'FR', min_hour: 40, avg_hour: 55, max_hour: 75, min_day: 320, avg_day: 440, max_day: 600 },
  { trade: 'platrier', label_fr: 'Plâtrier / Plaquiste', label_pt: 'Estucador / Pladur', country: 'FR', min_hour: 30, avg_hour: 45, max_hour: 60, min_day: 240, avg_day: 360, max_day: 480 },
  { trade: 'chauffagiste', label_fr: 'Chauffagiste / CVC', label_pt: 'Técnico AVAC', country: 'FR', min_hour: 45, avg_hour: 60, max_hour: 85, min_day: 360, avg_day: 480, max_day: 680 },
  { trade: 'terrassier', label_fr: 'Terrassier', label_pt: 'Terraplanagem', country: 'FR', min_hour: 50, avg_hour: 70, max_hour: 100, min_day: 400, avg_day: 560, max_day: 800 },
  { trade: 'etancheiste', label_fr: 'Étanchéiste', label_pt: 'Impermeabilizador', country: 'FR', min_hour: 40, avg_hour: 55, max_hour: 75, min_day: 320, avg_day: 440, max_day: 600 },
  { trade: 'serrurier', label_fr: 'Serrurier / Métallier', label_pt: 'Serralheiro', country: 'FR', min_hour: 40, avg_hour: 55, max_hour: 80, min_day: 320, avg_day: 440, max_day: 640 },
  { trade: 'general', label_fr: 'Tous corps d\'état', label_pt: 'Construção geral', country: 'FR', min_hour: 35, avg_hour: 50, max_hour: 70, min_day: 280, avg_day: 400, max_day: 560 },
]

// ════════════════════════════════════════════
//  PORTUGAL — Tarifs horaires artisans BTP 2025
// ════════════════════════════════════════════

export const PT_MARKET_RATES: MarketRate[] = [
  { trade: 'pedreiro', label_fr: 'Maçon', label_pt: 'Pedreiro', country: 'PT', min_hour: 12, avg_hour: 18, max_hour: 28, min_day: 96, avg_day: 144, max_day: 224 },
  { trade: 'canalizador', label_fr: 'Plombier', label_pt: 'Canalizador', country: 'PT', min_hour: 15, avg_hour: 22, max_hour: 35, min_day: 120, avg_day: 176, max_day: 280 },
  { trade: 'eletricista', label_fr: 'Électricien', label_pt: 'Eletricista', country: 'PT', min_hour: 14, avg_hour: 20, max_hour: 32, min_day: 112, avg_day: 160, max_day: 256 },
  { trade: 'pintor', label_fr: 'Peintre', label_pt: 'Pintor', country: 'PT', min_hour: 10, avg_hour: 15, max_hour: 22, min_day: 80, avg_day: 120, max_day: 176 },
  { trade: 'ladrilhador', label_fr: 'Carreleur', label_pt: 'Ladrilhador', country: 'PT', min_hour: 12, avg_hour: 18, max_hour: 28, min_day: 96, avg_day: 144, max_day: 224 },
  { trade: 'carpinteiro', label_fr: 'Menuisier', label_pt: 'Carpinteiro', country: 'PT', min_hour: 12, avg_hour: 18, max_hour: 28, min_day: 96, avg_day: 144, max_day: 224 },
  { trade: 'telhador', label_fr: 'Couvreur', label_pt: 'Telhador', country: 'PT', min_hour: 14, avg_hour: 20, max_hour: 30, min_day: 112, avg_day: 160, max_day: 240 },
  { trade: 'estucador', label_fr: 'Plâtrier', label_pt: 'Estucador', country: 'PT', min_hour: 10, avg_hour: 15, max_hour: 22, min_day: 80, avg_day: 120, max_day: 176 },
  { trade: 'serralheiro', label_fr: 'Serrurier / Métallier', label_pt: 'Serralheiro', country: 'PT', min_hour: 14, avg_hour: 20, max_hour: 30, min_day: 112, avg_day: 160, max_day: 240 },
  { trade: 'avac', label_fr: 'CVC / Climatisation', label_pt: 'Técnico AVAC', country: 'PT', min_hour: 16, avg_hour: 25, max_hour: 38, min_day: 128, avg_day: 200, max_day: 304 },
  { trade: 'impermeabilizador', label_fr: 'Étanchéiste', label_pt: 'Impermeabilizador', country: 'PT', min_hour: 14, avg_hour: 20, max_hour: 30, min_day: 112, avg_day: 160, max_day: 240 },
  { trade: 'geral', label_fr: 'Tous corps d\'état', label_pt: 'Construção geral', country: 'PT', min_hour: 12, avg_hour: 18, max_hour: 28, min_day: 96, avg_day: 144, max_day: 224 },
]

// ════════════════════════════════════════════
//  EXPORTS
// ════════════════════════════════════════════

const ALL_RATES = [...FR_MARKET_RATES, ...PT_MARKET_RATES]

/** Get all market rates for a country */
export function getMarketRatesForCountry(country: Country): MarketRate[] {
  return country === 'FR' ? FR_MARKET_RATES : PT_MARKET_RATES
}

/** Find matching rate by trade + country */
export function findMarketRate(trade: string, country: Country): MarketRate | undefined {
  return ALL_RATES.find(r => r.trade === trade && r.country === country)
}

/** Find closest matching trade (fuzzy) */
export function findClosestTrade(search: string, country: Country): MarketRate {
  const rates = getMarketRatesForCountry(country)
  const lower = search.toLowerCase()

  // Exact match
  const exact = rates.find(r => r.trade === lower)
  if (exact) return exact

  // Partial match on labels
  const partial = rates.find(
    r =>
      r.label_fr.toLowerCase().includes(lower) ||
      r.label_pt.toLowerCase().includes(lower) ||
      r.trade.includes(lower)
  )
  if (partial) return partial

  // Fallback to general
  return rates.find(r => r.trade === 'general' || r.trade === 'geral') || rates[0]
}
