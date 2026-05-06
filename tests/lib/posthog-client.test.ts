import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const initMock = vi.fn()
const captureMock = vi.fn()
const identifyMock = vi.fn()
const resetMock = vi.fn()
const optInMock = vi.fn()
const optOutMock = vi.fn()

vi.mock('posthog-js', () => ({
  default: {
    init: (...args: unknown[]) => {
      initMock(...args)
      return {
        capture: captureMock,
        identify: identifyMock,
        reset: resetMock,
        opt_in_capturing: optInMock,
        opt_out_capturing: optOutMock,
        debug: vi.fn(),
      }
    },
    capture: captureMock,
    identify: identifyMock,
    reset: resetMock,
    opt_in_capturing: optInMock,
    opt_out_capturing: optOutMock,
  },
}))

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  process.env = { ...ORIGINAL_ENV }
  process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test_key'
  process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://eu.posthog.com'
  // jsdom provides localStorage, ensure it's clean per test.
  localStorage.clear()
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('lib/posthog/client', () => {
  it('capture is a no-op when consent has not been given', async () => {
    const mod = await import('@/lib/posthog/client')
    await mod.capture('whatever_event', { foo: 'bar' })
    expect(initMock).not.toHaveBeenCalled()
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('capture is a no-op when NEXT_PUBLIC_POSTHOG_KEY is missing', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.capture('whatever_event')
    expect(initMock).not.toHaveBeenCalled()
    expect(captureMock).not.toHaveBeenCalled()
  })

  it('capture initialises and forwards to posthog when consent + key are present', async () => {
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.capture('event_a', { x: 1 })
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock).toHaveBeenCalledWith('phc_test_key', expect.objectContaining({
      api_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false,
      autocapture: false,
    }))
    expect(captureMock).toHaveBeenCalledWith('event_a', { x: 1 })
  })

  it('init runs at most once across multiple capture calls', async () => {
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.capture('e1')
    await mod.capture('e2', { k: 'v' })
    await mod.capture('e3')
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(captureMock).toHaveBeenCalledTimes(3)
  })

  it('identify forwards userId + traits', async () => {
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.identify('user-1', { role: 'artisan', locale: 'fr' })
    expect(identifyMock).toHaveBeenCalledWith('user-1', { role: 'artisan', locale: 'fr' })
  })

  it('reset is a no-op before init', async () => {
    const mod = await import('@/lib/posthog/client')
    await mod.reset()
    expect(resetMock).not.toHaveBeenCalled()
  })

  it('reset forwards to posthog after init', async () => {
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.capture('boot') // triggers init
    await mod.reset()
    expect(resetMock).toHaveBeenCalledTimes(1)
  })

  it('optOut forwards once init has happened', async () => {
    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    const mod = await import('@/lib/posthog/client')
    await mod.capture('boot')
    await mod.optOut()
    expect(optOutMock).toHaveBeenCalledTimes(1)
  })

  it('optIn re-initialises when called after consent flips on', async () => {
    const mod = await import('@/lib/posthog/client')
    await mod.optIn() // no consent yet → no init
    expect(initMock).not.toHaveBeenCalled()

    localStorage.setItem('vitfix_cookie_consent', JSON.stringify({ performance: true }))
    await mod.optIn()
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(optInMock).toHaveBeenCalledTimes(1)
  })
})
