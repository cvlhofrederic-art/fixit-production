// lib/prix-travaux-2026/artisan-rate.ts
//
// Taux horaire artisan multi-corps de métier all-in TTC, indexé par zone.
// Base : moyenne pondérée CAPEB nationale tous corps de métier, gamme standard,
// chargé patronal + matériel léger inclus, hors déplacements.

import { COEFFICIENTS_ZONE_2026 } from './coefficients'
import type { ZoneCode } from './types'

export const ARTISAN_RATE_BASE = {
  min: 50,
  max: 75,
} as const

export type ArtisanRate = {
  min: number
  max: number
  unit: 'EUR_TTC_par_heure'
}

export function getArtisanRate(zone: ZoneCode): ArtisanRate {
  const z = COEFFICIENTS_ZONE_2026.find(c => c.code === zone)
  const m = z?.multiplier ?? 1.0
  return {
    min: Math.round(ARTISAN_RATE_BASE.min * m),
    max: Math.round(ARTISAN_RATE_BASE.max * m),
    unit: 'EUR_TTC_par_heure',
  }
}
