import { describe, it, expect } from 'vitest'
import {
  extractIdentifiantFR,
  extractIdentifiantPT,
  extractDenominationFR,
  extractDenominationPT,
  extractRepresentantFR,
  extractRepresentantPT,
  extractAdresseFR,
  extractAdressePT,
  extractDateFR,
  extractDatePT,
  extractFormeJuridiqueFR,
  extractFormeJuridiquePT,
  buildExtracted,
} from '@/lib/kbis-extract'

// ─── extractIdentifiantFR ─────────────────────────────────────────────────────

describe('extractIdentifiantFR', () => {
  it('extrait un SIRET avec espaces', () => {
    expect(extractIdentifiantFR('SIRET : 123 456 789 00012\n')).toBe('12345678900012')
  })

  it('extrait un SIRET sans séparateur', () => {
    expect(extractIdentifiantFR('siret: 12345678900012')).toBe('12345678900012')
  })

  it('retourne null si aucun SIRET', () => {
    expect(extractIdentifiantFR('Aucun identifiant dans ce texte')).toBeNull()
  })

  it('retourne null si le numéro est trop court', () => {
    expect(extractIdentifiantFR('SIRET : 1234567')).toBeNull()
  })
})

// ─── extractIdentifiantPT ─────────────────────────────────────────────────────

describe('extractIdentifiantPT', () => {
  it('extrait un NIF standard', () => {
    expect(extractIdentifiantPT('NIF: 501234567')).toBe('501234567')
  })

  it('extrait un NIPC', () => {
    expect(extractIdentifiantPT('NIPC: 501234567')).toBe('501234567')
  })

  it('extrait avec libellé long', () => {
    expect(extractIdentifiantPT('Número de Identificação: 501234567')).toBe('501234567')
  })

  it('retourne null si absent', () => {
    expect(extractIdentifiantPT('Sem identificador aqui')).toBeNull()
  })
})

// ─── extractDenominationFR ────────────────────────────────────────────────────

describe('extractDenominationFR', () => {
  it('extrait la dénomination sociale', () => {
    expect(extractDenominationFR('Dénomination : MAÇONNERIE DUPONT SARL\n')).toBe('MAÇONNERIE DUPONT SARL')
  })

  it('extrait via "raison sociale"', () => {
    expect(extractDenominationFR('Raison sociale : PLOMBERIE MARTIN\n')).toBe('PLOMBERIE MARTIN')
  })

  it('retourne null si absent', () => {
    expect(extractDenominationFR('Pas de dénomination ici')).toBeNull()
  })
})

// ─── extractDenominationPT ────────────────────────────────────────────────────

describe('extractDenominationPT', () => {
  it('extrait la denominação', () => {
    expect(extractDenominationPT('Denominação: CONSTRUÇÕES SILVA LDA\n')).toBe('CONSTRUÇÕES SILVA LDA')
  })

  it('extrait via "firma"', () => {
    expect(extractDenominationPT('Firma: CONSTRUÇÕES SILVA LDA\n')).toBe('CONSTRUÇÕES SILVA LDA')
  })

  it('retourne null si absent', () => {
    expect(extractDenominationPT('Sem denominação')).toBeNull()
  })
})

// ─── extractRepresentantFR ────────────────────────────────────────────────────

describe('extractRepresentantFR', () => {
  it('extrait le gérant', () => {
    const result = extractRepresentantFR('Gérant : MARTIN Jean-Pierre\n')
    expect(result).not.toBeNull()
    expect(result).toContain('MARTIN')
  })

  it('extrait le président', () => {
    const result = extractRepresentantFR('Président : DUPONT Alice\n')
    expect(result).not.toBeNull()
    expect(result).toContain('DUPONT')
  })

  it('retourne null si absent', () => {
    expect(extractRepresentantFR('Pas de gérant mentionné')).toBeNull()
  })
})

// ─── extractRepresentantPT ────────────────────────────────────────────────────

describe('extractRepresentantPT', () => {
  it('extrait le gerente', () => {
    const result = extractRepresentantPT('Gerente: SILVA João Manuel\n')
    expect(result).not.toBeNull()
    expect(result!.startsWith('SILVA')).toBe(true)
  })

  it('extrait le sócio-gerente', () => {
    const result = extractRepresentantPT('Sócio-Gerente: FERREIRA Ana\n')
    expect(result).not.toBeNull()
    expect(result).toContain('FERREIRA')
  })

  it('retourne null si absent', () => {
    expect(extractRepresentantPT('Sem representante')).toBeNull()
  })
})

// ─── extractAdresseFR ────────────────────────────────────────────────────────

describe('extractAdresseFR', () => {
  it('extrait le siège social', () => {
    const result = extractAdresseFR('Siège social : 12 rue de la Paix, 75001 Paris\n')
    expect(result).toContain('Paris')
  })

  it('retourne null si absent', () => {
    expect(extractAdresseFR('Aucune adresse')).toBeNull()
  })
})

// ─── extractAdressePT ────────────────────────────────────────────────────────

describe('extractAdressePT', () => {
  it('extrait la sede', () => {
    const result = extractAdressePT('Sede: Rua das Flores 45, 4000-001 Porto\n')
    expect(result).toContain('Porto')
  })

  it('retourne null si absent', () => {
    expect(extractAdressePT('Sem morada')).toBeNull()
  })
})

// ─── extractDateFR ────────────────────────────────────────────────────────────

describe('extractDateFR', () => {
  it('extrait la date de constitution', () => {
    const result = extractDateFR('Date de constitution : 12 mars 2010\n')
    expect(result).toContain('2010')
  })

  it('retourne null si absent', () => {
    expect(extractDateFR('Pas de date')).toBeNull()
  })
})

// ─── extractDatePT ────────────────────────────────────────────────────────────

describe('extractDatePT', () => {
  it('extrait la date de constituição format ISO', () => {
    const result = extractDatePT('Data de constituição: 2010-03-12')
    expect(result).toBe('2010-03-12')
  })

  it('retourne null si absent', () => {
    expect(extractDatePT('Sem data')).toBeNull()
  })
})

// ─── extractFormeJuridiqueFR ──────────────────────────────────────────────────

describe('extractFormeJuridiqueFR', () => {
  it('extrait SARL', () => {
    expect(extractFormeJuridiqueFR('DUPONT MAÇONNERIE SARL')).toBe('SARL')
  })

  it('extrait SAS', () => {
    expect(extractFormeJuridiqueFR('CONSTRUCTIONS SAS au capital de 10000€')).toBe('SAS')
  })

  it('ne confond pas SA avec SARL', () => {
    expect(extractFormeJuridiqueFR('DUPONT MAÇONNERIE SARL')).toBe('SARL')
  })

  it('retourne null si absent', () => {
    expect(extractFormeJuridiqueFR('Aucune forme juridique')).toBeNull()
  })
})

// ─── extractFormeJuridiquePT ──────────────────────────────────────────────────

describe('extractFormeJuridiquePT', () => {
  it('extrait Unipessoal Lda avant Lda', () => {
    expect(extractFormeJuridiquePT('CONSTRUÇÕES SILVA Unipessoal Lda')).toBe('Unipessoal Lda')
  })

  it('extrait Lda', () => {
    expect(extractFormeJuridiquePT('CONSTRUÇÕES SILVA Lda capital 5000€')).toBe('Lda')
  })

  it('retourne null si absent', () => {
    expect(extractFormeJuridiquePT('Sem forma jurídica')).toBeNull()
  })
})

// ─── buildExtracted ───────────────────────────────────────────────────────────

describe('buildExtracted', () => {
  it('inclut siret et siren pour fr_artisan', () => {
    const text = 'SIRET : 123 456 789 00012\nDénomination : TEST SARL\nGérant : MARTIN Jean\n'
    const result = buildExtracted(text, 'fr_artisan', 85)
    expect(result.siret).toBe('12345678900012')
    expect(result.siren).toBe('123456789')
    expect(result.market).toBe('fr_artisan')
    expect(result.confidence).toBe(85)
  })

  it('inclut nif pour pt_artisan', () => {
    const text = 'NIF: 501234567\nDenominação: SILVA Lda\nGerente: SILVA João\n'
    const result = buildExtracted(text, 'pt_artisan', 75)
    expect(result.nif).toBe('501234567')
    expect(result.identifiant).toBe('501234567')
    expect(result.market).toBe('pt_artisan')
  })

  it('retourne confidence arrondie', () => {
    const result = buildExtracted('', 'fr_btp', 72.6)
    expect(result.confidence).toBe(73)
  })
})
