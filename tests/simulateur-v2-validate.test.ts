// tests/simulateur-v2-validate.test.ts
import { describe, it, expect } from 'vitest'
import { validateQuote } from '@/lib/prix-travaux-2026/validate'
import { computeQuote } from '@/lib/prix-travaux-2026/compute'

describe('validateQuote', () => {
  it('résultat normal valide → ok', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 25 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(validateQuote(r).ok).toBe(true)
  })

  it('out-of-catalog avec artisanRate → ok', () => {
    const r = computeQuote({ items: [], region: 'PACA', gamme: 'standard', etat: 'bon' })
    expect(validateQuote(r).ok).toBe(true)
  })

  it('totalMin > totalMax → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const tampered = { ...r, totalMin: 99999, totalMax: 100 }
    const v = validateQuote(tampered)
    expect(v.ok).toBe(false)
    expect(v.reasons).toContain('totalMin > totalMax')
  })

  it('spread > 22 % → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const tampered = { ...r, totalMin: 100, totalMax: 200, spreadPercent: 1.0 }
    expect(validateQuote(tampered).ok).toBe(false)
  })

  it('taskId inconnu dans breakdown → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const tampered = { ...r, breakdown: [{ ...r.breakdown[0], taskId: 'fake-id' }] }
    const v = validateQuote(tampered)
    expect(v.ok).toBe(false)
    expect(v.reasons?.some(x => /unknown taskId/i.test(x))).toBe(true)
  })

  it('mode normal sans sources → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const tampered = { ...r, sources: [] }
    expect(validateQuote(tampered).ok).toBe(false)
  })

  it('out-of-catalog sans artisanRate → KO', () => {
    const r = computeQuote({ items: [], region: 'PACA', gamme: 'standard', etat: 'bon' })
    const tampered = { ...r, artisanRate: undefined }
    expect(validateQuote(tampered).ok).toBe(false)
  })

  it('zoneCoef hors plage [0.90, 1.40] → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(validateQuote({ ...r, zoneCoef: 2.5 }).ok).toBe(false)
    expect(validateQuote({ ...r, zoneCoef: 0.5 }).ok).toBe(false)
  })

  it('gammeCoef hors valeurs autorisées → KO', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    expect(validateQuote({ ...r, gammeCoef: 1.5 }).ok).toBe(false)
  })

  it('reasons agrégés si plusieurs invariants cassés', () => {
    const r = computeQuote({
      items: [{ taskId: 'peinture-murs-interieur-2couches', qty: 10 }],
      region: 'PACA',
      gamme: 'standard',
      etat: 'bon',
    })
    const tampered = { ...r, totalMin: 99999, totalMax: 100, sources: [] }
    const v = validateQuote(tampered)
    expect(v.ok).toBe(false)
    expect(v.reasons!.length).toBeGreaterThanOrEqual(2)
  })
})
