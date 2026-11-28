// tests/lib/safe-storage.test.ts — accès sûrs au stockage (lib/safe-storage.ts), lot 5 Sentry du 28/10/2026.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isStorageAvailable,
  isStorageReadable,
  reinitialiserSondesStockage,
  safeGet,
  safeRemove,
  safeSet,
} from '@/lib/safe-storage'

const MESSAGE = "Failed to read the 'localStorage' property from 'Window': Access is denied for this document."
const descripteurs: Partial<Record<'localStorage' | 'sessionStorage', PropertyDescriptor | undefined>> = {}

function bloquer(nom: 'localStorage' | 'sessionStorage') {
  descripteurs[nom] = Object.getOwnPropertyDescriptor(window, nom)
  Object.defineProperty(window, nom, {
    configurable: true,
    get() {
      throw new DOMException(MESSAGE, 'SecurityError')
    },
  })
}

function retablir() {
  for (const nom of ['localStorage', 'sessionStorage'] as const) {
    const d = descripteurs[nom]
    if (d) Object.defineProperty(window, nom, d)
    descripteurs[nom] = undefined
  }
}

beforeEach(() => {
  reinitialiserSondesStockage()
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  retablir()
  vi.restoreAllMocks()
})

describe('stockage disponible', () => {
  it('isStorageAvailable → true, lecture / écriture / suppression fonctionnent, sonde sans trace', () => {
    expect(isStorageAvailable('local')).toBe(true)
    expect(isStorageAvailable('session')).toBe(true)
    expect(isStorageReadable('local')).toBe(true)
    expect(isStorageReadable('session')).toBe(true)
    expect(window.localStorage.length).toBe(0)
    expect(safeSet('cle', 'valeur')).toBe(true)
    expect(safeGet('cle')).toBe('valeur')
    expect(safeRemove('cle')).toBe(true)
    expect(safeGet('cle')).toBeNull()
    expect(safeSet('cle-session', 'v', 'session')).toBe(true)
    expect(safeGet('cle-session', 'session')).toBe('v')
    expect(safeGet('cle-session')).toBeNull()
  })
})

describe('stockage bloqué (SecurityError à la lecture de la propriété)', () => {
  it('rien ne lève, isStorageAvailable et isStorageReadable → false, la sonde d’écriture est mise en cache', () => {
    bloquer('localStorage')
    bloquer('sessionStorage')
    expect(() => window.localStorage).toThrow(MESSAGE)

    expect(isStorageAvailable('local')).toBe(false)
    expect(isStorageAvailable('session')).toBe(false)
    expect(isStorageReadable('local')).toBe(false)
    expect(isStorageReadable('session')).toBe(false)
    expect(safeGet('cle')).toBeNull()
    expect(safeSet('cle', 'valeur')).toBe(false)
    expect(safeRemove('cle')).toBe(false)
    expect(safeGet('cle', 'session')).toBeNull()
    expect(safeSet('cle', 'v', 'session')).toBe(false)

    // Une fois sondé, le stockage n'est plus relu (même après rétablissement, le cache tient pour la page).
    retablir()
    expect(isStorageAvailable('local')).toBe(false)
  })
})

describe('stockage plein ou en lecture seule (setItem lève)', () => {
  it('isStorageAvailable → false mais isStorageReadable → true ; safeSet → false, safeGet et safeRemove marchent', () => {
    window.localStorage.setItem('existante', '1')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(isStorageAvailable('local')).toBe(false)
    // Plein n'est pas bloqué : ce qui lit, supprime ou réécrit plus court (miroir, migration, hydratation) reste actif.
    expect(isStorageReadable('local')).toBe(true)
    expect(safeSet('cle', 'valeur')).toBe(false)
    expect(safeGet('existante')).toBe('1')
    expect(safeRemove('existante')).toBe(true)
    expect(safeGet('existante')).toBeNull()
  })
})

describe('lecture refusée (getItem lève alors que la propriété est accessible)', () => {
  it('isStorageReadable → false et isStorageAvailable → false, sans exception', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Access is denied for this document.', 'SecurityError')
    })

    expect(isStorageReadable('local')).toBe(false)
    expect(isStorageAvailable('local')).toBe(false)
    expect(safeGet('cle')).toBeNull()
  })
})
