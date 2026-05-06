'use client'

import { useReportWebVitals } from 'next/web-vitals'
import * as Sentry from '@sentry/nextjs'

// Mesure LCP / INP / CLS / FCP / TTFB et envoie à Sentry pour monitoring
// Core Web Vitals en prod (champ requis pour prouver les améliorations
// SEO en 2026 — voir web.dev/articles/inp).
//
// Sampling 10% en prod pour limiter le volume Sentry tout en gardant un
// signal statistique. Crypto.getRandomValues utilisé au lieu de Math.random
// pour cohérence sécurité (sampling non-critique mais évite warning Sonar).

function shouldSample(rate: number): boolean {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') return Math.random() < rate
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 0xffffffff < rate
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof globalThis.window === 'undefined') return

    if (process.env.NODE_ENV === 'production' && !shouldSample(0.1)) return

    const isPoor =
      (metric.name === 'LCP' && metric.value > 2500) ||
      (metric.name === 'INP' && metric.value > 200) ||
      (metric.name === 'CLS' && metric.value > 0.1) ||
      (metric.name === 'FCP' && metric.value > 1800) ||
      (metric.name === 'TTFB' && metric.value > 800)

    Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond')

    if (isPoor) {
      Sentry.captureMessage(`Web Vitals ${metric.name} poor: ${metric.value.toFixed(0)}`, {
        level: 'warning',
        tags: {
          web_vital: metric.name,
          rating: metric.rating,
          path: globalThis.location.pathname,
        },
        extra: {
          id: metric.id,
          delta: metric.delta,
          navigationType: metric.navigationType,
        },
      })
    }
  })

  return null
}
