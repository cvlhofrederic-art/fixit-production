import { describe, it, expect } from 'vitest'
import { formatSiegeAddress } from '@/lib/sirene-address'

describe('formatSiegeAddress', () => {
  it('siege null ou undefined → ""', () => {
    expect(formatSiegeAddress(null)).toBe('')
    expect(formatSiegeAddress(undefined)).toBe('')
  })

  it('adresse rue seule (sans CP) → concat normal "RUE, CP VILLE"', () => {
    expect(formatSiegeAddress({
      adresse: 'ETG RDC ALLEE HIPPOLYTE GONDREXON',
      code_postal: '13830',
      libelle_commune: 'ROQUEFORT-LA-BEDOULE',
    })).toBe('ETG RDC ALLEE HIPPOLYTE GONDREXON, 13830 ROQUEFORT-LA-BEDOULE')
  })

  it('adresse déjà complète avec CP → renvoie telle quelle (évite duplication ville)', () => {
    expect(formatSiegeAddress({
      adresse: 'ETG RDC ALLEE HIPPOLYTE GONDREXON 13830 ROQUEFORT-LA-BEDOULE',
      code_postal: '13830',
      libelle_commune: 'ROQUEFORT-LA-BEDOULE',
    })).toBe('ETG RDC ALLEE HIPPOLYTE GONDREXON 13830 ROQUEFORT-LA-BEDOULE')
  })

  it('adresse vide mais CP+ville présents → "CP VILLE"', () => {
    expect(formatSiegeAddress({
      adresse: '',
      code_postal: '13013',
      libelle_commune: 'MARSEILLE',
    })).toBe('13013 MARSEILLE')
  })

  it('CP manquant → concat sans le tail vide', () => {
    expect(formatSiegeAddress({
      adresse: '15 RUE DE LA RÉPUBLIQUE',
      code_postal: '',
      libelle_commune: 'MARSEILLE',
    })).toBe('15 RUE DE LA RÉPUBLIQUE, MARSEILLE')
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
