'use client'

import { useEffect, useState } from 'react'
import { isAnalyticsAllowed } from './CookieConsent'
import { trackPageView } from '@/lib/analytics'

/**
 * Tracks page views when the user has accepted performance cookies (RGPD-compliant).
 * Re-checks consent every 5 seconds (matches CookieConsent enforcement interval).
 *
 * Cloudflare Web Analytics is loaded via script tag in layout.tsx or _headers.
 * This component handles custom event tracking only.
 */
export default function ConsentAnalytics() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const wasAllowed = allowed
    const next = isAnalyticsAllowed()
    setAllowed(next)
    if (!wasAllowed && next) trackPageView()
    const id = setInterval(() => {
      setAllowed(prev => {
        const now = isAnalyticsAllowed()
        if (!prev && now) trackPageView()
        return now
      })
    }, 5_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cloudflare Web Analytics beacon (consent-gated)
  if (!allowed) return null

  return (
    <script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon='{"token": ""}'
    />
  )
}
