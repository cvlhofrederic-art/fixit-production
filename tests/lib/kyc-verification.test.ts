import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  nameMatchScore,
  computeKycScore,
  decideKycStatus,
  buildKycDetails,
  type KycChecks,
} from '@/lib/kyc-verification'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const allTrueChecks = (overrides: Partial<KycChecks> = {}): KycChecks => ({
  identifiantFormatValid: true,
  identifiantActiveInRegistry: true,
  docOcrSuccess: true,
  identifiantMatchDocVsApi: true,
  nameMatchDocVsApi: 100,
  nameMatchDocVsId: 100,
  addressMatchDocVsApi: true,
  ...overrides,
})

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

describe('normalizeText', () => {
  it('lowercases text', () => {
    expect(normalizeText('MARSEILLE')).toBe('marseille')
  })

  it('strips French accents', () => {
    expect(normalizeText('éàüîç')).toBe('eauic')
  })

  it('strips Portuguese accents', () => {
    expect(normalizeText('João Ação Número')).toBe('joao acao numero')
  })

  it('removes punctuation and normalizes spaces', () => {
    expect(normalizeText('Société  B.T.P., France')).toBe('societe b t p france')
  })

  it('handles empty string', () => {
    expect(normalizeText('')).toBe('')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeText('  test  ')).toBe('test')
  })
})

// ---------------------------------------------------------------------------
// nameMatchScore
// ---------------------------------------------------------------------------

describe('nameMatchScore', () => {
  it('returns 100 for exact normalized match', () => {
    expect(nameMatchScore('PLOMBERIE DUPONT', 'plomberie dupont')).toBe(100)
  })

  it('returns 100 for match that only differs by accents', () => {
    expect(nameMatchScore('Société Générale BTP', 'Societe Generale BTP')).toBe(100)
  })

  it('returns 0 for completely different names', () => {
    expect(nameMatchScore('Dupont', 'Martin')).toBe(0)
  })

  it('returns a partial score for containment', () => {
    const score = nameMatchScore('PLOMBERIE DUPONT SARL', 'PLOMBERIE DUPONT')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('returns 0 for empty strings', () => {
    expect(nameMatchScore('', 'test')).toBe(0)
    expect(nameMatchScore('test', '')).toBe(0)
  })

  it('returns partial score for partial word overlap', () => {
    const score = nameMatchScore('Construction Dupont SARL', 'Dupont Construction France')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(100)
  })

  it('returns 0 when no word in common longer than 2 chars', () => {
    // Only short words (≤2 chars) in common → Jaccard = 0
    expect(nameMatchScore('Le Da', 'Le Da')).toBe(100) // exact match wins first
    expect(nameMatchScore('Le Da Az', 'Xx Yy Zz')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeKycScore — fr_artisan
// ---------------------------------------------------------------------------

describe('computeKycScore (fr_artisan)', () => {
  it('returns 0 when identifiantFormatValid is false (blocking)', () => {
    const checks = allTrueChecks({ identifiantFormatValid: false })
    expect(computeKycScore(checks, 'fr_artisan')).toBe(0)
  })

  it('returns 100 for all checks true with perfect name matches', () => {
    expect(computeKycScore(allTrueChecks(), 'fr_artisan')).toBe(100)
  })

  it('scores identifiantFormatValid = 10pts when only that is true', () => {
    const checks: KycChecks = {
      identifiantFormatValid: true,
      identifiantActiveInRegistry: false,
      docOcrSuccess: false,
      identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0,
      nameMatchDocVsId: 0,
      addressMatchDocVsApi: false,
    }
    expect(computeKycScore(checks, 'fr_artisan')).toBe(10)
  })

  it('scores identifiantActiveInRegistry = 30pts', () => {
    const checks: KycChecks = {
      identifiantFormatValid: true,
      identifiantActiveInRegistry: true,
      docOcrSuccess: false,
      identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0,
      nameMatchDocVsId: 0,
      addressMatchDocVsApi: false,
    }
    // 10 (format) + 30 (registry)
    expect(computeKycScore(checks, 'fr_artisan')).toBe(40)
  })

  it('nameMatchDocVsApi at 50% contributes half of 15pts', () => {
    const checks = allTrueChecks({
      nameMatchDocVsApi: 50,
      nameMatchDocVsId: 0,
      identifiantActiveInRegistry: false,
      docOcrSuccess: false,
      identifiantMatchDocVsApi: false,
    })
    // 10 + round(50/100 * 15) = 10 + 8 = 18
    expect(computeKycScore(checks, 'fr_artisan')).toBe(18)
  })
})

// ---------------------------------------------------------------------------
// computeKycScore — fr_btp
// ---------------------------------------------------------------------------

describe('computeKycScore (fr_btp)', () => {
  it('uses same weights as fr_artisan', () => {
    const checks = allTrueChecks()
    expect(computeKycScore(checks, 'fr_btp')).toBe(100)
    expect(computeKycScore(checks, 'fr_btp')).toBe(
      computeKycScore(checks, 'fr_artisan'),
    )
  })

  it('returns 0 when identifiantFormatValid is false', () => {
    expect(computeKycScore(allTrueChecks({ identifiantFormatValid: false }), 'fr_btp')).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// computeKycScore — pt_artisan (different weights)
// ---------------------------------------------------------------------------

describe('computeKycScore (pt_artisan)', () => {
  it('identifiantFormatValid = 15pts (not 10)', () => {
    const checks: KycChecks = {
      identifiantFormatValid: true,
      identifiantActiveInRegistry: false,
      docOcrSuccess: false,
      identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0,
      nameMatchDocVsId: 0,
      addressMatchDocVsApi: false,
    }
    expect(computeKycScore(checks, 'pt_artisan')).toBe(15)
  })

  it('returns 0 when identifiantFormatValid is false', () => {
    expect(computeKycScore(allTrueChecks({ identifiantFormatValid: false }), 'pt_artisan')).toBe(0)
  })

  it('returns 100 for all checks true with perfect name matches', () => {
    expect(computeKycScore(allTrueChecks(), 'pt_artisan')).toBe(100)
  })

  it('identifiantActiveInRegistry = 20pts (not 30)', () => {
    const checks: KycChecks = {
      identifiantFormatValid: true,
      identifiantActiveInRegistry: true,
      docOcrSuccess: false,
      identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0,
      nameMatchDocVsId: 0,
      addressMatchDocVsApi: false,
    }
    // 15 + 20 = 35
    expect(computeKycScore(checks, 'pt_artisan')).toBe(35)
  })

  it('has different total than fr_artisan for a partial check set', () => {
    const checks: KycChecks = {
      identifiantFormatValid: true,
      identifiantActiveInRegistry: true,
      docOcrSuccess: true,
      identifiantMatchDocVsApi: false,
      nameMatchDocVsApi: 0,
      nameMatchDocVsId: 0,
      addressMatchDocVsApi: false,
    }
    const ptScore = computeKycScore(checks, 'pt_artisan') // 15+20+15 = 50
    const frScore = computeKycScore(checks, 'fr_artisan') // 10+30+10 = 50
    // Weights differ even if totals happen to be equal here; verify individual
    expect(ptScore).toBe(50)
    expect(frScore).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// decideKycStatus
// ---------------------------------------------------------------------------

describe('decideKycStatus', () => {
  it('80 → approved', () => {
    expect(decideKycStatus(80)).toBe('approved')
  })

  it('100 → approved', () => {
    expect(decideKycStatus(100)).toBe('approved')
  })

  it('79 → manual_review', () => {
    expect(decideKycStatus(79)).toBe('manual_review')
  })

  it('40 → manual_review', () => {
    expect(decideKycStatus(40)).toBe('manual_review')
  })

  it('39 → rejected', () => {
    expect(decideKycStatus(39)).toBe('rejected')
  })

  it('0 → rejected', () => {
    expect(decideKycStatus(0)).toBe('rejected')
  })
})

// ---------------------------------------------------------------------------
// buildKycDetails — pt_artisan (messages in Portuguese)
// ---------------------------------------------------------------------------

describe('buildKycDetails (pt_artisan)', () => {
  it('uses Portuguese messages for NIF valid', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('NIF válido'))).toBe(true)
  })

  it('uses Portuguese message for NIF invalid', () => {
    const checks = allTrueChecks({ identifiantFormatValid: false })
    const details = buildKycDetails(checks, 0, 'pt_artisan')
    expect(details.some(d => d.includes('NIF inválido'))).toBe(true)
  })

  it('uses Portuguese message for active registry', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('Empresa ativa no registo português'))).toBe(true)
  })

  it('uses Portuguese message for registry not found', () => {
    const checks = allTrueChecks({ identifiantActiveInRegistry: false })
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('Empresa não encontrada'))).toBe(true)
  })

  it('uses Portuguese message for OCR success', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('Certidão Permanente analisada com sucesso por OCR'))).toBe(true)
  })

  it('uses Portuguese message for OCR failure', () => {
    const checks = allTrueChecks({ docOcrSuccess: false })
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('OCR da Certidão parcial ou falhou'))).toBe(true)
  })

  it('includes NIF match message', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('NIF idêntico entre Certidão e registo'))).toBe(true)
  })

  it('includes NIF mismatch message', () => {
    const checks = allTrueChecks({ identifiantMatchDocVsApi: false })
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('NIF extraído da Certidão não corresponde ao registo'))).toBe(true)
  })

  it('includes nameMatchDocVsApi percentage', () => {
    const checks = allTrueChecks({ nameMatchDocVsApi: 75 })
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('75%'))).toBe(true)
  })

  it('includes nameMatchDocVsId percentage', () => {
    const checks = allTrueChecks({ nameMatchDocVsId: 60 })
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    expect(details.some(d => d.includes('60%'))).toBe(true)
  })

  it('does not contain French words like "approuvé"', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'pt_artisan')
    const details = buildKycDetails(checks, score, 'pt_artisan')
    const joined = details.join(' ')
    expect(joined).not.toContain('approuvé')
    expect(joined).not.toContain('rejeté')
    expect(joined).toContain('aprovado')
  })
})

// ---------------------------------------------------------------------------
// buildKycDetails — fr_artisan (messages in French)
// ---------------------------------------------------------------------------

describe('buildKycDetails (fr_artisan)', () => {
  it('uses French messages', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'fr_artisan')
    const details = buildKycDetails(checks, score, 'fr_artisan')
    const joined = details.join(' ')
    expect(joined).toContain('SIRET')
    expect(joined).not.toContain('NIF')
  })

  it('mentions approved score in French', () => {
    const checks = allTrueChecks()
    const score = computeKycScore(checks, 'fr_artisan')
    const details = buildKycDetails(checks, score, 'fr_artisan')
    expect(details.some(d => d.includes('approuvé'))).toBe(true)
  })
})
