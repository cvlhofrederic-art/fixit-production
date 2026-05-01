import { describe, it, expect } from 'vitest'
import { titleCaseAddress } from '../lib/devis-utils'

describe('titleCaseAddress', () => {
  it('returns input unchanged when not all-caps (already normalised)', () => {
    expect(titleCaseAddress('12 Rue de la Paix')).toBe('12 Rue de la Paix')
  })

  it('returns empty string unchanged', () => {
    expect(titleCaseAddress('')).toBe('')
  })

  it('title-cases a basic French street address', () => {
    expect(titleCaseAddress('12 RUE DE LA PAIX')).toBe('12 Rue de la Paix')
  })

  it('title-cases a hyphenated city (Aix-en-Provence)', () => {
    expect(titleCaseAddress('13290 AIX-EN-PROVENCE')).toBe('13290 Aix-en-Provence')
  })

  it('title-cases a full Kbis-style ALL CAPS address', () => {
    expect(titleCaseAddress('KINNOVA GROUP 115 RUE CLAUDE NICOLAS LEDOUX 13290 AIX-EN-PROVENCE')).toBe(
      'Kinnova Group 115 Rue Claude Nicolas Ledoux 13290 Aix-en-Provence',
    )
  })

  it('handles L\' particle correctly (typographic apostrophe)', () => {
    expect(titleCaseAddress('RUE DE L’ÉGLISE')).toBe('Rue de l’Église')
  })

  it('handles L\' particle correctly (straight apostrophe)', () => {
    expect(titleCaseAddress("RUE DE L'EGLISE")).toBe('Rue de l’Eglise')
  })

  it('handles D\' particle correctly (Rue d\'Aix)', () => {
    expect(titleCaseAddress("RUE D'AIX")).toBe('Rue d’Aix')
  })

  it('handles common French abbreviations', () => {
    expect(titleCaseAddress('AV DE LA REPUBLIQUE')).toBe('Av. de la Republique')
    expect(titleCaseAddress('BD HAUSSMANN')).toBe('Bd Haussmann')
  })

  it('preserves 5-digit postal codes as-is', () => {
    expect(titleCaseAddress('75001 PARIS')).toBe('75001 Paris')
  })

  it('preserves comma separators', () => {
    expect(titleCaseAddress('12 RUE DE LA PAIX, 75001 PARIS')).toBe('12 Rue de la Paix, 75001 Paris')
  })
})
