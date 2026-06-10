import { describe, it, expect } from 'vitest'
import { fmtQty, fmtN, fmtN4 } from '@/lib/devis-format'

// Audit 2026-06-10 (Vague 4) — verrouille le contrat des formatters extraits des
// deux god components devis (artisan + BTP). Sortie FR (virgule), '' si 0/null.

describe('fmtN — prix HT 2 décimales', () => {
  it('formate avec virgule FR', () => {
    expect(fmtN(90.91)).toBe('90,91')
    expect(fmtN(1234.5)).toBe('1234,50')
  })
  it('vide si 0, null, undefined, non-fini', () => {
    expect(fmtN(0)).toBe('')
    expect(fmtN(null)).toBe('')
    expect(fmtN(undefined)).toBe('')
    expect(fmtN(NaN)).toBe('')
    expect(fmtN(Infinity)).toBe('')
  })
})

describe('fmtN4 — prix unitaire 4 décimales, zéros traînants retirés', () => {
  it('garde jusqu\'à 4 décimales significatives', () => {
    expect(fmtN4(9.0909)).toBe('9,0909')
  })
  it('retire les zéros traînants', () => {
    expect(fmtN4(9.09)).toBe('9,09')
    expect(fmtN4(9.0)).toBe('9')
    expect(fmtN4(100)).toBe('100')
  })
  it('vide si 0/null', () => {
    expect(fmtN4(0)).toBe('')
    expect(fmtN4(null)).toBe('')
  })
})

describe('fmtQty — quantité', () => {
  it('toString virgule FR, pas de zéros forcés', () => {
    expect(fmtQty(1)).toBe('1')
    expect(fmtQty(1.5)).toBe('1,5')
  })
  it('vide si 0/null/undefined', () => {
    expect(fmtQty(0)).toBe('')
    expect(fmtQty(null)).toBe('')
    expect(fmtQty(undefined)).toBe('')
  })
})
