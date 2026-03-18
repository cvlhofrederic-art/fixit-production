import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'

const startedAt = Date.now()

// GET /api/health — Health check endpoint pour monitoring
export async function GET() {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string | null; missing?: string[] }> = {}

  // Check Supabase connection
  try {
    const start = Date.now()
    const { error } = await supabaseAdmin.from('profiles_artisan').select('id').limit(1)
    const latency = Date.now() - start

    checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency_ms: latency,
      error: error?.message || null,
    }
  } catch (err: unknown) {
    checks.database = { status: 'unhealthy', error: err instanceof Error ? err.message : String(err) }
  }

  // Check env vars critiques (ne pas exposer les noms)
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const missingCount = requiredEnvVars.filter(k => !process.env[k]).length
  checks.environment = {
    status: missingCount === 0 ? 'healthy' : 'unhealthy',
    ...(missingCount > 0 ? { error: `${missingCount} required env var(s) missing` } : {}),
  }

  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy')

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  }, { status: isHealthy ? 200 : 503 })
}
