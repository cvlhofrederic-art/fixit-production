import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const startedAt = Date.now()

// GET /api/health — Health check endpoint pour monitoring
export async function GET() {
  const checks: Record<string, any> = {}

  // Check Supabase connection
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const start = Date.now()
    const { error } = await supabase.from('profiles_artisan').select('id').limit(1)
    const latency = Date.now() - start

    checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency_ms: latency,
      error: error?.message || null,
    }
  } catch (err: any) {
    checks.database = { status: 'unhealthy', error: err.message }
  }

  // Check env vars critiques
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ]
  const missingEnv = requiredEnvVars.filter(k => !process.env[k])
  checks.environment = {
    status: missingEnv.length === 0 ? 'healthy' : 'unhealthy',
    missing: missingEnv.length > 0 ? missingEnv : undefined,
  }

  const isHealthy = Object.values(checks).every((c: any) => c.status === 'healthy')

  return NextResponse.json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  }, { status: isHealthy ? 200 : 503 })
}
