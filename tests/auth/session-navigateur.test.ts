// @vitest-environment node
// tests/auth/session-navigateur.test.ts
//
// lib/auth/session-navigateur.ts : verdicts d'une lecture de session (valide / refusée / indisponible), second
// essai après 500 ms sur abandon du verrou d'auth ou délai dépassé, jamais d'exception.

import { describe, it, expect, vi } from 'vitest'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, type UserResponse } from '@supabase/supabase-js'
import {
  DELAI_AVANT_NOUVEL_ESSAI_MS,
  DelaiDepasseError,
  avecDelai,
  classerSession,
  lireSessionSure,
  meriteNouvelEssai,
  verifierSessionNavigateur,
} from '@/lib/auth/session-navigateur'

const UTILISATEUR = { id: 'u1', app_metadata: { role: 'client' }, user_metadata: {}, aud: 'authenticated', created_at: '' }
const abortError = () => new DOMException('signal is aborted without reason', 'AbortError')
const reponse = (user: unknown, error: unknown = null) => ({ data: { user }, error }) as unknown as UserResponse

describe('classerSession', () => {
  it('utilisateur présent → valide', () => {
    expect(classerSession(reponse(UTILISATEUR))).toEqual({ statut: 'valide', user: UTILISATEUR })
  })

  it('utilisateur nul sans erreur ou AuthSessionMissingError → refusée, motif absente', () => {
    expect(classerSession(reponse(null))).toEqual({ statut: 'refusee', motif: 'absente' })
    const absente = new AuthSessionMissingError()
    expect(classerSession(reponse(null, absente))).toEqual({ statut: 'refusee', motif: 'absente', erreur: absente })
  })

  it('AuthApiError 401, 403 ou 404 → refusée, motif authentification', () => {
    for (const statut of [401, 403, 404]) {
      const erreur = new AuthApiError('refus', statut, 'bad_jwt')
      expect(classerSession(reponse(null, erreur))).toEqual({ statut: 'refusee', motif: 'authentification', erreur })
    }
  })

  it('autres statuts, erreurs réseau ou inconnues → indisponible (la session n’est pas détruite)', () => {
    for (const statut of [400, 408, 422, 429, 500, 502, 503]) {
      const erreur = new AuthApiError('panne', statut, 'unexpected_failure')
      expect(classerSession(reponse(null, erreur))).toEqual({ statut: 'indisponible', erreur })
    }
    const reseau = new AuthRetryableFetchError('Failed to fetch', 0)
    expect(classerSession(reponse(null, reseau))).toEqual({ statut: 'indisponible', erreur: reseau })
    const inconnue = new Error('bizarre')
    expect(classerSession(reponse(null, inconnue))).toEqual({ statut: 'indisponible', erreur: inconnue })
  })
})

describe('meriteNouvelEssai', () => {
  it('abandon du verrou ou délai dépassé → oui ; autre erreur → non', () => {
    expect(meriteNouvelEssai(abortError())).toBe(true)
    expect(meriteNouvelEssai(Object.assign(new Error('x'), { isAcquireTimeout: true }))).toBe(true)
    expect(meriteNouvelEssai(new DelaiDepasseError(10))).toBe(true)
    expect(meriteNouvelEssai(new TypeError('Failed to fetch'))).toBe(false)
    expect(meriteNouvelEssai(new AuthApiError('x', 500, 'y'))).toBe(false)
  })
})

describe('avecDelai', () => {
  it('rend la valeur avant le délai, DelaiDepasseError après', async () => {
    await expect(avecDelai(Promise.resolve('ok'), 50)).resolves.toBe('ok')
    await expect(avecDelai(new Promise(() => {}), 20)).rejects.toBeInstanceOf(DelaiDepasseError)
    await expect(avecDelai(Promise.reject(new Error('boum')), 50)).rejects.toThrow('boum')
  })
})

describe('verifierSessionNavigateur', () => {
  const attente = vi.fn(async () => {})

  it('session valide au premier essai', async () => {
    const auth = { getUser: vi.fn(async () => reponse(UTILISATEUR)) }
    await expect(verifierSessionNavigateur(auth, { attente })).resolves.toEqual({ statut: 'valide', user: UTILISATEUR })
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('AbortError du verrou puis réponse valide : second essai après 500 ms', async () => {
    attente.mockClear()
    const auth = {
      getUser: vi.fn()
        .mockRejectedValueOnce(abortError())
        .mockResolvedValueOnce(reponse(UTILISATEUR)),
    }
    await expect(verifierSessionNavigateur(auth, { attente })).resolves.toEqual({ statut: 'valide', user: UTILISATEUR })
    expect(auth.getUser).toHaveBeenCalledTimes(2)
    expect(attente).toHaveBeenCalledWith(DELAI_AVANT_NOUVEL_ESSAI_MS)
  })

  it('AbortError deux fois : session inconnue (indisponible), sans exception', async () => {
    const auth = { getUser: vi.fn(async () => { throw abortError() }) }
    const verdict = await verifierSessionNavigateur(auth, { attente })
    expect(verdict.statut).toBe('indisponible')
    expect((verdict as { erreur: Error }).erreur.name).toBe('AbortError')
    expect(auth.getUser).toHaveBeenCalledTimes(2)
  })

  it('erreur réseau (exception) : indisponible sans second essai', async () => {
    const auth = { getUser: vi.fn(async () => { throw new TypeError('Failed to fetch') }) }
    const verdict = await verifierSessionNavigateur(auth, { attente })
    expect(verdict.statut).toBe('indisponible')
    expect(auth.getUser).toHaveBeenCalledTimes(1)
  })

  it('aucune réponse : délai dépassé, second essai, puis indisponible avec DelaiDepasseError', async () => {
    const auth = { getUser: vi.fn(() => new Promise<UserResponse>(() => {})) }
    const verdict = await verifierSessionNavigateur(auth, { attente, delaiMs: 20 })
    expect(verdict.statut).toBe('indisponible')
    expect((verdict as { erreur: unknown }).erreur).toBeInstanceOf(DelaiDepasseError)
    expect(auth.getUser).toHaveBeenCalledTimes(2)
  })
})

describe('lireSessionSure', () => {
  const attente = vi.fn(async () => {})
  const SESSION = { access_token: 'jeton', user: UTILISATEUR }
  const session = (s: unknown, error: unknown = null) => ({ data: { session: s }, error }) as never

  it('session locale présente', async () => {
    const auth = { getSession: vi.fn(async () => session(SESSION)) }
    await expect(lireSessionSure(auth, { attente })).resolves.toEqual({ session: SESSION, indisponible: false, erreur: undefined })
  })

  it('pas de session, ou jeton de rafraîchissement refusé (AuthApiError) : déconnecté, pas « indisponible »', async () => {
    await expect(lireSessionSure({ getSession: vi.fn(async () => session(null)) }, { attente }))
      .resolves.toMatchObject({ session: null, indisponible: false })
    const refus = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found')
    await expect(lireSessionSure({ getSession: vi.fn(async () => session(null, refus)) }, { attente }))
      .resolves.toMatchObject({ session: null, indisponible: false, erreur: refus })
  })

  it('erreur réseau renvoyée par getSession : indisponible', async () => {
    const reseau = new AuthRetryableFetchError('Failed to fetch', 0)
    await expect(lireSessionSure({ getSession: vi.fn(async () => session(null, reseau)) }, { attente }))
      .resolves.toMatchObject({ session: null, indisponible: true, erreur: reseau })
  })

  it('AbortError du verrou deux fois : indisponible, sans exception', async () => {
    const auth = { getSession: vi.fn(async () => { throw abortError() }) }
    const lecture = await lireSessionSure(auth, { attente })
    expect(lecture).toMatchObject({ session: null, indisponible: true })
    expect(auth.getSession).toHaveBeenCalledTimes(2)
  })

  it('AbortError puis session : second essai réussi', async () => {
    const auth = { getSession: vi.fn().mockRejectedValueOnce(abortError()).mockResolvedValueOnce(session(SESSION)) }
    await expect(lireSessionSure(auth, { attente })).resolves.toMatchObject({ session: SESSION, indisponible: false })
  })
})
