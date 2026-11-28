// tests/lib/app-mobile.test.ts — détection de l'appli Vitfix Pro (pont JavaScript de Capacitor injecté dans le site).

import { afterEach, describe, expect, it } from 'vitest'
import { estAppMobile } from '@/lib/app-mobile'

type FenetreTest = Window & { Capacitor?: unknown }

const poserCapacitor = (valeur: unknown) => {
  (window as FenetreTest).Capacitor = valeur
}

describe('estAppMobile', () => {
  afterEach(() => {
    delete (window as FenetreTest).Capacitor
  })

  it('navigateur ordinaire, sans pont Capacitor → faux', () => {
    expect(estAppMobile()).toBe(false)
  })

  it('pont de l’appli (plateforme native) → vrai', () => {
    poserCapacitor({ isNativePlatform: () => true })
    expect(estAppMobile()).toBe(true)
  })

  it('@capacitor/core chargé dans un navigateur (plateforme web) → faux', () => {
    poserCapacitor({ isNativePlatform: () => false })
    expect(estAppMobile()).toBe(false)
  })

  it('objet Capacitor incomplet ou réponse non booléenne → faux', () => {
    poserCapacitor({})
    expect(estAppMobile()).toBe(false)
    poserCapacitor({ isNativePlatform: () => 'oui' })
    expect(estAppMobile()).toBe(false)
  })
})
