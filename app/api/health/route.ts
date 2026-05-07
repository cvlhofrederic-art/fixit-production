import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getCircuitState } from '@/lib/circuit-breaker'

/**
 * GET /api/health
 *
 * Three-tier reporting:
 *   - HTTP 200 + status='healthy' when every check is healthy.
 *   - HTTP 207 + status='degraded' when at least one check warns but
 *     no critical dependency is down.
 *   - HTTP 503 + status='unhealthy' when a critical dependency
 *     (database, env vars) is down.
 *
 * External dependencies (Stripe, Groq circuit, Upstash Redis) are
 * surfaced as warnings rather than 503 — losing them shouldn't fail
 * a health probe, the user-facing flows have their own circuit breakers
 * and graceful degradation paths.
 */

const startedAt = Date.now()

type CheckStatus = 'healthy' | 'warn' | 'unhealthy' | 'skipped'

interface CheckResult {
  status: CheckStatus
  latency_ms?: number
  error?: string
  meta?: Record<string, unknown>
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    const { error } = await supabaseAdmin.from('profiles_artisan').select('id').limit(1)
    const latency_ms = Date.now() - start
    if (error) return { status: 'unhealthy', latency_ms, error: error.message }
    if (latency_ms > 1500) return { status: 'warn', latency_ms, error: 'slow query > 1.5s' }
    return { status: 'healthy', latency_ms }
  } catch (err) {
    return { status: 'unhealthy', error: err instanceof Error ? err.message : String(err) }
  }
}

function checkEnvironment(): CheckResult {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const missing = required.filter((k) => !process.env[k])
  return missing.length === 0
    ? { status: 'healthy' }
    : { status: 'unhealthy', error: `${missing.length} required env var(s) missing` }
}

async function checkStripe(): Promise<CheckResult> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { status: 'skipped', error: 'STRIPE_SECRET_KEY not configured' }
  }
  const start = Date.now()
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        // tiny timeout via AbortController — Workers respects it
      },
      signal: AbortSignal.timeout(2_500),
    })
    const latency_ms = Date.now() - start
    if (!res.ok) return { status: 'warn', latency_ms, error: `HTTP ${res.status}` }
    return { status: 'healthy', latency_ms }
  } catch (err) {
    return { status: 'warn', error: err instanceof Error ? err.message : String(err) }
  }
}

function checkGroqCircuit(): CheckResult {
  const snap = getCircuitState('groq')
  if (!snap) return { status: 'skipped', meta: { reason: 'never invoked' } }
  if (snap.state === 'OPEN') return { status: 'warn', meta: snap, error: 'circuit OPEN' }
  return { status: 'healthy', meta: snap }
}

async function checkUpstash(): Promise<CheckResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return { status: 'skipped', error: 'Upstash not configured' }
  const start = Date.now()
  try {
    const res = await fetch(`${url}/PING`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2_500),
    })
    const latency_ms = Date.now() - start
    if (!res.ok) return { status: 'warn', latency_ms, error: `HTTP ${res.status}` }
    return { status: 'healthy', latency_ms }
  } catch (err) {
    return { status: 'warn', error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET() {
  const [database, stripe, upstash] = await Promise.all([
    checkDatabase(),
    checkStripe(),
    checkUpstash(),
  ])
  const environment = checkEnvironment()
  const groq = checkGroqCircuit()

  const checks: Record<string, CheckResult> = {
    database,
    environment,
    stripe,
    groq,
    upstash,
  }

  const criticals = ['database', 'environment'] as const
  const anyCriticalDown = criticals.some((k) => checks[k].status === 'unhealthy')
  const anyWarn = Object.values(checks).some((c) => c.status === 'warn' || c.status === 'unhealthy')

  let status: 'healthy' | 'degraded' | 'unhealthy'
  let httpStatus: number
  if (anyCriticalDown) {
    status = 'unhealthy'
    httpStatus = 503
  } else if (anyWarn) {
    status = 'degraded'
    httpStatus = 207
  } else {
    status = 'healthy'
    httpStatus = 200
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version || '0.1.0',
      checks,
    },
    { status: httpStatus }
  )
}
