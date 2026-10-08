/**
 * lib/auth/session-navigateur.ts — classificateur unique de la vérification de session (getUser), partagé par la page
 * de connexion et le tableau de bord client.
 *
 * « refusee » (la session de ce navigateur est inutilisable, l'appelant peut la fermer) : utilisateur nul sans erreur,
 * AuthSessionMissingError, AuthApiError 401, 403 ou 404. Tout le reste est « indisponible » (la session n'est jamais
 * détruite) : autres 4xx (400, 422…), 408, 429, 5xx, réseau, délai dépassé, AbortError ou délai du verrou, exception.
 * Avant : un délai dépassé ou une AbortError du verrou valait « refusee », et le tableau de bord détruisait une session
 * valide sur une simple lenteur ; les deux pages ne classaient pas les 4xx de la même façon.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AuthApiError,
  AuthInvalidTokenResponseError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthUnknownError,
  NavigatorLockAcquireTimeoutError,
  type UserResponse,
} from '@supabase/supabase-js'
import {
  classerSession,
  deconnecterSessionServeur,
  DELAI_REPONSE_AUTH_MS,
  verifierSessionNavigateur,
} from '@/lib/auth/session-navigateur'

const UTILISATEUR = { id: 'u1', app_metadata: { role: 'client' }, user_metadata: {}, aud: 'authenticated', created_at: '' }

function reponse(erreur: unknown): UserResponse {
  return { data: { user: null }, error: erreur } as unknown as UserResponse
}

function auth(resultat: () => Promise<UserResponse>) {
  return { getUser: vi.fn(resultat) }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('classerSession — session refusée (seuls cas où l’appelant peut la fermer)', () => {
  it.each([
    ['utilisateur nul sans erreur', reponse(null)],
    ['AuthSessionMissingError', reponse(new AuthSessionMissingError())],
    ['AuthApiError 401', reponse(new AuthApiError('missing authorization', 401, 'no_authorization'))],
    ['AuthApiError 403', reponse(new AuthApiError('invalid JWT', 403, 'bad_jwt'))],
    ['AuthApiError 404 (utilisateur supprimé)', reponse(new AuthApiError('User not found', 404, 'user_not_found'))],
  ])('%s → refusee', (_cas, resultat) => {
    expect(classerSession(resultat).statut).toBe('refusee')
  })
})

describe('classerSession — service indisponible (la session n’est jamais détruite)', () => {
  it.each([
    ['AuthApiError 400', new AuthApiError('Invalid Refresh Token: Refresh Token Not Found', 400, 'refresh_token_not_found')],
    ['AuthApiError 409', new AuthApiError('conflict', 409, 'conflict')],
    ['AuthApiError 422', new AuthApiError('unprocessable', 422, 'validation_failed')],
    ['AuthApiError 408', new AuthApiError('timeout', 408, 'request_timeout')],
    ['AuthApiError 429', new AuthApiError('Too many requests', 429, 'over_request_rate_limit')],
    ['AuthApiError 500', new AuthApiError('Internal error', 500, 'unexpected_failure')],
    ['AuthRetryableFetchError réseau', new AuthRetryableFetchError('Failed to fetch', 0)],
    ['AuthRetryableFetchError 503', new AuthRetryableFetchError('Service Unavailable', 503)],
    ['AuthUnknownError', new AuthUnknownError('réponse illisible', new SyntaxError('JSON'))],
    ['AuthInvalidTokenResponseError', new AuthInvalidTokenResponseError()],
    ['erreur quelconque', new Error('inattendue')],
  ])('%s → indisponible', (_cas, erreur) => {
    const verdict = classerSession(reponse(erreur))
    expect(verdict.statut).toBe('indisponible')
  })

  it('utilisateur présent → valide', () => {
    const verdict = classerSession({ data: { user: UTILISATEUR }, error: null } as unknown as UserResponse)
    expect(verdict).toEqual({ statut: 'valide', user: UTILISATEUR })
  })
})

describe('verifierSessionNavigateur — exceptions et lenteurs : indisponible, jamais refusee', () => {
  it.each([
    ['AbortError (signal du verrou)', new DOMException('The operation was aborted.', 'AbortError')],
    ['délai du verrou navigateur', new NavigatorLockAcquireTimeoutError('Acquiring an exclusive Navigator LockManager lock timed out')],
    ['TypeError réseau', new TypeError('Failed to fetch')],
  ])('getUser qui rejette (%s) → indisponible', async (_cas, erreur) => {
    const verdict = await verifierSessionNavigateur(auth(() => Promise.reject(erreur)))
    expect(verdict).toEqual({ statut: 'indisponible', erreur })
  })

  it('getUser qui ne répond pas → indisponible après le délai, pas avant', async () => {
    vi.useFakeTimers()
    let verdict: unknown
    void verifierSessionNavigateur(auth(() => new Promise(() => {}))).then((v) => { verdict = v })
    await vi.advanceTimersByTimeAsync(DELAI_REPONSE_AUTH_MS - 1)
    expect(verdict).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(verdict).toMatchObject({ statut: 'indisponible' })
  })

  it('reprend le verdict du classificateur pour une réponse', async () => {
    const refus = await verifierSessionNavigateur(auth(async () => reponse(new AuthApiError('invalid JWT', 403, 'bad_jwt'))))
    expect(refus.statut).toBe('refusee')
    const panne = await verifierSessionNavigateur(auth(async () => reponse(new AuthApiError('unprocessable', 422, 'validation_failed'))))
    expect(panne.statut).toBe('indisponible')
  })
})

describe('deconnecterSessionServeur', () => {
  it('POST /api/auth/logout/ avec la barre finale (trailingSlash: true, pas de 308 pendant une navigation)', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await deconnecterSessionServeur('pt')).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/auth/logout/')
    expect(options.method).toBe('POST')
    expect(options.keepalive).toBe(true)
    expect(JSON.parse(String(options.body))).toEqual({ locale: 'pt' })
  })
})
