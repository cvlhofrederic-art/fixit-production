// Statut juridique du formulaire de devis et facture BTP (lib/statut-juridique-btp.ts). Le champ est
// verrouillé, « défini à l'inscription » : un brouillon ou un nouveau document suit le profil, un document
// déjà émis garde la forme figée avec lui.

import { describe, it, expect } from 'vitest'
import { documentEmis, statutJuridiqueInitialBtp } from '@/lib/statut-juridique-btp'

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

describe('statutJuridiqueInitialBtp', () => {
  it('prend la forme du profil pour un nouveau document', () => {
    expect(statutJuridiqueInitialBtp(undefined, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp(undefined, 'Société à responsabilité limitée')).toBe('SARL')
  })

  it('prend la forme du profil pour une facture tirée d\'un devis resté en EI (pas encore de numéro)', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: '' }, 'SAS')).toBe('SAS')
    expect(statutJuridiqueInitialBtp({ companyStatus: EI }, 'SAS')).toBe('SAS')
  })

  it('prend la forme du profil pour un brouillon au numéro provisoire', () => {
    expect(statutJuridiqueInitialBtp({ companyStatus: EI, docNumber: 'BR-2026-002' }, 'SAS')).toBe('SAS')
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
