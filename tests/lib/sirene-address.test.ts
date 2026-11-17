import { describe, it, expect } from 'vitest'
import { formatSiegeAddress } from '@/lib/sirene-address'

describe('formatSiegeAddress', () => {
  it('siege null ou undefined → ""', () => {
    expect(formatSiegeAddress(null)).toBe('')
    expect(formatSiegeAddress(undefined)).toBe('')
  })

  // [cas, adresse, code_postal, libelle_commune, attendu]
  it.each([
    ['adresse rue seule (sans CP) → concat normal "RUE, CP VILLE"', 'ETG RDC ALLEE DES EXEMPLES', '13830', 'ROQUEFORT-LA-BEDOULE', 'ETG RDC ALLEE DES EXEMPLES, 13830 ROQUEFORT-LA-BEDOULE'],
    ['adresse déjà complète avec CP → renvoie telle quelle (évite duplication ville)', 'ETG RDC ALLEE DES EXEMPLES 13830 ROQUEFORT-LA-BEDOULE', '13830', 'ROQUEFORT-LA-BEDOULE', 'ETG RDC ALLEE DES EXEMPLES 13830 ROQUEFORT-LA-BEDOULE'],
    ['adresse vide mais CP+ville présents → "CP VILLE"', '', '13013', 'MARSEILLE', '13013 MARSEILLE'],
    ['CP manquant → concat sans le tail vide', '15 RUE DE LA RÉPUBLIQUE', '', 'MARSEILLE', '15 RUE DE LA RÉPUBLIQUE, MARSEILLE'],
  ])('%s', (_cas, adresse, code_postal, libelle_commune, attendu) => {
    expect(formatSiegeAddress({ adresse, code_postal, libelle_commune })).toBe(attendu)
  })

  it('tout vide → ""', () => {
    expect(formatSiegeAddress({ adresse: '', code_postal: '', libelle_commune: '' })).toBe('')
  })

  it('whitespace périphérique stripped', () => {
    expect(formatSiegeAddress({
      adresse: '  15 RUE TEST  ',
      code_postal: '  13013  ',
      libelle_commune: '  MARSEILLE  ',
    })).toBe('15 RUE TEST, 13013 MARSEILLE')
  })
})
