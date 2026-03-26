// ── Validation centralisée des variables d'environnement ──────────────────────
// Fail fast au démarrage si des vars critiques sont manquantes.
// Import ce module dans instrumentation.ts ou au top de layout.tsx (server-side).

const requiredServerVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

// Variables optionnelles — absence = fonctionnalité désactivée, pas d'erreur.
// SENTRY_AUTH_TOKEN est build-only (source maps upload), pas besoin au runtime.
// GOOGLE_CLIENT_ID/SECRET ne sont nécessaires que si OAuth Google est activé.
const optionalServerVars = [
  'GROQ_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_APP_URL',
] as const

// Variables intentionnellement absentes en prod (build-only ou non utilisées)
// Ne pas les logger en warning pour éviter le bruit dans les logs Vercel
const buildOnlyVars = [
  'SENTRY_AUTH_TOKEN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
] as const

let envValidated = false

export function validateEnv() {
  // Ne valider qu'une seule fois, côté serveur, hors build
  if (envValidated) return
  if (typeof window !== 'undefined') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  envValidated = true

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
    console.warn(`[env] Variables optionnelles manquantes: ${warnings.join(', ')}`)
  }

  if (missing.length > 0) {
    const msg = `[env] Variables CRITIQUES manquantes: ${missing.join(', ')}`
    console.error(msg)
    if (process.env.NODE_ENV === 'development' && !process.env.CI) {
      throw new Error(msg)
    }
  }
}
