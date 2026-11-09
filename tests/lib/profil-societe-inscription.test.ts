// Champs société écrits dans le profil à l'inscription BTP (lib/profil-societe-inscription.ts).
// Le formulaire de devis et facture BTP lit profiles_artisan.legal_form via mapLegalFormToCode :
// chaque forme choisie doit ressortir avec son code, jamais en « EI » par défaut.

import { describe, it, expect } from 'vitest'
import { champsSocieteProfil } from '@/lib/profil-societe-inscription'
import { mapLegalFormToCode } from '@/lib/devis-utils'

const SOCIETE = {
  siren: '123456789',
  nafCode: '4120A',
  nafLabel: 'Construction de maisons individuelles',
  legalForm: 'SAS',
  address: '1 rue du Port',
  city: 'Marseille',
  postalCode: '13002',
}

describe('champsSocieteProfil', () => {
  it('reprend la forme choisie et l\'identité légale vérifiée', () => {
    expect(champsSocieteProfil(SOCIETE, 'sas', 'FR')).toEqual({
      legal_form: 'SAS',
      siren: '123456789',
      naf_code: '4120A',
      naf_label: 'Construction de maisons individuelles',
      company_address: '1 rue du Port',
      company_city: 'Marseille',
      company_postal_code: '13002',
    })
  })

  it('fait primer la forme choisie dans le formulaire sur le libellé du registre', () => {
    expect(champsSocieteProfil(SOCIETE, 'sarl', 'FR').legal_form).toBe('SARL')
  })

  it.each([
    ['sarl', 'sarl'],
    ['eurl', 'eurl'],
    ['sas', 'sas'],
    ['sasu', 'sas'],
    ['sa', 'sa'],
  ])('la forme %s ressort avec le code %s dans le devis BTP', (forme, code) => {
    expect(mapLegalFormToCode(champsSocieteProfil(SOCIETE, forme, 'FR').legal_form)).toBe(code)
  })

  it('garde le libellé du registre quand aucune forme n\'est choisie', () => {
    expect(champsSocieteProfil(SOCIETE, '', 'FR').legal_form).toBe('SAS')
  })

  it('n\'envoie aucun champ vide', () => {
    expect(champsSocieteProfil({ siren: '123456789', nafCode: ' ', address: '' }, '', 'FR')).toEqual({ siren: '123456789' })
    expect(champsSocieteProfil(null, '', 'FR')).toEqual({})
  })
})
