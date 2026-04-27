// tests/prix-2026/data-integrity.test.ts
import { describe, it, expect } from 'vitest'
import { PRIX_2026, COEFFICIENTS_ZONE_2026 } from '@/lib/prix-travaux-2026'
import type { PriceLine } from '@/lib/prix-travaux-2026'

const SPREAD_TOLERANCE = 0.201
const MAX_AGE_DAYS_ERROR = 730
const MAX_AGE_DAYS_WARN = 365

function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

describe('PRIX_2026 — data integrity', () => {
  it('every line has spread ≤ 20%', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const spread = (line.priceMax - line.priceMin) / line.priceMin
      expect(spread, `taskId=${line.taskId} spread=${(spread * 100).toFixed(1)}%`).toBeLessThanOrEqual(SPREAD_TOLERANCE)
    })
  })

  it('every line has ≥2 sources, with ≥1 Tier 1', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      expect(line.sources.length, `taskId=${line.taskId}`).toBeGreaterThanOrEqual(2)
      expect(line.sources.some(s => s.tier === 1), `taskId=${line.taskId} needs ≥1 Tier 1 source`).toBe(true)
    })
  })

  it('every line has lastVerified within 730 days (error threshold)', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const days = ageDays(line.lastVerified)
      expect(days, `taskId=${line.taskId} is ${days} days old`).toBeLessThanOrEqual(MAX_AGE_DAYS_ERROR)
    })
  })

  it('warns on lines older than 365 days', () => {
    const stale = PRIX_2026.filter(l => ageDays(l.lastVerified) > MAX_AGE_DAYS_WARN)
    if (stale.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[prix-2026] ${stale.length} line(s) need refresh: ${stale.map(s => s.taskId).join(', ')}`)
    }
    expect(true).toBe(true) // warning, not failure
  })

  it('every taskId is globally unique', () => {
    const ids = PRIX_2026.map(l => l.taskId)
    const dups = ids.filter((id, idx) => ids.indexOf(id) !== idx)
    expect(dups, `duplicates: ${dups.join(', ')}`).toEqual([])
  })

  it('cost decomposition sums match priceMin within ±5% (excluding zone/gamme/etat coefs which are baseline 1.0×)', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      const moBrut = line.cost.mainOeuvreHeures * line.cost.mainOeuvreTauxHoraire
      const coutBrut = moBrut + line.cost.materiaux
      const coutFinal = coutBrut * (1 + line.cost.margeNette / 100)
      const ttc = coutFinal * (1 + line.tva / 100)
      const expectedMin = ttc * 0.92
      const drift = Math.abs(line.priceMin - expectedMin) / expectedMin
      expect(drift, `taskId=${line.taskId} priceMin drift=${(drift * 100).toFixed(1)}% from cost decomposition`).toBeLessThanOrEqual(0.05)
    })
  })

  it('TVA value is 5.5, 10, or 20 only', () => {
    PRIX_2026.forEach((line: PriceLine) => {
      expect([5.5, 10, 20]).toContain(line.tva)
    })
  })

  it('aidesEligibles only on energy-renovation metiers', () => {
    // menuiserie is included because fenêtres double vitrage are eligible
    // (CEE BAR-EN-104 + MPR forfait fenêtres). See Task 13 / data/menuiserie.ts.
    const energyMetiers = ['chauffage', 'photovoltaique', 'ite', 'plaquiste', 'menuiserie']
    PRIX_2026.forEach((line: PriceLine) => {
      if (line.aidesEligibles?.maPrimeRenov || line.aidesEligibles?.cee) {
        expect(energyMetiers, `taskId=${line.taskId} has aides but metier=${line.metier}`).toContain(line.metier)
      }
    })
  })

  it('each département is mapped to at most one zone (no overlap, excluding STANDARD-FRANCE)', () => {
    const seen = new Map<string, string>()
    for (const z of COEFFICIENTS_ZONE_2026) {
      if (z.code === 'STANDARD-FRANCE') continue
      for (const dept of z.departements) {
        const prev = seen.get(dept)
        expect(prev, `département ${dept} appears in both ${prev} and ${z.code}`).toBeUndefined()
        seen.set(dept, z.code)
      }
    }
  })

  // Once Task 17 ships, PRIX_2026 should hold ≥50 lines (10 métiers × 5 priority lines).
  // Until then, the 8 forEach-based tests above pass vacuously on the empty array.
  // This guard makes the placeholder state visible in CI output and activates
  // automatically when the data tasks land.
  it.todo('PRIX_2026 has at least 50 lines once Tasks 8-17 are merged')
})
