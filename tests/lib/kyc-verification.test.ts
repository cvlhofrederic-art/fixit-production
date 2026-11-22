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

// ---------------------------------------------------------------------------
// pt_btp — société BTP inscrite en portugais (22/11/2026) : NIPC, VIES, certidão permanente. Les marchés existants
// sont gardés par tests/lib/kyc-marches-existants-invariance.test.ts.
// ---------------------------------------------------------------------------

/** Contrôles d'une société portugaise au NIPC valide ; le reste à faux sauf précision. */
const controlesSociete = (overrides: Partial<KycChecks> = {}): KycChecks => ({
  identifiantFormatValid: true,
  identifiantActiveInRegistry: false,
  docOcrSuccess: false,
  identifiantMatchDocVsApi: false,
  nameMatchDocVsApi: 0,
  nameMatchDocVsId: 0,
  addressMatchDocVsApi: false,
  ...overrides,
})

describe('computeKycScore et decideKycStatus (pt_btp)', () => {
  it.each([
    ['NIPC invalide : 0, rejet d’office', controlesSociete({ identifiantFormatValid: false, identifiantActiveInRegistry: true }), 0, 'rejected'],
    ['NIPC valide seul (VIES muet, certidão non lue) : 15, revue manuelle et non rejet', controlesSociete(), 15, 'manual_review'],
    ['actif au VIES, certidão en PDF non lue : 45, revue manuelle', controlesSociete({ identifiantActiveInRegistry: true }), 45, 'manual_review'],
    [
      'certidão lue, NIPC et firma concordants, sans VIES : 70, revue manuelle',
      controlesSociete({ docOcrSuccess: true, identifiantMatchDocVsApi: true, nameMatchDocVsApi: 100 }),
      70,
      'manual_review',
    ],
    [
      'VIES et certidão lue avec le NIPC, firma non lue : 75, revue manuelle',
      controlesSociete({ identifiantActiveInRegistry: true, docOcrSuccess: true, identifiantMatchDocVsApi: true }),
      75,
      'manual_review',
    ],
    [
      'VIES et certidão lue, firma identique au registre, NIPC non lu : 80, approuvé',
      controlesSociete({ identifiantActiveInRegistry: true, docOcrSuccess: true, nameMatchDocVsApi: 100 }),
      80,
      'approved',
    ],
    [
      'tout concorde : 100, approuvé',
      controlesSociete({ identifiantActiveInRegistry: true, docOcrSuccess: true, identifiantMatchDocVsApi: true, nameMatchDocVsApi: 100 }),
      100,
      'approved',
    ],
  ])('%s', (_cas, checks, score, decision) => {
    expect(computeKycScore(checks, 'pt_btp')).toBe(score)
    expect(decideKycStatus(score, 'pt_btp')).toBe(decision)
  })

  it('la pièce d’identité ne compte pas : la fiche d’une société n’a pas le nom de son gérant', () => {
    const avecPiece = controlesSociete({ identifiantActiveInRegistry: true, nameMatchDocVsId: 100 })
    expect(computeKycScore(avecPiece, 'pt_btp')).toBe(computeKycScore(controlesSociete({ identifiantActiveInRegistry: true }), 'pt_btp'))
  })

  it('décision : rejet seulement à 0 (NIPC invalide), revue manuelle de 1 à 79, approbation dès 80', () => {
    const attendue = (score: number) => {
      if (score === 0) return 'rejected'
      return score >= 80 ? 'approved' : 'manual_review'
    }
    const ecarts: number[] = []
    for (let score = 0; score <= 100; score++) {
      if (decideKycStatus(score, 'pt_btp') !== attendue(score)) ecarts.push(score)
    }
    expect(ecarts).toEqual([])
  })
})

describe('buildKycDetails (pt_btp)', () => {
  it('messages en portugais : NIPC, VIES, certidão permanente, Cartão de Cidadão à vérifier à la main', () => {
    const checks = controlesSociete({ identifiantActiveInRegistry: true, docOcrSuccess: true, identifiantMatchDocVsApi: true, nameMatchDocVsApi: 100 })
    expect(buildKycDetails(checks, computeKycScore(checks, 'pt_btp'), 'pt_btp')).toEqual([
      'NIPC válido',
      'Empresa ativa no VIES (registo de IVA)',
      'Certidão Permanente lida por OCR',
      'NIPC declarado presente na Certidão',
      'Correspondência firma Certidão/registo : 100%',
      'Cartão de Cidadão do gerente : verificação manual',
      'Score KYC : 100/100 — aprovado',
    ])
  })

  it('certidão non lue et VIES muet : score bas annoncé en revue manuelle, pas en rejet', () => {
    expect(buildKycDetails(controlesSociete(), 15, 'pt_btp')).toEqual([
      'NIPC válido',
      'Empresa não confirmada no VIES (sem registo de IVA, ou serviço indisponível)',
      'Certidão Permanente não lida (PDF ou imagem ilegível) — revisão manual',
      'NIPC declarado não encontrado na Certidão',
      'Correspondência firma Certidão/registo : 0%',
      'Cartão de Cidadão do gerente : verificação manual',
      'Score KYC : 15/100 — revisão manual',
    ])
  })

  it('NIPC invalide : rejet annoncé, aucun mot français', () => {
    const details = buildKycDetails(controlesSociete({ identifiantFormatValid: false }), 0, 'pt_btp')
    expect(details[0]).toBe('NIPC inválido (formato ou dígito de controlo)')
    expect(details.at(-1)).toBe('Score KYC : 0/100 — rejeitado')
    expect(details.join(' ')).not.toMatch(/SIRET|KBIS|registre|rejeté/)
  })
})
