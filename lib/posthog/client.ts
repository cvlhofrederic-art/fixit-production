'use client'

/**
 * Browser-side PostHog wrapper, gated behind the existing GDPR consent
 * flow (localStorage `vitfix_cookie_consent.performance`).
 *
 * Init is lazy and idempotent: nothing loads if the consent flag is false
 * or if NEXT_PUBLIC_POSTHOG_KEY is missing. Subsequent capture/identify
 * calls become no-ops in that case, so call-sites never have to guard.
 *
 * The pre-existing `lib/analytics.ts` queue keeps writing to our internal
 * /api/analytics/track endpoint; the bridge in that file fans events out
 * to PostHog when this client is ready.
 */
import type { PostHog } from 'posthog-js'

type CaptureProps = Record<string, unknown>

let _client: PostHog | null = null
let _initPromise: Promise<PostHog | null> | null = null

function readConsent(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('vitfix_cookie_consent')
    if (!raw) return false
    const consent = JSON.parse(raw)
    return consent?.performance === true
  } catch {
    return false
  }
}

function readConfig() {
  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
  }
}

async function ensureClient(): Promise<PostHog | null> {
  if (typeof window === 'undefined') return null
  if (_client) return _client
  if (_initPromise) return _initPromise

  const { key, host } = readConfig()
  if (!key) return null
  if (!readConsent()) return null

  _initPromise = (async () => {
    const { default: posthog } = await import('posthog-js')
    posthog.init(key, {
      api_host: host,
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: false,
      disable_session_recording: true,
      respect_dnt: true,
      loaded: (instance) => {
        if (process.env.NODE_ENV === 'development') {
          instance.debug(false)
        }
      },
    })
    _client = posthog
    return posthog
  })().catch((err) => {
    console.warn('[posthog] init failed', err)
    _initPromise = null
    return null
  })
  return _initPromise
}

export async function capture(event: string, properties?: CaptureProps): Promise<void> {
  const client = await ensureClient()
  if (!client) return
  client.capture(event, properties)
}

export async function identify(userId: string, traits?: CaptureProps): Promise<void> {
  const client = await ensureClient()
  if (!client) return
  client.identify(userId, traits)
}

export async function reset(): Promise<void> {
  if (!_client) return
  _client.reset()
}

export async function optIn(): Promise<void> {
  // After the user accepts consent, we may have skipped init at boot.
  // Re-trigger ensureClient so subsequent captures go through.
  const client = await ensureClient()
  client?.opt_in_capturing()
}

export async function optOut(): Promise<void> {
  if (!_client) return
  _client.opt_out_capturing()
}

/**
 * Test-only escape hatch: drop the cached client so unit tests can stub
 * the consent / config differently between scenarios.
 */
export function _resetForTests(): void {
  _client = null
  _initPromise = null
}
