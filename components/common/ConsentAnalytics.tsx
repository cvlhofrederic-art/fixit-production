'use client'

import { useEffect, useState } from 'react'
import { isAnalyticsAllowed } from './CookieConsent'
import { trackPageView } from '@/lib/analytics'

/**
 * Tracks page views when the user has accepted performance cookies (RGPD-compliant).
 * Re-checks consent every 5 seconds (matches CookieConsent enforcement interval).
 *
 * Sources de mesure activées sous consent "performance" :
 *   1. Cloudflare Web Analytics — beacon serveur (token vide pour l'instant)
 *   2. Google Analytics 4 — gtag.js avec anonymize_ip + IP au niveau pays
 *   3. Custom event tracking via /api/analytics/track (lib/analytics.ts)
 *
 * Tout est strictement gated par `isAnalyticsAllowed()`. Sans consent, aucun
 * de ces scripts ne charge. Cookies _ga / _gid / _gat sont auto-purgés par
 * CookieConsent.tsx (ANALYTICS_PATTERNS) si l'user décline.
 */

// Public — visible dans le HTML rendu, pas un secret. Hardcodé pour éviter
// un round-trip env var sur Cloudflare Workers.
const GA_MEASUREMENT_ID = 'G-NRVL0FMJBY'

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

  if (!allowed) return null

  return (
    <>
      {/* Cloudflare Web Analytics beacon (consent-gated) */}
      <script
        defer
        src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": ""}'
      />

      {/* Google Analytics 4 (consent-gated, anonymize_ip) */}
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              anonymize_ip: true,
              allow_google_signals: false,
              cookie_flags: 'SameSite=Lax;Secure'
            });
          `,
        }}
      />
    </>
  )
}
