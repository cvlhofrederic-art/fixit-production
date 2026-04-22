/**
 * Feature flags pour modules dormants (migration Vercel → Cloudflare).
 *
 * Les modules dormants sont gardés via variables d'environnement. La valeur
 * par défaut est `false` — les modules sont désactivés en prod tant que la
 * variable n'est pas explicitement définie à `'true'`.
 *
 * Voir MODULES.md pour la liste complète et les procédures de réactivation.
 */

export const MODULE_SYNDIC_ENABLED =
  process.env.MODULE_SYNDIC_ENABLED === 'true'

export const MODULE_COPRO_ENABLED =
  process.env.MODULE_COPRO_ENABLED === 'true'

export const MODULE_CONCIERGERIE_ENABLED =
  process.env.MODULE_CONCIERGERIE_ENABLED === 'true'

export const MODULE_GESTIONNAIRE_ENABLED =
  process.env.MODULE_GESTIONNAIRE_ENABLED === 'true'

// Variantes publiques (NEXT_PUBLIC_*) — destinées uniquement à masquer des
// liens/tuiles côté client. JAMAIS pour protéger des données : la vérité est
// côté serveur (middleware + dashboards).
export const NEXT_PUBLIC_MODULE_SYNDIC_ENABLED =
  process.env.NEXT_PUBLIC_MODULE_SYNDIC_ENABLED === 'true'

export const NEXT_PUBLIC_MODULE_COPRO_ENABLED =
  process.env.NEXT_PUBLIC_MODULE_COPRO_ENABLED === 'true'

export const NEXT_PUBLIC_MODULE_CONCIERGERIE_ENABLED =
  process.env.NEXT_PUBLIC_MODULE_CONCIERGERIE_ENABLED === 'true'

export const NEXT_PUBLIC_MODULE_GESTIONNAIRE_ENABLED =
  process.env.NEXT_PUBLIC_MODULE_GESTIONNAIRE_ENABLED === 'true'

/**
 * Helper pour les API routes des modules dormants : renvoie une Response 410
 * Gone standardisée indiquant clairement que le module n'est pas disponible.
 */
export function dormantModuleGuard(module: string): Response {
  return new Response(
    JSON.stringify({
      error: 'gone',
      module,
      message: `Le module "${module}" est temporairement désactivé.`,
    }),
    {
      status: 410,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    }
  )
}
