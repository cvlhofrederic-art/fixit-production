// @vitest-environment node
// tests/auth/verrou-auth.test.ts
//
// Verrou d'auth Supabase de lib/auth/verrou-auth.ts (option auth.lock de lib/supabase.ts). Sentry C et X :
// « AbortError: signal is aborted without reason » levé par le minuteur de navigatorLock quand le verrou partagé
// entre onglets n'est pas obtenu en 10 s ; un client dont l'initialisation échouait ainsi restait mort jusqu'au
// rechargement. Ici, l'API navigator.locks est simulée : un verrou « tenu ailleurs » n'est jamais accordé et
// l'abandon par le signal rejette avec l'AbortError natif, comme dans Chrome.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { creerVerrouAuth, estAbandonDeVerrou, reinitialiserSignalementRepli } from '@/lib/auth/verrou-auth'

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }))

type OptionsDemande = { mode: string; signal?: AbortSignal; ifAvailable?: boolean }
type Rappel = (lock: { name: string } | null) => Promise<unknown>

function installerNavigatorLocks(opts: { tenuAilleurs?: boolean; refuse?: boolean } = {}) {
  const request = vi.fn((name: string, options: OptionsDemande, rappel: Rappel) => {
    if (opts.refuse) throw new DOMException('The request was denied.', 'SecurityError')
    if (!opts.tenuAilleurs) return rappel({ name })
    if (options.ifAvailable) return rappel(null)
    return new Promise((_resoudre, rejeter) => {
      options.signal?.addEventListener('abort', () => rejeter(options.signal?.reason))
    })
  })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { locks: { request } } })
  return request
}

function retirerNavigatorLocks() {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'test' } })
}

const descripteurNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')

beforeEach(() => {
  vi.mocked(Sentry.captureMessage).mockClear()
  reinitialiserSignalementRepli()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (descripteurNavigator) Object.defineProperty(globalThis, 'navigator', descripteurNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})

describe('estAbandonDeVerrou', () => {
  it('reconnaît l’AbortError natif, l’erreur de délai d’auth-js et la SecurityError', () => {
    expect(estAbandonDeVerrou(new DOMException('signal is aborted without reason', 'AbortError'))).toBe(true)
    expect(estAbandonDeVerrou(Object.assign(new Error('timeout'), { isAcquireTimeout: true }))).toBe(true)
    expect(estAbandonDeVerrou(new DOMException('The request was denied.', 'SecurityError'))).toBe(true)
  })

  it('ne confond pas une autre erreur avec un abandon de verrou', () => {
    expect(estAbandonDeVerrou(new TypeError('Failed to fetch'))).toBe(false)
    expect(estAbandonDeVerrou(new Error('autre'))).toBe(false)
    expect(estAbandonDeVerrou(null)).toBe(false)
    expect(estAbandonDeVerrou('AbortError')).toBe(false)
  })
})

describe('creerVerrouAuth', () => {
  it('verrou libre : l’opération s’exécute sous navigator.locks, une seule fois, sans repli', async () => {
    const request = installerNavigatorLocks()
    const signaler = vi.fn()
    const fn = vi.fn(async () => 'ok')

    await expect(creerVerrouAuth({ signaler })('lock:sb-test-auth-token', 10_000, fn)).resolves.toBe('ok')

    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toBe('lock:sb-test-auth-token')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(signaler).not.toHaveBeenCalled()
  })

  it('verrou tenu par un autre onglet : après le délai, l’opération s’exécute quand même et le repli est signalé', async () => {
    vi.useFakeTimers()
    installerNavigatorLocks({ tenuAilleurs: true })
    const signaler = vi.fn()
    const fn = vi.fn(async () => 'session')

    const resultat = creerVerrouAuth({ signaler })('lock:sb-test-auth-token', 10_000, fn)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(fn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await expect(resultat).resolves.toBe('session')

    expect(fn).toHaveBeenCalledTimes(1)
    expect(signaler).toHaveBeenCalledTimes(1)
    const [nom, erreur] = signaler.mock.calls[0]
    expect(nom).toBe('lock:sb-test-auth-token')
    expect((erreur as Error).name).toBe('AbortError')
  })

  it('une opération déjà démarrée sous le verrou qui échoue par AbortError n’est jamais relancée', async () => {
    installerNavigatorLocks()
    const signaler = vi.fn()
    const fn = vi.fn(async () => {
      throw new DOMException('signal is aborted without reason', 'AbortError')
    })

    await expect(creerVerrouAuth({ signaler })('lock:x', 10_000, fn)).rejects.toMatchObject({ name: 'AbortError' })

    expect(fn).toHaveBeenCalledTimes(1)
    expect(signaler).not.toHaveBeenCalled()
  })

  it('une erreur ordinaire de l’opération est propagée telle quelle', async () => {
    installerNavigatorLocks()
    const fn = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(creerVerrouAuth({ signaler: vi.fn() })('lock:x', 10_000, fn)).rejects.toBeInstanceOf(TypeError)
  })

  it('navigator.locks absent : verrou de processus, l’opération s’exécute', async () => {
    retirerNavigatorLocks()
    const signaler = vi.fn()
    const fn = vi.fn(async () => 42)

    await expect(creerVerrouAuth({ signaler })('lock:x', 10_000, fn)).resolves.toBe(42)
    expect(signaler).not.toHaveBeenCalled()
  })

  it('navigator.locks.request refusé (SecurityError, stockage bloqué) : repli signalé, l’opération s’exécute', async () => {
    installerNavigatorLocks({ refuse: true })
    const signaler = vi.fn()
    const fn = vi.fn(async () => 'ok')

    await expect(creerVerrouAuth({ signaler })('lock:x', 10_000, fn)).resolves.toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
    expect((signaler.mock.calls[0][1] as Error).name).toBe('SecurityError')
  })

  it('signalement par défaut : avertissement console à chaque repli, message Sentry une seule fois par page', async () => {
    installerNavigatorLocks({ refuse: true })
    const verrou = creerVerrouAuth()

    await verrou('lock:x', 10_000, async () => 1)
    await verrou('lock:x', 10_000, async () => 2)

    expect(console.warn).toHaveBeenCalledTimes(2)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0][1]).toMatchObject({
      level: 'warning',
      tags: { feature: 'auth-verrou' },
      extra: { verrou: 'lock:x' },
    })
  })
})
