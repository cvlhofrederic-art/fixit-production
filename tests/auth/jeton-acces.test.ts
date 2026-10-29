// @vitest-environment node
// tests/auth/jeton-acces.test.ts
//
// lib/auth/jeton-acces.ts : le jeton d'accès vient du cache tenu par les événements d'auth ; getSession() (prise du
// verrou partagé entre onglets) n'est appelé qu'au premier besoin, à l'expiration ou quand le cache est vide.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Rappel = (event: string, session: unknown) => unknown
const simul = vi.hoisted(() => ({
  getSession: vi.fn(),
  rappels: [] as Rappel[],
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: simul.getSession,
      onAuthStateChange: (rappel: Rappel) => {
        simul.rappels.push(rappel)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

import { jetonAcces, jetonEncoreValable, lireJetonAcces, reinitialiserJetonAcces } from '@/lib/auth/jeton-acces'

const dansUneHeure = () => Math.floor(Date.now() / 1000) + 3600
const sessionValable = (jeton = 'jeton-1') => ({ access_token: jeton, expires_at: dansUneHeure(), user: { id: 'u1' } })
const reponseSession = (session: unknown) => ({ data: { session }, error: null })

beforeEach(() => {
  reinitialiserJetonAcces()
  simul.rappels.length = 0
  simul.getSession.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('jetonEncoreValable', () => {
  it('jeton présent et expiration lointaine → valable ; proche de l’expiration ou absent → non', () => {
    expect(jetonEncoreValable(sessionValable() as never)).toBe(true)
    expect(jetonEncoreValable({ access_token: 'j', expires_at: Math.floor(Date.now() / 1000) + 30 } as never)).toBe(false)
    expect(jetonEncoreValable({ access_token: 'j', expires_at: Math.floor(Date.now() / 1000) - 1 } as never)).toBe(false)
    expect(jetonEncoreValable({ access_token: '' } as never)).toBe(false)
    expect(jetonEncoreValable(null)).toBe(false)
  })

  it('une session sans expires_at est tenue pour valable', () => {
    expect(jetonEncoreValable({ access_token: 'j' } as never)).toBe(true)
  })
})

describe('lireJetonAcces', () => {
  it('premier appel : une lecture de session ; appels suivants servis par le cache', async () => {
    simul.getSession.mockResolvedValue(reponseSession(sessionValable()))

    await expect(jetonAcces()).resolves.toBe('jeton-1')
    await expect(jetonAcces()).resolves.toBe('jeton-1')
    await expect(lireJetonAcces()).resolves.toEqual({ jeton: 'jeton-1', indisponible: false })

    expect(simul.getSession).toHaveBeenCalledTimes(1)
    expect(simul.rappels).toHaveLength(1)
  })

  it('le callback d’auth est synchrone et met le cache à jour (TOKEN_REFRESHED, SIGNED_OUT)', async () => {
    simul.getSession.mockResolvedValue(reponseSession(sessionValable('jeton-1')))
    await jetonAcces()

    expect(simul.rappels[0]('TOKEN_REFRESHED', sessionValable('jeton-2'))).toBeUndefined()
    await expect(jetonAcces()).resolves.toBe('jeton-2')
    expect(simul.getSession).toHaveBeenCalledTimes(1)

    simul.rappels[0]('SIGNED_OUT', null)
    simul.getSession.mockResolvedValue(reponseSession(null))
    await expect(lireJetonAcces()).resolves.toEqual({ jeton: null, indisponible: false })
    expect(simul.getSession).toHaveBeenCalledTimes(2)
  })

  it('jeton proche de l’expiration : la session est relue (auth-js la rafraîchit)', async () => {
    simul.getSession.mockResolvedValueOnce(reponseSession({ access_token: 'vieux', expires_at: Math.floor(Date.now() / 1000) + 30 }))
    simul.getSession.mockResolvedValueOnce(reponseSession(sessionValable('frais')))

    await expect(jetonAcces()).resolves.toBe('vieux')
    await expect(jetonAcces()).resolves.toBe('frais')
    expect(simul.getSession).toHaveBeenCalledTimes(2)
  })

  it('session indisponible (AbortError du verrou, deux fois) : jeton nul marqué indisponible, cache conservé', async () => {
    vi.useFakeTimers()
    simul.getSession.mockRejectedValue(new DOMException('signal is aborted without reason', 'AbortError'))

    const lecture = lireJetonAcces()
    await vi.advanceTimersByTimeAsync(600)
    await expect(lecture).resolves.toEqual({ jeton: null, indisponible: true })
    expect(simul.getSession).toHaveBeenCalledTimes(2)

    // Un événement d'auth ultérieur remet un jeton en cache sans nouvelle lecture.
    simul.rappels[0]('SIGNED_IN', sessionValable('apres'))
    await expect(jetonAcces()).resolves.toBe('apres')
    expect(simul.getSession).toHaveBeenCalledTimes(2)
  })
})
