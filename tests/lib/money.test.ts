/**
 * tests/lib/money.test.ts — Tests unitaires des helpers monétaires.
 *
 * Couvre : round2 ROUND_HALF_UP BOFiP, mulMoney cas Adeline,
 * sumMoney sans drift, computeAcomptesAmounts dernier-rattrape,
 * parseDecimalInput virgule FR, edge cases NaN/Infinity, invariants.
 */
import { describe, it, expect } from 'vitest'
import {
  round2,
  round4,
  toCents,
  fromCents,
  mulMoney,
  sumMoney,
  parseDecimalInput,
  parseDecimalInput4,
  computeAcomptesAmounts,
  assertInvoiceInvariant,
} from '@/lib/money'

describe('round2 — ROUND_HALF_UP commercial (BOFiP BOI-TVA-DECLA-30-20-20 §50)', () => {
  it('arrondit 1.005 à 1.01 (pas 1.00 comme toFixed/banker)', () => {
    expect(round2(1.005)).toBe(1.01)
  })

  it('arrondit 1.015 à 1.02 (cas où toFixed casse à cause flottant)', () => {
    expect(round2(1.015)).toBe(1.02)
  })

  it('arrondit 1.045 à 1.05 (toFixed donne 1.04)', () => {
    expect(round2(1.045)).toBe(1.05)
  })

  it('arrondit 0.1 + 0.2 à 0.30 (cas drift IEEE 754)', () => {
    expect(round2(0.1 + 0.2)).toBe(0.30)
  })

  it('arrondit -0.005 à -0.01 (symétrique commercial — fix BUG-3 hotfix audit)', () => {
    // FIX HOTFIX 04/05/2026 : Math.round(-0.5) === 0 en JS (asymétrique).
    // Sur les remises, l\'arrondi commercial doit être SYMÉTRIQUE pour ne pas
    // drifter en faveur de l\'artisan (contestation client). Implémentation
    // via sign × Math.round(|n|).
    expect(round2(-0.005)).toBe(-0.01)
  })

  it('arrondit NaN à 0 (garde-fou)', () => {
    expect(round2(NaN)).toBe(0)
  })

  it('arrondit Infinity à 0 (garde-fou)', () => {
    expect(round2(Infinity)).toBe(0)
    expect(round2(-Infinity)).toBe(0)
  })

  it('garde 100 inchangé', () => {
    expect(round2(100)).toBe(100)
  })

  it('garde 100.00 inchangé', () => {
    expect(round2(100.00)).toBe(100)
  })

  it('arrondit 6.30 × 1.20 (TVA 20%) à 7.56 sans drift', () => {
    expect(round2(6.30 * 1.20)).toBe(7.56)
  })
})

describe('round4 — 4 décimales (PU étude de prix BTP)', () => {
  it('garde 381.8182 à 381.8182', () => {
    expect(round4(381.8182)).toBe(381.8182)
  })

  it('arrondit 381.81818 à 381.8182 (5e décimale)', () => {
    expect(round4(381.81818)).toBe(381.8182)
  })

  it('NaN → 0', () => {
    expect(round4(NaN)).toBe(0)
  })
})

describe('toCents / fromCents — conversion entiers', () => {
  it('toCents(1.23) === 123', () => {
    expect(toCents(1.23)).toBe(123)
  })

  it('toCents(0.1) === 10 (pas 9 comme drift naïf)', () => {
    expect(toCents(0.1)).toBe(10)
  })

  it('fromCents(123) === 1.23', () => {
    expect(fromCents(123)).toBe(1.23)
  })

  it('toCents(NaN) === 0', () => {
    expect(toCents(NaN)).toBe(0)
  })
})

describe('mulMoney — multiplication monétaire arrondie', () => {
  it('5 × 381.8181818 → 1909.09 (cas Adeline DEV-2026-001 PU réel)', () => {
    expect(mulMoney(5, 381.8181818181818)).toBe(1909.09)
  })

  it('5 × 381.82 → 1909.10 (saisie 2 décimales — 1 cent d\'écart inhérent)', () => {
    expect(mulMoney(5, 381.82)).toBe(1909.10)
  })

  it('TVA 5,5% sur 100 → 5.50 sans drift', () => {
    expect(mulMoney(100, 0.055)).toBe(5.50)
  })

  it('TVA 20% sur 6.30 → 1.26 (pas 1.2600000000000002)', () => {
    expect(mulMoney(6.30, 0.20)).toBe(1.26)
  })

  it('quantité 0 → 0', () => {
    expect(mulMoney(0, 100)).toBe(0)
  })

  it('quantité 0.5 (demi-journée) × 250 → 125.00', () => {
    expect(mulMoney(0.5, 250)).toBe(125.00)
  })

  it('NaN input → 0 (garde-fou anti-pollution)', () => {
    expect(mulMoney(NaN, 100)).toBe(0)
    expect(mulMoney(1, NaN)).toBe(0)
  })

  it('Infinity input → 0 (garde-fou DoS)', () => {
    expect(mulMoney(1, Infinity)).toBe(0)
    expect(mulMoney(Infinity, 100)).toBe(0)
  })

  it('valeur négative (remise) → résultat négatif arrondi', () => {
    expect(mulMoney(1, -10.005)).toBe(-10.01)
  })
})

describe('sumMoney — somme via centimes entiers (zéro drift)', () => {
  it('30 × 100.10 = 3003.00 sans drift', () => {
    const lines = Array(30).fill(100.10)
    expect(sumMoney(lines)).toBe(3003.00)
  })

  it('0.1 répété 10 fois = 1.00 (cas IEEE 754 classique)', () => {
    expect(sumMoney(Array(10).fill(0.1))).toBe(1.00)
  })

  it('liste vide = 0', () => {
    expect(sumMoney([])).toBe(0)
  })

  it('NaN dans la liste → ignoré (pas NaN pollution)', () => {
    expect(sumMoney([10, NaN, 20])).toBe(30)
  })

  it('gros volume devis BTP — 50 lignes 1234.56 = 61728.00', () => {
    const lines = Array(50).fill(1234.56)
    expect(sumMoney(lines)).toBe(61728.00)
  })

  it('cas Adeline page 2 (8 sections HT 10%) — somme exacte', () => {
    const lines = [7636.36, 8090.91, 6600.00, 3509.09, 8090.91, 8545.45, 1909.10]
    expect(sumMoney(lines)).toBe(44381.82)
  })
})

describe('parseDecimalInput — gestion virgule FR + edge cases', () => {
  it('"381.82" → 381.82', () => {
    expect(parseDecimalInput('381.82')).toBe(381.82)
  })

  it('"381,82" → 381.82 (virgule FR Mac/Windows)', () => {
    expect(parseDecimalInput('381,82')).toBe(381.82)
  })

  it('"1 234,56" → 1234.56 (espaces de milliers)', () => {
    expect(parseDecimalInput('1 234,56')).toBe(1234.56)
  })

  it('"1 234,56" → 1234.56 (NBSP)', () => {
    expect(parseDecimalInput('1 234,56')).toBe(1234.56)
  })

  it('"" (chaîne vide) → 0', () => {
    expect(parseDecimalInput('')).toBe(0)
  })

  it('"abc" → 0', () => {
    expect(parseDecimalInput('abc')).toBe(0)
  })

  it('"-100" (négatif) → 0 (refus)', () => {
    expect(parseDecimalInput('-100')).toBe(0)
  })

  it('"1e308" (overflow) → 0 (anti-DoS)', () => {
    expect(parseDecimalInput('1e308')).toBe(0)
  })

  it('100 (number direct) → 100', () => {
    expect(parseDecimalInput(100)).toBe(100)
  })

  it('NaN (number) → 0', () => {
    expect(parseDecimalInput(NaN)).toBe(0)
  })

  it('respecte max custom (1000) — 1500 → 0', () => {
    expect(parseDecimalInput('1500', 1000)).toBe(0)
  })

  it('"1,5,3" (virgule multiple) → 1.5 (parseFloat tronque)', () => {
    // parseFloat("1.5.3") s'arrête au 2e point — comportement attendu
    expect(parseDecimalInput('1,5,3')).toBe(1.5)
  })
})

describe('computeAcomptesAmounts — dernier acompte rattrape le résidu', () => {
  it('33,33% / 33,33% / 33,34% sur 100,01 → somme = 100,01 exact', () => {
    const result = computeAcomptesAmounts(100.01, [
      { pourcentage: 33.33 },
      { pourcentage: 33.33 },
      { pourcentage: 33.34 },
    ])
    expect(sumMoney(result)).toBe(100.01)
    expect(result[2]).toBeGreaterThanOrEqual(33.34)
  })

  it('30 / 40 / 30 sur 75 500,01 → somme = 75 500,01 exact', () => {
    const result = computeAcomptesAmounts(75500.01, [
      { pourcentage: 30 },
      { pourcentage: 40 },
      { pourcentage: 30 },
    ])
    expect(sumMoney(result)).toBe(75500.01)
  })

  it('1 acompte 100% → [total]', () => {
    const result = computeAcomptesAmounts(1234.56, [{ pourcentage: 100 }])
    expect(result).toEqual([1234.56])
  })

  it('liste vide → []', () => {
    expect(computeAcomptesAmounts(100, [])).toEqual([])
  })

  it('total 0 → tous à 0', () => {
    const result = computeAcomptesAmounts(0, [{ pourcentage: 50 }, { pourcentage: 50 }])
    expect(result).toEqual([0, 0])
  })

  it('total négatif → tous à 0 (garde-fou)', () => {
    const result = computeAcomptesAmounts(-100, [{ pourcentage: 50 }, { pourcentage: 50 }])
    expect(result).toEqual([0, 0])
  })

  it('NaN total → tous à 0', () => {
    const result = computeAcomptesAmounts(NaN, [{ pourcentage: 50 }])
    expect(result).toEqual([0])
  })
})

describe('assertInvoiceInvariant — Sous-total HT + TVA = TOTAL TTC', () => {
  it('cohérent : 68 600.01 + 6 900.00 = 75 500.01', () => {
    const r = assertInvoiceInvariant(68600.01, 6900.00, 75500.01)
    expect(r.ok).toBe(true)
    expect(r.delta).toBeLessThan(0.01)
  })

  it('détecte incohérence > 0,01', () => {
    const r = assertInvoiceInvariant(68600.01, 6292.73, 75500.01)
    expect(r.ok).toBe(false)
    expect(r.delta).toBeGreaterThan(500)
  })

  it('tolère 0,01 (drift centime acceptable)', () => {
    const r = assertInvoiceInvariant(100.00, 20.00, 120.00)
    expect(r.ok).toBe(true)
  })

  it('cas Adeline DEV-2026-001 — 68 600.01 HT, 6 292.73 + 80.00 TVA, 75 500.01 TTC', () => {
    // Test du bug PR #102 : breakdown TVA ≠ HT + TVA = TTC
    const r = assertInvoiceInvariant(68600.01, 6292.73 + 80.00, 75500.01)
    // Devrait être incohérent (avant fix)
    expect(r.ok).toBe(false)
    // Après fix (TVA 10% = 6820 sur base 68 200.01) :
    const rFixed = assertInvoiceInvariant(68600.01, 6820.00 + 80.00, 75500.01)
    expect(rFixed.ok).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HOTFIX AUDIT INTERNE 04/05/2026 — Tests régression pour 5 bugs critiques
// introduits par PR #103. Ces tests DOIVENT échouer sur le code avant fix.
// ═══════════════════════════════════════════════════════════════════════════

describe('HOTFIX BUG-1 — sumMoney drift sur valeurs avec demi-cents', () => {
  it('100 lignes à 1.005 € donnent 100.50 € (pas 101 €)', () => {
    // BUG : la pré-conversion en cents par item arrondit chaque demi-cent UP
    //       → 100 × Math.round(1.005×100) = 100×101 = 10100 cents = 101 €
    // FIX : sommer brut puis arrondir UNE FOIS en fin
    expect(sumMoney(Array(100).fill(1.005))).toBe(100.50)
  })

  it('2 lignes à 1.005 € = 2.01 € (round_half_up sur la somme)', () => {
    expect(sumMoney([1.005, 1.005])).toBe(2.01)
  })

  it('marge 1.005 % matériaux × 50 lignes BTP — pas de drift', () => {
    const lines = Array(50).fill(1.005)
    expect(sumMoney(lines)).toBe(50.25)
  })
})

describe('HOTFIX BUG-2 — computeAcomptesAmounts force 100 % sur acompte partiel', () => {
  it('1 acompte de 30 % sur 1000 € donne [300] (pas [1000])', () => {
    // BUG : `slice(0, -1)` = [], donc `last = total - 0 = total = 1000`
    //       → l\'utilisateur saisit "30% à la commande" et le PDF facture 100 %
    // FIX : si Σ pourcentages !== 100, ne pas rattraper le résidu
    expect(computeAcomptesAmounts(1000, [{ pourcentage: 30 }])).toEqual([300])
  })

  it('2 acomptes partiels (30 % + 50 %) donnent [300, 500] sur 1000 €', () => {
    expect(computeAcomptesAmounts(1000, [
      { pourcentage: 30 },
      { pourcentage: 50 },
    ])).toEqual([300, 500])
  })

  it('3 acomptes 33,33 % × 3 sur 100,01 (Σ=99,99) → [33.33, 33.33, 33.33] sans rattrapage', () => {
    // L\'utilisateur a saisi 99.99 % volontairement (1 cent réglé séparément)
    // → ne pas forcer à 100 %
    const r = computeAcomptesAmounts(100.01, [
      { pourcentage: 33.33 },
      { pourcentage: 33.33 },
      { pourcentage: 33.33 },
    ])
    expect(sumMoney(r)).toBeCloseTo(99.99, 2)
  })

  it('3 acomptes Σ=100 — le rattrapage absorbe le résidu sur le dernier', () => {
    // Cas où le rattrapage est légitime (Σ === 100)
    const r = computeAcomptesAmounts(100.01, [
      { pourcentage: 33.33 },
      { pourcentage: 33.33 },
      { pourcentage: 33.34 },
    ])
    expect(sumMoney(r)).toBe(100.01)
  })
})

describe('HOTFIX BUG-3 — round2 négatifs symétrique (remises)', () => {
  it('round2(-1.005) = -1.01 (symétrique commercial, pas Math.round natif)', () => {
    // BUG : Math.round(-0.5) === 0 en JS (asymétrique vers +∞)
    //       round2(-1.005) retournait -1 au lieu de -1.01
    //       → drift en faveur de l\'artisan sur les remises
    expect(round2(-1.005)).toBe(-1.01)
  })

  it('round2(-1.045) = -1.05', () => {
    expect(round2(-1.045)).toBe(-1.05)
  })

  it('round2(-0.005) = -0.01 (symétrique)', () => {
    expect(round2(-0.005)).toBe(-0.01)
  })

  it('round2(0.005) = 0.01 (positif)', () => {
    expect(round2(0.005)).toBe(0.01)
  })
})

describe('HOTFIX BUG-4 — parseDecimalInput sans cap silencieux à 10M €', () => {
  it('accepte un devis légitime de 12 000 000 € (gros chantier rénovation)', () => {
    // BUG : cap à 9_999_999.99 retournait 0 silencieusement
    // FIX : cap relevé à Number.MAX_SAFE_INTEGER / 100 (≈ 9 × 10^13)
    expect(parseDecimalInput('12000000')).toBe(12_000_000)
    expect(parseDecimalInput(12_000_000)).toBe(12_000_000)
  })

  it('accepte 999 999 999.99 € (immeuble HLM par exemple)', () => {
    expect(parseDecimalInput('999999999.99')).toBe(999_999_999.99)
  })

  it('refuse encore les vrais overflows (1e308, Infinity)', () => {
    expect(parseDecimalInput('1e308')).toBe(0)
    expect(parseDecimalInput(Infinity)).toBe(0)
  })
})

describe('HOTFIX BUG-5 — assertInvoiceInvariant tolérance <= 0.01', () => {
  it('delta exactement 0.01 → ok=true (tolérance inclusive)', () => {
    // BUG : `delta < 0.01` excluait le cas exact 0.01
    // FIX : `delta <= 0.01` (inclusive)
    const r = assertInvoiceInvariant(100.00, 20.00, 120.01)
    expect(r.ok).toBe(true)
  })

  it('delta 0.005 → ok=true', () => {
    const r = assertInvoiceInvariant(100.00, 20.005, 120.00)
    expect(r.ok).toBe(true)
  })

  it('delta 0.02 → ok=false (au-delà de la tolérance)', () => {
    const r = assertInvoiceInvariant(100.00, 20.00, 120.02)
    expect(r.ok).toBe(false)
  })
})

describe('parseDecimalInput4 — saisie PU 4 décimales (BTP étude de prix)', () => {
  it('"381.8181" → 381.8181 (4 décimales conservées)', () => {
    expect(parseDecimalInput4('381.8181')).toBe(381.8181)
  })

  it('"381,8181" → 381.8181 (virgule FR)', () => {
    expect(parseDecimalInput4('381,8181')).toBe(381.8181)
  })

  it('"381.81818" → 381.8182 (5e décimale arrondit à 4)', () => {
    expect(parseDecimalInput4('381.81818')).toBe(381.8182)
  })

  it('vide → 0', () => {
    expect(parseDecimalInput4('')).toBe(0)
  })

  it('NaN → 0', () => {
    expect(parseDecimalInput4(NaN)).toBe(0)
  })

  it('cas Adeline : 1909.09 / 5 = 381.818 (3 décimales) accepté tel quel', () => {
    expect(parseDecimalInput4('381.818')).toBe(381.818)
  })
})

describe('Cas réel — devis BTP multi-lignes mixed TVA', () => {
  it('subtotalHT + Σ TVA = totalTTC à 1 cent près sur 50 lignes mixtes', () => {
    const lines = Array.from({ length: 50 }, (_, i) => ({
      qty: i + 1,
      priceHT: 13.37 + i * 0.13,
      tvaRate: i % 3 === 0 ? 5.5 : i % 2 === 0 ? 10 : 20,
    }))
    const subtotalHT = sumMoney(lines.map(l => mulMoney(l.qty, l.priceHT)))
    const tvaByRate = new Map<number, number>()
    lines.forEach(l => {
      const ht = mulMoney(l.qty, l.priceHT)
      const taux = l.tvaRate
      const tva = mulMoney(ht, taux / 100)
      tvaByRate.set(taux, round2((tvaByRate.get(taux) || 0) + tva))
    })
    const totalTVA = sumMoney(Array.from(tvaByRate.values()))
    const totalTTC = round2(subtotalHT + totalTVA)
    const inv = assertInvoiceInvariant(subtotalHT, totalTVA, totalTTC)
    expect(inv.ok).toBe(true)
    expect(inv.delta).toBeLessThan(0.01)
  })
})
