// ── Next.js Instrumentation Hook ──────────────────────────────────────────────
// Exécuté une seule fois au démarrage du serveur Next.js.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//
// Sentry serveur/edge (@sentry/nextjs v10) : les fichiers sentry.server.config.ts
// et sentry.edge.config.ts ne sont PLUS auto-chargés par le SDK — ils doivent être
// importés ici selon process.env.NEXT_RUNTIME (pattern officiel manual-setup).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
//
// ⚠️ Cloudflare Workers (workerd via OpenNext, nodejs_compat) : l'init Sentry ne
// doit JAMAIS faire crasher le worker → imports dynamiques sous try/catch.
// validateEnv reste hors du try/catch Sentry : son échec doit rester visible.

import type { captureRequestError } from '@sentry/nextjs'

export async function register() {
  // Valider les variables d'environnement au démarrage
  const { validateEnv } = await import('./lib/env')
  validateEnv()

  // Init Sentry serveur/edge — non bloquant si le runtime (workerd) ne supporte
  // pas une API utilisée par le SDK.
  try {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
      await import('./sentry.server.config')
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
      await import('./sentry.edge.config')
    }
  } catch (error) {
    console.warn('[Sentry] Init serveur/edge impossible (non bloquant) :', error)
  }
}

// Capture des erreurs des Server Components / route handlers / middleware.
// Wrapper async (autorisé par Next.js) plutôt que ré-export direct de
// Sentry.captureRequestError : évite un import statique de @sentry/nextjs au
// chargement du module, qui pourrait faire échouer register() (et validateEnv)
// sur workerd si le SDK ne se charge pas.
export const onRequestError = async (
  ...args: Parameters<typeof captureRequestError>
): Promise<void> => {
  try {
    const Sentry = await import('@sentry/nextjs')
    Sentry.captureRequestError(...args)
  } catch (error) {
    console.warn('[Sentry] onRequestError : capture impossible (non bloquant) :', error)
  }
}
