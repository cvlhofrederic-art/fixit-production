'use client'

import { useEffect, useState } from 'react'
import { isAnalyticsAllowed } from './CookieConsent'

/**
 * Renders Vercel Analytics + SpeedInsights only when the user
 * has accepted performance cookies (RGPD-compliant).
 * Re-checks consent every 5 seconds (matches CookieConsent enforcement interval).
 */
export default function ConsentAnalytics() {
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    setAllowed(isAnalyticsAllowed())
    const id = setInterval(() => setAllowed(isAnalyticsAllowed()), 5_000)
    return () => clearInterval(id)
  }, [])

  if (!allowed) return null

  return (
    <>
      <SpeedInsightsLazy />
      <AnalyticsLazy />
    </>
  )
}

// Lazy-loaded to avoid bundling when consent not given
import dynamic from 'next/dynamic'

const SpeedInsightsLazy = dynamic(
  () => import('@vercel/speed-insights/next').then((m) => m.SpeedInsights),
  { ssr: false }
)

const AnalyticsLazy = dynamic(
  () => import('@vercel/analytics/next').then((m) => m.Analytics),
  { ssr: false }
)
