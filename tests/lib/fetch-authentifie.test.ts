// @vitest-environment node
// lib/fetch-authentifie.ts — appels /api avec le jeton de la session (lot 4 Sentry du 28/10/2026).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const simul = vi.hoisted(() => ({ getSession: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: simul.getSession } } }))

import { fetchAuthentifie, jetonSession } from '@/lib/fetch-authentifie'

const fetchMock = vi.fn<(url: string, options?: RequestInit) => Promise<Response>>(async () => new Response('{}', { status: 200 }))

beforeEach(() => {
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const entetes = (appel: number) => {
  const options = fetchMock.mock.calls[appel][1] ?? {}
  return (options.headers ?? {}) as Record<string, string>
}

describe('jetonSession', () => {
  it('rend le jeton de la session, null sans session ou si la lecture lève', async () => {
    simul.getSession.mockResolvedValueOnce({ data: { session: { access_token: 'jeton' } } })
    await expect(jetonSession()).resolves.toBe('jeton')
    simul.getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(jetonSession()).resolves.toBeNull()
    simul.getSession.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'))
    await expect(jetonSession()).resolves.toBeNull()
  })
})

describe('fetchAuthentifie', () => {
  it('ajoute Authorization: Bearer et Content-Type JSON, et transmet les options (signal, méthode, corps)', async () => {
    simul.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton-xyz' } } })
    const controleur = new AbortController()
    await fetchAuthentifie('/api/artisan-clients?artisan_id=a1', { method: 'POST', body: '{"a":1}', signal: controleur.signal })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/artisan-clients?artisan_id=a1')
    expect(options?.method).toBe('POST')
    expect(options?.body).toBe('{"a":1}')
    expect(options?.signal).toBe(controleur.signal)
    expect(entetes(0)).toMatchObject({ Authorization: 'Bearer jeton-xyz', 'Content-Type': 'application/json' })
  })

  it('ne force pas Content-Type pour un FormData', async () => {
    simul.getSession.mockResolvedValue({ data: { session: { access_token: 'jeton' } } })
    await fetchAuthentifie('/api/upload', { method: 'POST', body: new FormData() })
    expect(entetes(0)).toMatchObject({ Authorization: 'Bearer jeton' })
    expect(entetes(0)['Content-Type']).toBeUndefined()
  })

  it('sans session : appel sans en-tête, la route répondra 401 à l’appelant', async () => {
    simul.getSession.mockResolvedValue({ data: { session: null } })
    await fetchAuthentifie('/api/artisan-clients?artisan_id=a1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][1]).toEqual({})
  })
})
