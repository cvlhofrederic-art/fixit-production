import { describe, it, expect } from 'vitest'
import { titleCaseAddress, getDocSeq } from '../lib/devis-utils'

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

describe('getDocSeq — tri factures par numéro émis', () => {
  // Régression incident Sud travaux 2026-05-26 : la facture FACT-2026-001 créée
  // pendant le bug avait un created_at plus récent que les autres, et apparaissait
  // donc en tête de liste alors qu'elle a le plus petit numéro. Le tri doit se
  // baser sur la séquence du numéro, pas sur la date de création.

  it("retourne une valeur ordonnable pour le format FACT-YYYY-NNN", () => {
    expect(getDocSeq({ docNumber: 'FACT-2026-001' })).toBe(2026000001)
    expect(getDocSeq({ docNumber: 'FACT-2026-009' })).toBe(2026000009)
    expect(getDocSeq({ docNumber: 'DEV-2026-012' })).toBe(2026000012)
  })

  it("trie correctement une liste mixte FACT/DEV par numéro décroissant", () => {
    const docs = [
      { docNumber: 'FACT-2026-001' },
      { docNumber: 'FACT-2026-009' },
      { docNumber: 'FACT-2026-002' },
      { docNumber: 'FACT-2026-008' },
    ]
    const sorted = [...docs].sort((a, b) => getDocSeq(b) - getDocSeq(a))
    expect(sorted.map(d => d.docNumber)).toEqual([
      'FACT-2026-009',
      'FACT-2026-008',
      'FACT-2026-002',
      'FACT-2026-001',
    ])
  })

  it("place les brouillons (BR-timestamp) en tête en ordre décroissant", () => {
    const docs = [
      { docNumber: 'FACT-2026-005' },
      { docNumber: 'BR-1779749904726' },
      { docNumber: 'FACT-2026-002' },
    ]
    const sorted = [...docs].sort((a, b) => getDocSeq(b) - getDocSeq(a))
    // BR-... → MAX_SAFE_INTEGER → en tête
    expect(sorted[0].docNumber).toBe('BR-1779749904726')
    expect(sorted[1].docNumber).toBe('FACT-2026-005')
    expect(sorted[2].docNumber).toBe('FACT-2026-002')
  })

  it("traite l'année comme partie ordonnable (2027 > 2026)", () => {
    expect(getDocSeq({ docNumber: 'FACT-2027-001' })).toBeGreaterThan(
      getDocSeq({ docNumber: 'FACT-2026-999' }),
    )
  })

  it("renvoie MAX_SAFE_INTEGER pour un docNumber absent ou malformé", () => {
    expect(getDocSeq({})).toBe(Number.MAX_SAFE_INTEGER)
    expect(getDocSeq({ docNumber: '' })).toBe(Number.MAX_SAFE_INTEGER)
    expect(getDocSeq({ docNumber: 'truc-bidule' })).toBe(Number.MAX_SAFE_INTEGER)
  })
})
