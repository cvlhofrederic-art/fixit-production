import { describe, it, expect } from 'vitest'
import { hasRawPrice, validateAndSubstitute, formatEUR, RAW_PRICE_PATTERN } from '@/app/api/simulateur-travaux/token-substitution'
import type { ComputeQuoteResult } from '@/lib/prix-travaux-2026/compute'

describe('RAW_PRICE_PATTERN', () => {
  it.each([
    '1500 €',
    '1 500 €',
    '1 500 €',  // espace insécable
    '1.500,50 €',
    '1500€',
    '12 €',
    'environ 9 999 €',
  ])('matche prix brut "%s"', (input) => {
    expect(hasRawPrice(input)).toBe(true)
  })

  it.each([
    'année 2026',
    'surface 30 m²',
    'puissance 8 kW',
    'plage 120-160 m²',
    'taux de 5 % à 20 %',
    'rien d\'utile ici',
    '',
    'symbole € seul sans chiffre',
  ])('ne matche PAS "%s"', (input) => {
    expect(hasRawPrice(input)).toBe(false)
  })
})

describe('formatEUR', () => {
  it('formate avec espace insécable', () => {
    expect(formatEUR(612)).toBe('612 €')
    expect(formatEUR(1500)).toBe('1 500 €')
    expect(formatEUR(0)).toBe('0 €')
  })
})

describe('validateAndSubstitute', () => {
  const ctx: ComputeQuoteResult = {
    totalMin: 612, totalMax: 720, spreadPercent: 0.18,
    breakdown: [
      { taskId: 'peinture-murs-interieur-2couches', label: 'Peinture', qty: 25, unit: 'm2',
        unitPriceMin: 28, unitPriceMax: 34, lineMin: 612, lineMax: 720 },
    ],
    zoneCoef: 1.05, gammeCoef: 1.0, etatCoef: 1.0,
    zoneDetected: 'PACA', tvaApplicable: 10, sources: [], mode: 'normal',
  }

  it('substitue {TOTAL_MIN} par valeur', () => {
    const out = validateAndSubstitute('Total : {TOTAL_MIN} — {TOTAL_MAX}', ctx)
    expect(out).toBe('Total : 612 € — 720 €')
  })

  it('substitue {LINE_<taskId>_MIN}', () => {
    const out = validateAndSubstitute('Ligne : {LINE_peinture-murs-interieur-2couches_MIN}', ctx)
    expect(out).toBe('Ligne : 612 €')
  })

  it('substitue {UNIT_<taskId>_MIN}', () => {
    const out = validateAndSubstitute('Unitaire : {UNIT_peinture-murs-interieur-2couches_MIN}', ctx)
    expect(out).toBe('Unitaire : 28 €')
  })

  it('substitue {ZONE_NAME}', () => {
    const out = validateAndSubstitute('Zone : {ZONE_NAME}', ctx)
    expect(out).toBe('Zone : PACA')
  })

  it('placeholder inconnu reste tel quel', () => {
    const out = validateAndSubstitute('Mystere : {WTF_VALUE}', ctx)
    expect(out).toBe('Mystere : {WTF_VALUE}')
  })

  it('skip chunk si prix brut détecté', () => {
    const out = validateAndSubstitute('Le total est environ 1500 €', ctx)
    expect(out).toBe('')
  })

  it('skip ne déclenche pas si pas de €', () => {
    const out = validateAndSubstitute('Surface 30 m² en 2026', ctx)
    expect(out).toBe('Surface 30 m² en 2026')
  })

  it('substitue {ARTISAN_RATE_MIN/MAX} en mode out-of-catalog', () => {
    const ooc: ComputeQuoteResult = {
      ...ctx,
      mode: 'out-of-catalog',
      breakdown: [],
      totalMin: 0,
      totalMax: 0,
      artisanRate: { min: 53, max: 79, unit: 'EUR_TTC_par_heure' },
    }
    const out = validateAndSubstitute('Tarif : {ARTISAN_RATE_MIN}/h — {ARTISAN_RATE_MAX}/h', ooc)
    expect(out).toBe('Tarif : 53 €/h — 79 €/h')
  })

  it('substitue {AIDES_TOTAL} et {TOTAL_NET_MIN/MAX}', () => {
    const withAides: ComputeQuoteResult = {
      ...ctx,
      totalNetMin: 412,
      totalNetMax: 520,
      aidesDeduites: { maPrimeRenov: 200, cee: 0, tvaEconomie: 0, ecoPTZ: { eligible: false }, total: 200 },
    }
    const out = validateAndSubstitute('Aides : -{AIDES_TOTAL}, net {TOTAL_NET_MIN} — {TOTAL_NET_MAX}', withAides)
    expect(out).toBe('Aides : -200 €, net 412 € — 520 €')
  })
})
