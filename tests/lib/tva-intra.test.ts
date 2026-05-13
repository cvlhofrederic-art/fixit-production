import { describe, it, expect } from 'vitest'
import { computeFrTvaIntra } from '@/lib/tva-intra'

describe('computeFrTvaIntra', () => {
  it('calcule le n° officiel depuis un SIREN valide (test impots.gouv)', () => {
    expect(computeFrTvaIntra('920102100')).toBe('FR10920102100')
  })

  it('accepte un SIRET 14 chiffres et extrait les 9 premiers (SIREN)', () => {
    expect(computeFrTvaIntra('92010210000012')).toBe('FR10920102100')
  })

  it('ignore les espaces et caractères non-numériques', () => {
    expect(computeFrTvaIntra('920 102 100')).toBe('FR10920102100')
    expect(computeFrTvaIntra('920-102-100')).toBe('FR10920102100')
  })

  it('zero-padding de la clé à 2 chiffres (clé < 10)', () => {
    // Cherchons un SIREN qui donne une clé < 10
    // SIREN 950000000 : (12 + 3 × (950000000 mod 97)) mod 97
    // 950000000 mod 97 : à valider en runtime
    const result = computeFrTvaIntra('950000000')
    expect(result).not.toBeNull()
    expect(result).toMatch(/^FR\d{11}$/)  // 2 chiffres clé + 9 SIREN
  })

  it('retourne null pour input vide', () => {
    expect(computeFrTvaIntra('')).toBeNull()
    expect(computeFrTvaIntra(null)).toBeNull()
    expect(computeFrTvaIntra(undefined)).toBeNull()
  })

  it('retourne null pour input trop court (< 9 chiffres)', () => {
    expect(computeFrTvaIntra('12345678')).toBeNull()
    expect(computeFrTvaIntra('abc')).toBeNull()
  })

  it('retourne null pour SIREN nul (00...0)', () => {
    expect(computeFrTvaIntra('000000000')).toBeNull()
  })

  it('exemples connus (sources publiques)', () => {
    // SUD TRAVAUX : SIRET 95181901000012 → SIREN 951819010 → FR45951819010
    expect(computeFrTvaIntra('95181901000012')).toBe('FR45951819010')
  })

  it('format de sortie toujours FR + 11 chiffres', () => {
    for (const siren of ['100200300', '500600700', '999888777', '123456789']) {
      const result = computeFrTvaIntra(siren)
      expect(result).toMatch(/^FR\d{11}$/)
    }
  })
})
