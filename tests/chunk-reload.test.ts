import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isChunkLoadError, attemptChunkReload, hasRecentReload } from '@/lib/chunk-reload'

const RELOAD_MARKER_KEY = 'vitfix:chunk-reload-at'
const reloadMock = vi.fn()

function chunkError(message = 'Failed to load chunk /_next/static/chunks/09~w6vph~7w6y.js from module 802068') {
  const e = new Error(message)
  e.name = 'ChunkLoadError'
  return e
}

beforeEach(() => {
  reloadMock.mockClear()
  // jsdom : window.location.reload n'est pas redéfinissable, mais la propriété
  // window.location l'est (accessor configurable). On remplace l'objet entier
  // par une URL réelle augmentée d'un spy reload.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: Object.assign(new URL('https://vitfix.io/fr/pro/dashboard?p=factures'), { reload: reloadMock }),
  })
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('isChunkLoadError', () => {
  it('détecte le name ChunkLoadError (Next/webpack)', () => {
    expect(isChunkLoadError(chunkError())).toBe(true)
  })

  it('détecte les messages "Failed to load chunk" / "Loading chunk … failed" / CSS / Safari', () => {
    expect(isChunkLoadError(new Error('Failed to load chunk /_next/static/chunks/abc.js'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading chunk 802 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('Loading CSS chunk 12 failed.'))).toBe(true)
    expect(isChunkLoadError(new Error('importing a module script failed.'))).toBe(true)
  })

  it('ignore les erreurs runtime normales et les non-erreurs', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
    expect(isChunkLoadError(undefined)).toBe(false)
    expect(isChunkLoadError('boom')).toBe(false)
  })
})

describe('attemptChunkReload', () => {
  it('recharge une fois et pose le marqueur sur un ChunkLoadError', () => {
    const reloaded = attemptChunkReload(chunkError())
    expect(reloaded).toBe(true)
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(window.sessionStorage.getItem(RELOAD_MARKER_KEY)).toBeTruthy()
  })

  it('ne recharge pas sur une erreur runtime normale', () => {
    const reloaded = attemptChunkReload(new Error('boom runtime'))
    expect(reloaded).toBe(false)
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('ne boucle pas : si un reload récent existe déjà, ne recharge plus (chunk vraiment manquant)', () => {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now()))
    expect(hasRecentReload()).toBe(true)
    const reloaded = attemptChunkReload(chunkError())
    expect(reloaded).toBe(false)
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('recharge à nouveau si le marqueur est ancien (déploiement ultérieur dans la même session)', () => {
    window.sessionStorage.setItem(RELOAD_MARKER_KEY, String(Date.now() - 60_000))
    expect(hasRecentReload()).toBe(false)
    const reloaded = attemptChunkReload(chunkError())
    expect(reloaded).toBe(true)
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })
})
