// @vitest-environment node
// tests/lib/sentry-utilisateur.test.ts — lot 9 Sentry du 28/10/2026 : Sentry.setUser({ id }) après connexion,
// setUser(null) à la déconnexion, identifiant seul.

import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as Sentry from '@sentry/nextjs'
import { lierUtilisateurSentry, utilisateurSentryPourEvenement } from '@/lib/sentry-utilisateur'

vi.mock('@sentry/nextjs', () => ({ setUser: vi.fn() }))

beforeEach(() => {
  vi.mocked(Sentry.setUser).mockClear()
})

describe('utilisateurSentryPourEvenement', () => {
  it('session avec utilisateur → { id } seulement ; SIGNED_OUT ou session absente → null', () => {
    const session = { user: { id: 'u1', email: 'camille@example.com', user_metadata: { full_name: 'Camille' } } }
    expect(utilisateurSentryPourEvenement('INITIAL_SESSION', session)).toEqual({ id: 'u1' })
    expect(utilisateurSentryPourEvenement('SIGNED_IN', session)).toEqual({ id: 'u1' })
    expect(utilisateurSentryPourEvenement('TOKEN_REFRESHED', session)).toEqual({ id: 'u1' })
    expect(utilisateurSentryPourEvenement('SIGNED_OUT', session)).toBeNull()
    expect(utilisateurSentryPourEvenement('INITIAL_SESSION', null)).toBeNull()
    expect(utilisateurSentryPourEvenement('INITIAL_SESSION', { user: { id: '' } })).toBeNull()
  })
})

describe('lierUtilisateurSentry', () => {
  it('abonne un callback synchrone qui pose puis retire l’utilisateur', () => {
    const rappels: Array<(event: string, session: { user?: { id?: string } } | null) => void> = []
    lierUtilisateurSentry({ onAuthStateChange: (cb) => { rappels.push(cb); return {} } })
    expect(rappels).toHaveLength(1)

    expect(rappels[0]('INITIAL_SESSION', { user: { id: 'u1' } })).toBeUndefined()
    expect(Sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' })
    rappels[0]('SIGNED_OUT', null)
    expect(Sentry.setUser).toHaveBeenLastCalledWith(null)
    expect(Sentry.setUser).toHaveBeenCalledTimes(2)
  })

  it('ne lève pas si l’abonnement échoue', () => {
    const avertissement = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => lierUtilisateurSentry({ onAuthStateChange: () => { throw new Error('indisponible') } })).not.toThrow()
    expect(avertissement).toHaveBeenCalled()
    avertissement.mockRestore()
  })
})
