// tests/simulateur-v2-artisan-rate.test.ts
import { describe, it, expect } from 'vitest'
import { getArtisanRate, ARTISAN_RATE_BASE } from '@/lib/prix-travaux-2026/artisan-rate'

describe('getArtisanRate', () => {
  it('PACA renvoie base × 1.05', () => {
    const r = getArtisanRate('PACA')
    expect(r.min).toBe(Math.round(ARTISAN_RATE_BASE.min * 1.05))
    expect(r.max).toBe(Math.round(ARTISAN_RATE_BASE.max * 1.05))
    expect(r.unit).toBe('EUR_TTC_par_heure')
  })

  it('IDF-PARIS renvoie base × 1.30', () => {
    const r = getArtisanRate('IDF-PARIS')
    expect(r.min).toBe(Math.round(ARTISAN_RATE_BASE.min * 1.30))
  })

  it('DOM renvoie base × 1.40', () => {
    const r = getArtisanRate('DOM')
    expect(r.min).toBe(Math.round(ARTISAN_RATE_BASE.min * 1.40))
  })

  it('RURAL-FRANCE renvoie base × 0.92', () => {
    const r = getArtisanRate('RURAL-FRANCE')
    expect(r.min).toBe(Math.round(ARTISAN_RATE_BASE.min * 0.92))
  })

  it('STANDARD-FRANCE renvoie base × 1.00', () => {
    const r = getArtisanRate('STANDARD-FRANCE')
    expect(r.min).toBe(ARTISAN_RATE_BASE.min)
    expect(r.max).toBe(ARTISAN_RATE_BASE.max)
  })

  it('zone inconnue (défense) → STANDARD-FRANCE', () => {
    // @ts-expect-error invalid zone
    const r = getArtisanRate('UNKNOWN')
    expect(r.min).toBe(ARTISAN_RATE_BASE.min)
  })
})
