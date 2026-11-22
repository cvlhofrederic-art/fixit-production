// CRM du secrétariat : un numéro saisi pendant un appel devient la clé E.164 de la fiche du client (lib/crm/telephone.ts).
// Numéros fictifs.

import { describe, expect, it } from 'vitest'
import { formaterTelephone, lienAppel, lienWhatsApp, normaliserTelephone } from '@/lib/crm/telephone'

describe('normaliserTelephone', () => {
  it.each([
    ['+351 912 345 678', '+351912345678'],
    ['+351912345678', '+351912345678'],
    ['00351 912-345-678', '+351912345678'],
    ['912 345 678', '+351912345678'],
    ['234 567 890', '+351234567890'],
    ['06 12 34 56 78', '+33612345678'],
    ['06.12.34.56.78', '+33612345678'],
    ['(+33) 6 12 34 56 78', '+33612345678'],
    ['0033 6 12 34 56 78', '+33612345678'],
    ['+44 20 7946 0000', '+442079460000'],
    // « (0) » après l'indicatif : le 0 national n'entre pas dans le numéro international.
    ['+33 (0)6 12 34 56 78', '+33612345678'],
    ['+351 (0) 912 345 678', '+351912345678'],
    ['0033(0)612345678', '+33612345678'],
  ])('%s → %s', (saisie, attendu) => {
    expect(normaliserTelephone(saisie)).toBe(attendu)
  })

  it.each([
    [''],
    ['   '],
    ['abc'],
    ['12345'],
    ['812 345 678'], // 9 chiffres qui ne sont ni un mobile (9) ni un fixe (2) portugais
    ['0012 345'],
    ['+0 123 456 789'],
    ['+351 912 345 678 999 999'], // plus de 15 chiffres
    ['0012345'], // préfixe international suivi de trop peu de chiffres
    ['912345678x'],
    ['+351 91 234 567'], // Portugal : 9 chiffres exactement après +351
    ['+351 912 345 6789'],
    ['+33 6 12 34 56'], // France : 9 chiffres exactement après +33
    ['+33 06 12 34 56 78'], // 0 national gardé après +33 (sans parenthèses) : refusé plutôt que deviné
  ])('%j → null (non reconnu, jamais deviné)', (saisie) => {
    expect(normaliserTelephone(saisie)).toBeNull()
  })

  it('valeur non textuelle → null', () => {
    expect(normaliserTelephone(null)).toBeNull()
    expect(normaliserTelephone(undefined)).toBeNull()
  })
})

describe('affichage et liens', () => {
  it('groupe les numéros portugais et français, laisse les autres tels quels', () => {
    expect(formaterTelephone('+351912345678')).toBe('+351 912 345 678')
    expect(formaterTelephone('+33612345678')).toBe('+33 6 12 34 56 78')
    expect(formaterTelephone('+442079460000')).toBe('+442079460000')
    expect(formaterTelephone(null)).toBe('')
  })

  it('wa.me sans le +, tel: avec ; rien pour un numéro non E.164', () => {
    expect(lienWhatsApp('+351912345678')).toBe('https://wa.me/351912345678')
    expect(lienAppel('+351912345678')).toBe('tel:+351912345678')
    expect(lienWhatsApp('912345678')).toBeNull()
    expect(lienWhatsApp(null)).toBeNull()
    expect(lienAppel('javascript:alert(1)')).toBeNull()
  })
})
