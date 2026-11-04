// tests/lib/consentement-cookies.test.ts — lecture et mémorisation du consentement cookies (lot 5 Sentry du 28/10/2026).

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reinitialiserSondesStockage } from '@/lib/safe-storage'
import {
  COOKIE_CONSENT_KEY,
  getCookieConsent,
  isAnalyticsAllowed,
  memoriserConsentement,
  reinitialiserConsentementEnMemoire,
} from '@/lib/consentement-cookies'

const CHOIX = { performance: true, personalization: false, advertising: false, date: new Date().toISOString() }
let descripteur: PropertyDescriptor | undefined

function bloquerStockage() {
  descripteur = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    },
  })
}

beforeEach(() => {
  reinitialiserSondesStockage()
  reinitialiserConsentementEnMemoire()
  window.localStorage.clear()
})

afterEach(() => {
  if (descripteur) {
    Object.defineProperty(window, 'localStorage', descripteur)
    descripteur = undefined
  }
})

describe('stockage disponible', () => {
  it('aucun choix → null ; choix mémorisé → relu depuis le stockage', () => {
    expect(getCookieConsent()).toBeNull()
    expect(isAnalyticsAllowed()).toBe(false)
    expect(memoriserConsentement(CHOIX)).toBe(true)
    expect(JSON.parse(window.localStorage.getItem(COOKIE_CONSENT_KEY) ?? 'null')).toEqual(CHOIX)
    expect(getCookieConsent()).toEqual(CHOIX)
    expect(isAnalyticsAllowed()).toBe(true)
  })

  it('ancien format { accepted } converti, choix de plus de 12 mois oublié', () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ accepted: true }))
    expect(getCookieConsent()).toMatchObject({ performance: true, personalization: true, advertising: true })

    const vieux = { ...CHOIX, date: new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString() }
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(vieux))
    expect(getCookieConsent()).toBeNull()
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBeNull()
  })

  it('valeur illisible → null, sans exception', () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, '{pas du json')
    expect(getCookieConsent()).toBeNull()
  })
})

describe('stockage bloqué', () => {
  it('le choix est gardé en mémoire pour la visite : bandeau fermé et mesure d’audience activable', () => {
    bloquerStockage()
    expect(getCookieConsent()).toBeNull()
    expect(memoriserConsentement(CHOIX)).toBe(false)
    expect(getCookieConsent()).toEqual(CHOIX)
    expect(isAnalyticsAllowed()).toBe(true)
  })
})
