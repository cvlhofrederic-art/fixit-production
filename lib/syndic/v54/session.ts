'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Session syndic côté client pour le dashboard v54 (Phase 2).
 *
 * Lit la session Supabase + le rôle (app_metadata.role, non modifiable côté
 * client). `authed` UNIQUEMENT si le rôle est un rôle syndic (ou super admin).
 * Sert à décider : données réelles (authentifié) vs données mock (anonyme →
 * la preview publique /syndic/v54 reste fonctionnelle).
 *
 * Le token (access_token) est passé en `Authorization: Bearer` aux routes
 * /api/syndic/* (cf. lib/auth-helpers.getAuthUser).
 */
export type SyndicSessionStatus = 'loading' | 'authed' | 'anon'

export interface SyndicSession {
  status: SyndicSessionStatus
  token: string | null
  userId: string | null
  role: string | null
}

/** Rôle syndic (miroir client de lib/auth-helpers.isSyndicRole). */
function isSyndicRoleValue(role: unknown): role is string {
  return (
    typeof role === 'string' &&
    (role === 'syndic' || role.startsWith('syndic_') || role === 'super_admin' || role === 'admin')
  )
}

const ANON: SyndicSession = { status: 'anon', token: null, userId: null, role: null }

export function useSyndicSession(): SyndicSession {
  const [session, setSession] = useState<SyndicSession>({ status: 'loading', token: null, userId: null, role: null })

  useEffect(() => {
    let active = true

    const resolve = async () => {
      const { data } = await supabase.auth.getSession()
      if (!active) return
      const s = data.session
      const role = (s?.user?.app_metadata?.role as string | undefined) ?? null
      if (s?.access_token && isSyndicRoleValue(role)) {
        setSession({ status: 'authed', token: s.access_token, userId: s.user.id, role })
      } else {
        setSession(ANON)
      }
    }

    resolve()
    // Re-résoudre sur login/logout/refresh token.
    const { data: sub } = supabase.auth.onAuthStateChange(() => { resolve() })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return session
}
