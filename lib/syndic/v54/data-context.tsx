'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Mission, Immeuble, Artisan, TeamMember } from '@/components/syndic-dashboard/types'
import { useSyndicSession } from './session'
import { fetchMissions, fetchImmeubles, fetchArtisans, fetchCoproprios, fetchTeam, type Coprop } from './api'

/**
 * Provider data du dashboard syndic v54 (Phase 2).
 *
 * Récupère UNE FOIS les datasets cœur du cabinet (missions, immeubles,
 * artisans) quand l'utilisateur est un syndic authentifié, et les expose à
 * tous les modules v54 via useSyndicData(). Anonyme → `authenticated:false`
 * + listes vides : chaque module retombe alors sur ses données mock (la
 * preview publique /syndic/v54 reste intacte).
 *
 * Pattern aligné sur l'ancien dashboard (fetch unique en haut, partagé aux
 * sections) — mais branché aux routes /api/syndic/* via Bearer token.
 */
export interface SyndicData {
  /** true = syndic connecté → données réelles ; false = mock/preview. */
  authenticated: boolean
  loading: boolean
  missions: Mission[]
  immeubles: Immeuble[]
  artisans: Artisan[]
  /** Optionnels : ajoutés en P2.2 ; les consommateurs utilisent `?? []`. */
  coproprios?: Coprop[]
  team?: TeamMember[]
}

const EMPTY: SyndicData = { authenticated: false, loading: false, missions: [], immeubles: [], artisans: [], coproprios: [], team: [] }

/** Exporté pour les tests (injection d'un value mock) — l'app utilise SyndicDataProvider. */
export const SyndicDataContext = createContext<SyndicData>(EMPTY)

/** Hook d'accès aux données syndic réelles (vide + authenticated:false hors auth). */
export const useSyndicData = (): SyndicData => useContext(SyndicDataContext)

export function SyndicDataProvider({ children }: { children: ReactNode }) {
  const session = useSyndicSession()
  const [data, setData] = useState<SyndicData>(EMPTY)

  useEffect(() => {
    if (session.status === 'loading') {
      setData({ ...EMPTY, loading: true })
      return
    }
    if (session.status === 'anon' || !session.token) {
      setData(EMPTY)
      return
    }

    let active = true
    const token = session.token
    setData({ ...EMPTY, authenticated: true, loading: true })

    Promise.allSettled([fetchMissions(token), fetchImmeubles(token), fetchArtisans(token), fetchCoproprios(token), fetchTeam(token)]).then(
      ([m, i, a, c, t]) => {
        if (!active) return
        setData({
          authenticated: true,
          loading: false,
          missions: m.status === 'fulfilled' ? m.value : [],
          immeubles: i.status === 'fulfilled' ? i.value : [],
          artisans: a.status === 'fulfilled' ? a.value : [],
          coproprios: c.status === 'fulfilled' ? c.value : [],
          team: t.status === 'fulfilled' ? t.value : [],
        })
      },
    )

    return () => {
      active = false
    }
  }, [session.status, session.token])

  return <SyndicDataContext.Provider value={data}>{children}</SyndicDataContext.Provider>
}
