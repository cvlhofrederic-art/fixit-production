// tests/lib/btp-fiche-societe-francaise.test.ts
//
// Critère « société française » de la décision KYC du panneau d'administration (lib/btp/fiche-societe-francaise.ts).
// Une fiche sans langue posée est celle d'une société française ; seule une fiche en portugais en sort. « Mon profil »,
// l'adresse publique de la fiche et la lecture d'attestation ne le lisent plus depuis le 22/11/2026 (mêmes règles
// pour toute société BTP).

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

  it('fiche en portugais : non', () => {
    expect(ficheSocieteFrancaise({ language: 'pt' })).toBe(false)
  })
})
