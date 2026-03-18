// ── Validation centralisée des variables d'environnement ──────────────────────
// Fail fast au démarrage si des vars critiques sont manquantes.
// Import ce module dans instrumentation.ts ou au top de layout.tsx (server-side).

const requiredServerVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

const optionalServerVars = [
  'GROQ_API_KEY',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SENTRY_AUTH_TOKEN',
  'NEXT_PUBLIC_APP_URL',
] as const

export function validateEnv() {
  // Ne valider que côté serveur (pas pendant le build où les vars peuvent manquer)
  if (typeof window !== 'undefined') return // skip client-side
  if (process.env.NEXT_PHASE === 'phase-production-build') return // skip build

  const missing: string[] = []
  const warnings: string[] = []

  for (const key of requiredServerVars) {
    const val = process.env[key]
    if (!val || val.includes('placeholder')) {
      missing.push(key)
    }
  }

  for (const key of optionalServerVars) {
    if (!process.env[key]) {
      warnings.push(key)
    }
  }

  if (warnings.length > 0) {
    console.warn(`[env] Variables optionnelles manquantes (certaines fonctionnalités seront désactivées): ${warnings.join(', ')}`)
  }

  if (missing.length > 0) {
    const msg = `[env] Variables d'environnement CRITIQUES manquantes:\n  ${missing.join('\n  ')}\n\nL'application ne peut pas fonctionner sans ces variables.`
    console.error(msg)
    // En production, log l'erreur mais ne crash pas (Vercel a ses propres checks)
    // En dev, throw pour fail fast
    if (process.env.NODE_ENV === 'development') {
      throw new Error(msg)
    }
  }
}
