'use client'

import { useEffect, type ReactNode } from 'react'
import { createClient } from '@supabase/supabase-js'
import { capture, identify, optIn, optOut, reset } from '@/lib/posthog/client'

/**
 * PostHogProvider boots PostHog on the client when (and only when) the
 * GDPR consent gate is open, identifies the Supabase user on auth
 * lifecycle events, and re-syncs opt-in/opt-out as the user toggles
 * cookie consent later.
 *
 * Why a side-effect-only provider rather than `posthog-js/react`:
 *   - We never want PostHog to load before consent — `usePostHog()` would
 *     forces eager init.
 *   - The bridge in lib/analytics.ts already gives every callsite access
 *     to PostHog via the existing trackEvent() — no need for context.
 */
const CONSENT_RECHECK_MS = 5_000
const CONSENT_KEY = 'vitfix_cookie_consent'

function readPerformanceConsent(): boolean {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return false
    const consent = JSON.parse(raw)
    return consent?.performance === true
  } catch {
    return false
  }
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  // Sync consent flips with PostHog opt-in/opt-out.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let lastConsent = readPerformanceConsent()
    if (lastConsent) optIn()

    const interval = setInterval(() => {
      const next = readPerformanceConsent()
      if (next !== lastConsent) {
        lastConsent = next
        if (next) optIn()
        else optOut()
      }
    }, CONSENT_RECHECK_MS)

    return () => clearInterval(interval)
  }, [])

  // Identify on auth state change.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return

    const supabase = createClient(url, anonKey)

    const handleSignedIn = async (sessionUser: { id: string; email?: string | null; created_at?: string; app_metadata?: Record<string, unknown> }) => {
      const role = (sessionUser.app_metadata?.role as string | undefined) ?? 'unknown'
      const locale =
        document.cookie
          .split(';')
          .find((c) => c.trim().startsWith('locale='))
          ?.split('=')[1] ?? 'fr'
      await identify(sessionUser.id, {
        email: sessionUser.email ?? undefined,
        role,
        locale,
        signed_up_at: sessionUser.created_at,
      })
      await capture('session_started', { role, locale })
    }

    // Initial bootstrap: if a session already exists.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        handleSignedIn(data.session.user)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        handleSignedIn(session.user)
      } else if (event === 'SIGNED_OUT') {
        reset()
      }
    })

    return () => {
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  return <>{children}</>
}

export default PostHogProvider
