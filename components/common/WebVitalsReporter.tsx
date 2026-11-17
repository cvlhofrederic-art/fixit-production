'use client'

import { useReportWebVitals } from 'next/web-vitals'
import * as Sentry from '@sentry/nextjs'

// Mesure LCP / INP / CLS / FCP / TTFB et les attache à la transaction Sentry de la page (setMeasurement),
// sur un échantillon de 10 % en production.
//
// Lot 9 de l'analyse Sentry du 28/10/2026 : le `captureMessage` « Web Vitals X poor » a été retiré. Il
// doublonnait les Web Vitals natifs du tracing (950 événements d'avertissement sur 90 jours), ses seuils
// étaient ceux de la note « bon » (tout « needs-improvement » était étiqueté « poor », 144 des 268 événements),
// `toFixed(0)` affichait « CLS poor: 0 », et 29 des 75 LCP venaient de HeadlessChrome. Les Web Vitals p75 par
// route se lisent dans Sentry → Performance → Web Vitals (dataset spans).

const ROBOTS = /HeadlessChrome|Lighthouse|bot|crawler|spider/i

function shouldSample(rate: number): boolean {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 0xffffffff < rate
}

/** Robots et outils de test (HeadlessChrome, Lighthouse, crawlers) : leurs mesures ne décrivent pas les visiteurs. */
export function estRobot(userAgent: string | undefined): boolean {
  return ROBOTS.test(userAgent ?? '')
}

export default function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    if (typeof globalThis.window === 'undefined') return
    if (estRobot(globalThis.navigator?.userAgent)) return
    if (process.env.NODE_ENV === 'production' && !shouldSample(0.1)) return

    Sentry.setMeasurement(metric.name, metric.value, metric.name === 'CLS' ? '' : 'millisecond')
  })

  return null
}
