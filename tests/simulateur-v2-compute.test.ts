import { describe, it, expect } from 'vitest'
import { computeQuote } from '@/lib/prix-travaux-2026/compute'

describe('computeQuote — math base', () => {
  it('items vides → mode out-of-catalog avec artisanRate', () => {
    const r = computeQuote({
      items: [],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.mode).toBe('out-of-catalog')
    expect(r.artisanRate?.unit).toBe('EUR_TTC_par_heure')
    expect(r.artisanRate?.min).toBe(Math.round(50 * 1.05))
    expect(r.totalMin).toBe(0)
    expect(r.totalMax).toBe(0)
    expect(r.breakdown).toEqual([])
  })

  it('peinture mur 25 m² PACA standard bon → applique zone 1.05', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.mode).toBe('normal')
    expect(r.zoneCoef).toBe(1.05)
    expect(r.gammeCoef).toBe(1.00)
    expect(r.etatCoef).toBe(1.00)
    expect(r.zoneDetected).toBe('PACA')
    expect(r.totalMin).toBe(Math.round(27 * 1.05) * 25)
    expect(r.totalMax).toBe(Math.round(32 * 1.05) * 25)
    expect(r.breakdown.length).toBe(1)
    expect(r.breakdown[0].lineMin).toBe(r.totalMin)
    expect(r.spreadPercent).toBeLessThanOrEqual(0.25)
  })

  it('même ligne IDF-PARIS premium très-dégradé → cumule coefficients', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: '75',
      gamme: 'premium',
      etat: 'tres-degrade',
    })
    expect(r.zoneCoef).toBe(1.30)
    expect(r.gammeCoef).toBe(1.15)
    expect(r.etatCoef).toBe(1.25)
    expect(r.zoneDetected).toBe('IDF-PARIS')
    expect(r.totalMin).toBe(Math.round(27 * 1.30 * 1.15 * 1.25) * 10)
  })

  it('détecte zone via postalCode (13008 → PACA)', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 5 }],
      postalCode: '13008',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.zoneDetected).toBe('PACA')
  })

  it('multi-items somme correctement', () => {
    const r = computeQuote({
      items: [
        { taskId: 'peinture-murs-interieur-2couches', qty: 25 },
        { taskId: 'peinture-plafond-2couches', qty: 20 },
      ],
      region: 'STANDARD-FRANCE',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.breakdown.length).toBe(2)
    expect(r.totalMin).toBe(r.breakdown[0].lineMin + r.breakdown[1].lineMin)
    expect(r.totalMax).toBe(r.breakdown[0].lineMax + r.breakdown[1].lineMax)
  })

  it('throw si taskId inconnu', () => {
    expect(() => computeQuote({
      items: [{ taskId: 'inexistant', qty: 1 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })).toThrow(/unknown taskId/i)
  })

  it('region absente, postalCode absent → STANDARD-FRANCE', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 5 }],
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.zoneDetected).toBe('STANDARD-FRANCE')
    expect(r.zoneCoef).toBe(1.00)
  })

  it('région sous forme code zone (ex "PACA") accepté directement', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 5 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.zoneDetected).toBe('PACA')
  })

  it('sources dédupliquées sur multi-items même métier', () => {
    const r = computeQuote({
      items: [
        { taskId: 'peinture-murs-interieur-2couches', qty: 25 },
        { taskId: 'peinture-plafond-2couches', qty: 20 },
      ],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const names = r.sources.map(s => s.name)
    const uniqueNames = new Set(names)
    expect(names.length).toBe(uniqueNames.size)
  })

  it('breakdown contient label + unit + qty + unitPrice', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(r.breakdown[0].label).toMatch(/peinture/i)
    expect(r.breakdown[0].unit).toBe('m2')
    expect(r.breakdown[0].qty).toBe(25)
    expect(r.breakdown[0].unitPriceMin).toBe(Math.round(27 * 1.05))
    expect(r.breakdown[0].unitPriceMax).toBe(Math.round(32 * 1.05))
  })
})
