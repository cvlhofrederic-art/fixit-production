import { describe, it, expect } from 'vitest'
import {
  TVA_REGIMES,
  MENTIONS_LEGALES,
  computeTva,
  validateRegime,
  getMentionLegale,
  type TvaRegime,
} from '@/lib/tva-calculator'

describe('TVA_REGIMES', () => {
  it('exposes the three legal regimes', () => {
    expect(TVA_REGIMES).toEqual(['classique', 'franchise_293b', 'autoliquidation_btp'])
  })
})

describe('MENTIONS_LEGALES', () => {
  it('classique has no special mention', () => {
    expect(MENTIONS_LEGALES.classique).toBeNull()
  })

  it('franchise_293b uses official wording from CGI art. 293 B', () => {
    expect(MENTIONS_LEGALES.franchise_293b).toBe('TVA non applicable, article 293 B du CGI.')
  })

  it('autoliquidation_btp uses official wording from CGI art. 283, 2 nonies', () => {
    expect(MENTIONS_LEGALES.autoliquidation_btp).toBe(
      'Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.',
    )
  })
})

describe('computeTva — regime classique', () => {
  it('aggregates TVA per rate', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [
        { totalHT: 100, tvaRate: 20 },
        { totalHT: 50, tvaRate: 10 },
        { totalHT: 200, tvaRate: 20 },
      ],
    })
    expect(result.breakdown).toHaveLength(2)
    const tva20 = result.breakdown.find(b => b.rate === 20)
    const tva10 = result.breakdown.find(b => b.rate === 10)
    expect(tva20).toEqual({ rate: 20, base: 300, amount: 60 })
    expect(tva10).toEqual({ rate: 10, base: 50, amount: 5 })
    expect(result.totalHT).toBe(350)
    expect(result.totalTVA).toBe(65)
    expect(result.totalTTC).toBe(415)
  })

  it('returns TOTAL TTC label and shows TVA breakdown', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [{ totalHT: 100, tvaRate: 20 }],
    })
    expect(result.totalLabel).toBe('TOTAL TTC')
    expect(result.showsTvaBreakdown).toBe(true)
    expect(result.mention).toBeNull()
  })

  it('respects HT + TVA = TTC invariant', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [{ totalHT: 99.99, tvaRate: 20 }],
    })
    expect(result.invariantOk).toBe(true)
    expect(result.totalHT + result.totalTVA).toBeCloseTo(result.totalTTC, 2)
  })

  it('ignores lines with tvaRate=0 in breakdown', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [
        { totalHT: 100, tvaRate: 20 },
        { totalHT: 50, tvaRate: 0 },
      ],
    })
    expect(result.breakdown).toHaveLength(1)
    expect(result.totalTVA).toBe(20)
    expect(result.totalTTC).toBe(170)
  })
})

describe('computeTva — regime franchise_293b', () => {
  it('forces all TVA to 0 regardless of line tvaRate', () => {
    const result = computeTva({
      regime: 'franchise_293b',
      lines: [
        { totalHT: 100, tvaRate: 20 },
        { totalHT: 50, tvaRate: 10 },
      ],
    })
    expect(result.breakdown).toEqual([])
    expect(result.totalTVA).toBe(0)
    expect(result.totalTTC).toBe(150)
    expect(result.totalHT).toBe(150)
  })

  it('returns TOTAL NET label and hides TVA breakdown', () => {
    const result = computeTva({
      regime: 'franchise_293b',
      lines: [{ totalHT: 100, tvaRate: 20 }],
    })
    expect(result.totalLabel).toBe('TOTAL NET')
    expect(result.showsTvaBreakdown).toBe(false)
  })

  it('renders 293 B mention', () => {
    const result = computeTva({
      regime: 'franchise_293b',
      lines: [{ totalHT: 100, tvaRate: 0 }],
    })
    expect(result.mention).toBe('TVA non applicable, article 293 B du CGI.')
  })

  it('does not require client SIREN nor emitter intracom', () => {
    const result = computeTva({
      regime: 'franchise_293b',
      lines: [{ totalHT: 100, tvaRate: 0 }],
    })
    expect(result.requiresClientSiren).toBe(false)
    expect(result.requiresEmitterTvaIntra).toBe(false)
  })
})

describe('computeTva — regime autoliquidation_btp', () => {
  it('forces TVA to 0, total = HT', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [
        { totalHT: 5000, tvaRate: 20 },
        { totalHT: 1500, tvaRate: 20 },
      ],
    })
    expect(result.breakdown).toEqual([])
    expect(result.totalTVA).toBe(0)
    expect(result.totalHT).toBe(6500)
    expect(result.totalTTC).toBe(6500)
  })

  it('returns TOTAL NET label and hides TVA breakdown', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [{ totalHT: 1000, tvaRate: 20 }],
    })
    expect(result.totalLabel).toBe('TOTAL NET')
    expect(result.showsTvaBreakdown).toBe(false)
  })

  it('renders 283, 2 nonies mention', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [{ totalHT: 1000, tvaRate: 20 }],
    })
    expect(result.mention).toBe(
      'Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.',
    )
  })

  it('requires client SIREN and emitter intracom', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [{ totalHT: 1000, tvaRate: 20 }],
    })
    expect(result.requiresClientSiren).toBe(true)
    expect(result.requiresEmitterTvaIntra).toBe(true)
  })
})

describe('computeTva — edge cases', () => {
  it('handles empty lines list', () => {
    const result = computeTva({ regime: 'classique', lines: [] })
    expect(result.totalHT).toBe(0)
    expect(result.totalTVA).toBe(0)
    expect(result.totalTTC).toBe(0)
    expect(result.breakdown).toEqual([])
  })

  it('handles mixed rates with rounding (BOFiP §50)', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [
        { totalHT: 33.33, tvaRate: 20 },
        { totalHT: 66.67, tvaRate: 10 },
      ],
    })
    expect(result.totalHT).toBe(100)
    expect(result.totalTVA).toBe(13.34)
    expect(result.invariantOk).toBe(true)
  })

  it('coerces negative or NaN lines to safe values', () => {
    const result = computeTva({
      regime: 'classique',
      lines: [
        { totalHT: Number.NaN, tvaRate: 20 },
        { totalHT: 100, tvaRate: 20 },
      ],
    })
    expect(result.totalHT).toBe(100)
    expect(result.totalTVA).toBe(20)
  })
})

describe('validateRegime — guards on regime switch', () => {
  it('issuer in franchise cannot charge TVA classique', () => {
    const errs = validateRegime({
      regime: 'classique',
      issuerRegime: 'franchise_base',
    })
    expect(errs).toContain('issuer_franchise_cannot_charge_tva')
  })

  it('issuer in franchise cannot autoliquidate', () => {
    const errs = validateRegime({
      regime: 'autoliquidation_btp',
      issuerRegime: 'franchise_base',
      clientType: 'professionnel',
      clientSiren: '123456789',
      emitterTvaIntra: 'FR12345678901',
    })
    expect(errs).toContain('issuer_franchise_cannot_autoliquidate')
  })

  it('B2C: client particulier cannot autoliquidate', () => {
    const errs = validateRegime({
      regime: 'autoliquidation_btp',
      issuerRegime: 'assujetti_normal',
      clientType: 'particulier',
    })
    expect(errs).toContain('client_particulier_cannot_autoliquidate')
  })

  it('autoliquidation requires client SIREN', () => {
    const errs = validateRegime({
      regime: 'autoliquidation_btp',
      issuerRegime: 'assujetti_normal',
      clientType: 'professionnel',
      clientSiren: '',
      emitterTvaIntra: 'FR12345678901',
    })
    expect(errs).toContain('autoliquidation_requires_client_siren')
  })

  it('autoliquidation requires emitter intracom', () => {
    const errs = validateRegime({
      regime: 'autoliquidation_btp',
      issuerRegime: 'assujetti_normal',
      clientType: 'professionnel',
      clientSiren: '123456789',
      emitterTvaIntra: '',
    })
    expect(errs).toContain('autoliquidation_requires_emitter_tva_intra')
  })

  it('valid autoliquidation setup returns no errors', () => {
    const errs = validateRegime({
      regime: 'autoliquidation_btp',
      issuerRegime: 'assujetti_normal',
      clientType: 'professionnel',
      clientSiren: '123456789',
      emitterTvaIntra: 'FR12345678901',
    })
    expect(errs).toEqual([])
  })

  it('valid classique with assujetti issuer returns no errors', () => {
    const errs = validateRegime({
      regime: 'classique',
      issuerRegime: 'assujetti_normal',
    })
    expect(errs).toEqual([])
  })

  it('franchise regime has no validation requirements', () => {
    const errs = validateRegime({
      regime: 'franchise_293b',
      issuerRegime: 'franchise_base',
    })
    expect(errs).toEqual([])
  })
})

describe('getMentionLegale — locale-aware mentions', () => {
  it('FR franchise renders art. 293 B CGI wording', () => {
    expect(getMentionLegale('franchise_293b', 'fr')).toBe('TVA non applicable, article 293 B du CGI.')
  })

  it('PT franchise renders art. 53.º CIVA wording', () => {
    expect(getMentionLegale('franchise_293b', 'pt')).toBe('IVA não aplicável, artigo 53.º do CIVA.')
  })

  it('FR autoliquidation renders art. 283, 2 nonies CGI wording', () => {
    expect(getMentionLegale('autoliquidation_btp', 'fr')).toBe(
      'Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.',
    )
  })

  it('PT autoliquidation renders art. 2.º n.º 1 al. j) CIVA wording (inversão do sujeito passivo)', () => {
    expect(getMentionLegale('autoliquidation_btp', 'pt')).toBe(
      'IVA - autoliquidação, alínea j) do n.º 1 do artigo 2.º do CIVA.',
    )
  })

  it('classique never has a mention regardless of locale', () => {
    expect(getMentionLegale('classique', 'fr')).toBeNull()
    expect(getMentionLegale('classique', 'pt')).toBeNull()
  })

  it('defaults to FR when locale omitted', () => {
    expect(getMentionLegale('autoliquidation_btp')).toBe(
      'Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.',
    )
  })
})

describe('computeTva — locale support', () => {
  it('returns PT mention when locale=pt', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [{ totalHT: 1000, tvaRate: 23 }],
      locale: 'pt',
    })
    expect(result.mention).toBe('IVA - autoliquidação, alínea j) do n.º 1 do artigo 2.º do CIVA.')
  })

  it('returns FR mention when locale=fr or omitted', () => {
    const result = computeTva({
      regime: 'autoliquidation_btp',
      lines: [{ totalHT: 1000, tvaRate: 20 }],
    })
    expect(result.mention).toBe('Autoliquidation — Article 283, 2 nonies du CGI. TVA due par le preneur.')
  })
})

describe('TvaRegime type', () => {
  it('accepts only the three legal values', () => {
    const r1: TvaRegime = 'classique'
    const r2: TvaRegime = 'franchise_293b'
    const r3: TvaRegime = 'autoliquidation_btp'
    expect([r1, r2, r3]).toHaveLength(3)
  })
})
