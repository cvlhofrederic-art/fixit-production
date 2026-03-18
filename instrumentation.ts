// ── Next.js Instrumentation Hook ──────────────────────────────────────────────
// Exécuté une seule fois au démarrage du serveur Next.js.
// https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Valider les variables d'environnement au démarrage
  const { validateEnv } = await import('./lib/env')
  validateEnv()
}
