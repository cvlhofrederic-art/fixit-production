import { describe, it, expect } from 'vitest'
import { detectZoneFromPostalCode, detectZoneFromDepartement } from '@/lib/prix-travaux-2026'

describe('detectZoneFromPostalCode', () => {
  it('Marseille (13008) → PACA', () => {
    expect(detectZoneFromPostalCode('13008')).toBe('PACA')
  })

  it('Paris 16e (75016) → IDF-PARIS', () => {
    expect(detectZoneFromPostalCode('75016')).toBe('IDF-PARIS')
  })

  it('Versailles (78000) → IDF-GRANDE-COURONNE', () => {
    expect(detectZoneFromPostalCode('78000')).toBe('IDF-GRANDE-COURONNE')
  })

  it('Lyon 6e (69006) → AURA-METROPOLES', () => {
    expect(detectZoneFromPostalCode('69006')).toBe('AURA-METROPOLES')
  })

  it('Toulouse (31000) → OCC-METROPOLES', () => {
    expect(detectZoneFromPostalCode('31000')).toBe('OCC-METROPOLES')
  })

  it('Bordeaux (33000) → GRAND-OUEST', () => {
    expect(detectZoneFromPostalCode('33000')).toBe('GRAND-OUEST')
  })

  it('Mende (48000, rural) → RURAL-FRANCE', () => {
    expect(detectZoneFromPostalCode('48000')).toBe('RURAL-FRANCE')
  })

  it('Fort-de-France (97200) → DOM', () => {
    expect(detectZoneFromPostalCode('97200')).toBe('DOM')
  })

  it('Lille (59000) → STANDARD-FRANCE (fallback)', () => {
    expect(detectZoneFromPostalCode('59000')).toBe('STANDARD-FRANCE')
  })

  it('invalid postal code → STANDARD-FRANCE', () => {
    expect(detectZoneFromPostalCode('xx')).toBe('STANDARD-FRANCE')
    expect(detectZoneFromPostalCode('')).toBe('STANDARD-FRANCE')
  })

  it('handles whitespace and edge cases', () => {
    expect(detectZoneFromPostalCode('  75001 ')).toBe('IDF-PARIS')
    expect(detectZoneFromPostalCode('13')).toBe('PACA') // bare dept code
  })
})

describe('detectZoneFromDepartement', () => {
  it('dept 75 → IDF-PARIS', () => {
    expect(detectZoneFromDepartement('75')).toBe('IDF-PARIS')
  })

  it('dept 974 → DOM', () => {
    expect(detectZoneFromDepartement('974')).toBe('DOM')
  })
})
