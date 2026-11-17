// Statut juridique du formulaire de devis et facture BTP (lib/statut-juridique-btp.ts). Le champ est
// verrouillé, « défini à l'inscription ». Un document déjà enregistré (brouillon ou émis) garde exactement le
// sien, car le formulaire réenregistre un brouillon dès son ouverture ; un nouveau document, même tiré d'un
// ancien, prend la forme du profil.

import { describe, it, expect } from 'vitest'
import { appliquerFormeProfil, documentEmis, documentExistant, statutJuridiqueInitialBtp } from '@/lib/statut-juridique-btp'

const EI = 'Entreprise Individuelle (EI)'

describe('documentEmis', () => {
  it.each([
    ['FACT-2026-014', true],
    ['DEV-2026-003', true],
    ['AV-2026-001', true],
    ['BR-2026-007', false],
    ['br-2026-007', false],
    ['', false],
    [undefined, false],
  ])('%s → %s', (numero, attendu) => {
    expect(documentEmis(numero)).toBe(attendu)
  })
})

describe('documentExistant', () => {
  it('brouillon enregistré, document émis ou document identifié : existant', () => {
    expect(documentExistant({ savedAt: '2026-11-09T20:00:00.000Z' })).toBe(true)
    expect(documentExistant({ id: 'a1b2c3' })).toBe(true)
    expect(documentExistant({ docNumber: 'FACT-2026-014' })).toBe(true)
  })

  it('document tiré d\'un autre (sans identifiant, horodatage ni numéro légal) ou nouveau : pas existant', () => {
    expect(documentExistant({ docNumber: '', companyStatus: EI } as never)).toBe(false)
    expect(documentExistant({ docNumber: 'BR-2026-002' })).toBe(false)
    expect(documentExistant(undefined)).toBe(false)
  })

  it('duplicata BTP : nouvel identifiant marqué isDuplicate, pas encore enregistré, donc neuf', () => {
    expect(documentExistant({ id: '6f1c2a34-0000-4000-8000-0000000000d2', isDuplicate: true })).toBe(false)
  })
})

describe('appliquerFormeProfil (facture totale et acompte émis en un clic)', () => {
  it('pose la forme du profil au jour de l\'émission, à la place de celle recopiée du devis', () => {
    expect(appliquerFormeProfil({ companyStatus: EI, docType: 'facture' }, 'SAS')).toEqual({ companyStatus: 'SAS', docType: 'facture' })
  })

  it('garde la forme du devis quand le profil n\'en a pas', () => {
    const payload = { companyStatus: EI, docType: 'facture' }
    expect(appliquerFormeProfil(payload, '')).toBe(payload)
    expect(appliquerFormeProfil(payload, null)).toBe(payload)
  })
})

describe('statutJuridiqueInitialBtp', () => {
  it('prend la forme du profil pour un nouveau document', () => {
    expect(statutJuridiqueInitialBtp(undefined, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp(undefined, 'Société à responsabilité limitée')).toBe('SARL')
  })

  it('prend la forme du profil pour un document tiré d\'un autre resté en EI (avoir, duplicata)', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, id: '6f1c2a34-0000-4000-8000-0000000000d2', isDuplicate: true }, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: '' }, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp({ companyStatus: EI }, 'SAS')).toBe('SAS')
  })

  it('ne modifie jamais un brouillon déjà enregistré', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, savedAt: '2026-11-09T20:00:00.000Z' }, 'SAS')).toBe(EI)
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, id: 'brouillon-1', docNumber: 'BR-2026-002' }, 'SAS')).toBe(EI)
  })

  it('garde la forme figée d\'un document déjà émis', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: 'FACT-2026-014' }, 'SAS')).toBe(EI)
  })

  it('garde la forme du document quand le profil n\'en a pas', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: 'SARL', docNumber: '' }, '')).toBe('SARL')
    expect(statutJuridiqueInitialBtp({ companyStatus: 'SARL' }, null)).toBe('SARL')
  })

  it('retombe sur EI sans forme au profil ni au document, comme avant', () => {
    expect(statutJuridiqueInitialBtp(undefined, undefined)).toBe(EI)
    expect(statutJuridiqueInitialBtp({ docNumber: '' }, '  ')).toBe(EI)
  })

  it('rend « Entreprise Individuelle (EI) » pour un entrepreneur individuel', () => {
    expect(statutJuridiqueInitialBtp(undefined, 'Entrepreneur individuel')).toBe(EI)
  })
})
