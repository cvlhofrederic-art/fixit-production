// tests/components/web-vitals-reporter.test.tsx — lot 9 Sentry du 28/10/2026 : plus de « Web Vitals X poor »
// (doublon des Web Vitals natifs, faux « poor », CLS affiché 0, robots comptés) ; la mesure reste attachée à la
// transaction, et les robots sont ignorés.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as Sentry from '@sentry/nextjs'

type Metrique = { name: string; value: number; rating: string; id: string; delta: number; navigationType: string }
const h = vi.hoisted(() => ({ rappel: null as null | ((m: Metrique) => void) }))

vi.mock('next/web-vitals', () => ({ useReportWebVitals: (cb: (m: Metrique) => void) => { h.rappel = cb } }))
vi.mock('@sentry/nextjs', () => ({ setMeasurement: vi.fn(), captureMessage: vi.fn() }))

import WebVitalsReporter, { estRobot } from '@/components/common/WebVitalsReporter'

const metrique = (name: string, value: number, rating = 'poor'): Metrique => ({ name, value, rating, id: 'm1', delta: value, navigationType: 'navigate' })
let agentOrigine: PropertyDescriptor | undefined

function definirAgent(valeur: string) {
  Object.defineProperty(globalThis.navigator, 'userAgent', { configurable: true, get: () => valeur })
}

beforeEach(() => {
  vi.clearAllMocks()
  h.rappel = null
  agentOrigine = Object.getOwnPropertyDescriptor(globalThis.navigator, 'userAgent')
  definirAgent('Mozilla/5.0 (Windows NT 10.0) Chrome/155.0')
})

afterEach(() => {
  if (agentOrigine) Object.defineProperty(globalThis.navigator, 'userAgent', agentOrigine)
  else Reflect.deleteProperty(globalThis.navigator, 'userAgent')
})

describe('WebVitalsReporter', () => {
  it('attache la mesure à la transaction (CLS sans unité) et n’envoie plus aucun message « poor »', () => {
    render(<WebVitalsReporter />)
    expect(h.rappel).toBeTypeOf('function')
    h.rappel!(metrique('LCP', 6228))
    h.rappel!(metrique('CLS', 0.413))
    h.rappel!(metrique('INP', 280, 'needs-improvement'))
    expect(Sentry.setMeasurement).toHaveBeenCalledWith('LCP', 6228, 'millisecond')
    expect(Sentry.setMeasurement).toHaveBeenCalledWith('CLS', 0.413, '')
    expect(Sentry.setMeasurement).toHaveBeenCalledTimes(3)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('ignore les robots et outils de test', () => {
    definirAgent('Mozilla/5.0 HeadlessChrome/146.0.0.0')
    render(<WebVitalsReporter />)
    h.rappel!(metrique('LCP', 9000))
    expect(Sentry.setMeasurement).not.toHaveBeenCalled()
    expect(estRobot('Chrome-Lighthouse')).toBe(true)
    expect(estRobot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true)
    expect(estRobot('Mozilla/5.0 (iPhone) Safari/605.1')).toBe(false)
    expect(estRobot(undefined)).toBe(false)
  })

  it('le source ne contient plus de captureMessage', () => {
    const source = readFileSync(join(process.cwd(), 'components/common/WebVitalsReporter.tsx'), 'utf8')
    expect(source).not.toMatch(/Sentry\.captureMessage\(/)
    expect(source).toContain('Sentry.setMeasurement(')
  })
})
