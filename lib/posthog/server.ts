/**
 * Server-side PostHog wrapper. Used by API routes (Stripe webhook, devis
 * sync, etc.) to capture events that are authoritative on the backend.
 *
 * No-ops when POSTHOG_KEY (or NEXT_PUBLIC_POSTHOG_KEY) is missing — the
 * intent is that local dev and CI run without the SDK at all rather than
 * polluting a real PostHog project. Cloudflare Workers prod has the env
 * via wrangler.toml [vars].
 */
import type { PostHog as PostHogNode } from 'posthog-node'

let _client: PostHogNode | null = null
let _disabled = false

function readKey(): string | null {
  // Server prefers POSTHOG_API_KEY (server-only secret), then falls back to
  // the public key — useful when both client and server publish into the
  // same project and the user only wires one variable.
  return process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? null
}

function readHost(): string {
  return (
    process.env.POSTHOG_HOST ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    'https://eu.posthog.com'
  )
}

async function getClient(): Promise<PostHogNode | null> {
  if (_disabled) return null
  if (_client) return _client
  const key = readKey()
  if (!key) {
    _disabled = true
    return null
  }
  try {
    const mod = await import('posthog-node')
    _client = new mod.PostHog(key, {
      host: readHost(),
      flushAt: 1, // small backend volumes — flush eagerly
      flushInterval: 1000,
    })
    return _client
  } catch (err) {
    console.warn('[posthog] server init failed', err)
    _disabled = true
    return null
  }
}

export interface ServerCaptureInput {
  event: string
  distinctId: string
  properties?: Record<string, unknown>
  groups?: Record<string, string>
}

/**
 * Send a single event server-side. Failures never throw — analytics must
 * never break a user-facing flow.
 */
export async function captureServer(input: ServerCaptureInput): Promise<void> {
  try {
    const client = await getClient()
    if (!client) return
    client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
      groups: input.groups,
    })
  } catch (err) {
    console.warn('[posthog] server capture failed', input.event, err)
  }
}

/**
 * Flush pending events. Useful in serverless contexts where the worker
 * might shut down before the SDK's interval fires.
 */
export async function flushServer(): Promise<void> {
  try {
    if (!_client) return
    await _client.flush()
  } catch {
    // best-effort
  }
}

/** Test-only reset. */
export function _resetForTests(): void {
  _client = null
  _disabled = false
}
