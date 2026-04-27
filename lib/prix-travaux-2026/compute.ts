// lib/prix-travaux-2026/compute.ts

import { PRIX_2026 } from '@/lib/prix-travaux-2026'
import { COEFFICIENTS_ZONE_2026, COEFFICIENTS_GAMME_2026, COEFFICIENTS_ETAT_2026 } from './coefficients'
import { detectZoneFromPostalCode, detectZoneFromDepartement } from './region-detector'
import { getArtisanRate, type ArtisanRate } from './artisan-rate'
import type { Gamme, Etat, ZoneCode, Source, TvaRate, Unit, PriceLine } from './types'

export type ComputeQuoteItem = { taskId: string; qty: number }

export type ComputeQuoteAidesContext = {
  foyerTaille?: number
  revenusFiscaux?: number
  typeLogement?: 'principal' | 'locatif'
  ageLogement?: number
}

export type ComputeQuoteArgs = {
  items: ComputeQuoteItem[]
  region?: string
  postalCode?: string
  gamme: Gamme
  etat: Etat
  aidesContext?: ComputeQuoteAidesContext
}

export type ComputeQuoteBreakdownLine = {
  taskId: string
  label: string
  qty: number
  unit: Unit
  unitPriceMin: number
  unitPriceMax: number
  lineMin: number
  lineMax: number
  aidesLineMax?: number
}

export type ComputeQuoteAides = {
  maPrimeRenov: number
  cee: number
  tvaEconomie: number
  ecoPTZ: { eligible: boolean; montantMax?: number }
  total: number
}

export type ComputeQuoteResult = {
  totalMin: number
  totalMax: number
  totalNetMin?: number
  totalNetMax?: number
  spreadPercent: number
  breakdown: ComputeQuoteBreakdownLine[]
  aidesDeduites?: ComputeQuoteAides
  aidesConditions?: string[]
  zoneCoef: number
  gammeCoef: number
  etatCoef: number
  zoneDetected: ZoneCode
  tvaApplicable: TvaRate
  sources: Source[]
  warnings?: string[]
  mode: 'normal' | 'out-of-catalog'
  artisanRate?: ArtisanRate
}

const ZONE_CODES = new Set(COEFFICIENTS_ZONE_2026.map(z => z.code))

function detectZone(args: { region?: string; postalCode?: string }): ZoneCode {
  if (args.postalCode) return detectZoneFromPostalCode(args.postalCode)
  if (args.region) {
    if (ZONE_CODES.has(args.region as ZoneCode)) return args.region as ZoneCode
    return detectZoneFromDepartement(args.region)
  }
  return 'STANDARD-FRANCE'
}

function getZoneCoef(z: ZoneCode): number {
  return COEFFICIENTS_ZONE_2026.find(c => c.code === z)?.multiplier ?? 1.0
}

function getGammeCoef(g: Gamme): number {
  return COEFFICIENTS_GAMME_2026.find(c => c.level === g)?.multiplier ?? 1.0
}

function getEtatCoef(e: Etat): number {
  return COEFFICIENTS_ETAT_2026.find(c => c.level === e)?.multiplier ?? 1.0
}

function dedupeSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const s of sources) {
    const key = `${s.name}|${s.tier}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

export function computeQuote(args: ComputeQuoteArgs): ComputeQuoteResult {
  const zone = detectZone(args)
  const zoneCoef = getZoneCoef(zone)
  const gammeCoef = getGammeCoef(args.gamme)
  const etatCoef = getEtatCoef(args.etat)

  // Out-of-catalog
  if (!args.items || args.items.length === 0) {
    return {
      totalMin: 0,
      totalMax: 0,
      spreadPercent: 0,
      breakdown: [],
      zoneCoef,
      gammeCoef,
      etatCoef,
      zoneDetected: zone,
      tvaApplicable: 20 as TvaRate,
      sources: [],
      mode: 'out-of-catalog',
      artisanRate: getArtisanRate(zone),
    }
  }

  const breakdown: ComputeQuoteBreakdownLine[] = []
  const allSources: Source[] = []
  let totalMin = 0
  let totalMax = 0
  let tvaApplicable: TvaRate = 20

  for (const item of args.items) {
    const line: PriceLine | undefined = PRIX_2026.find(l => l.taskId === item.taskId)
    if (!line) {
      throw new Error(`unknown taskId: ${item.taskId}`)
    }
    const factor = zoneCoef * gammeCoef * etatCoef
    const unitPriceMin = Math.round(line.priceMin * factor)
    const unitPriceMax = Math.round(line.priceMax * factor)
    const lineMin = unitPriceMin * item.qty
    const lineMax = unitPriceMax * item.qty
    breakdown.push({
      taskId: line.taskId,
      label: line.label,
      qty: item.qty,
      unit: line.unit,
      unitPriceMin,
      unitPriceMax,
      lineMin,
      lineMax,
    })
    totalMin += lineMin
    totalMax += lineMax
    allSources.push(...line.sources)
    // TVA la plus basse rencontrée prévaut (favorable client)
    if (line.tva < tvaApplicable) tvaApplicable = line.tva
  }

  const spreadPercent = totalMin > 0 ? (totalMax - totalMin) / totalMin : 0

  return {
    totalMin,
    totalMax,
    spreadPercent,
    breakdown,
    zoneCoef,
    gammeCoef,
    etatCoef,
    zoneDetected: zone,
    tvaApplicable,
    sources: dedupeSources(allSources),
    mode: 'normal',
  }
}
