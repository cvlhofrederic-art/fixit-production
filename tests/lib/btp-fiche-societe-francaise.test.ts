// tests/lib/btp-fiche-societe-francaise.test.ts
//
// Critère « société française » des correctifs du BTP pro (lib/btp/fiche-societe-francaise.ts), seul et partagé par
// « Mon profil » (navigateur), l'adresse publique de la fiche, la lecture d'attestation et la décision KYC (serveur).
// Une fiche sans langue posée est celle d'une société française ; seule une fiche en portugais en sort (Portugal hors
// de ces correctifs).

import { describe, it, expect } from 'vitest'
import { ficheSocieteFrancaise } from '@/lib/btp/fiche-societe-francaise'

describe('Fiche d’une société BTP traitée en société française', () => {
  it('fiche en français : oui', () => {
    expect(ficheSocieteFrancaise({ language: 'fr' })).toBe(true)
  })

  it('langue non posée (null en base) : oui', () => {
    expect(ficheSocieteFrancaise({ language: null })).toBe(true)
  })

  it('langue absente de la lecture : oui', () => {
    expect(ficheSocieteFrancaise({})).toBe(true)
  })

  it('autre langue que le portugais (anglais) : oui', () => {
    expect(ficheSocieteFrancaise({ language: 'en' })).toBe(true)
  })

  it('fiche en portugais : non, la société garde le comportement d’avant', () => {
    expect(ficheSocieteFrancaise({ language: 'pt' })).toBe(false)
  })
})
