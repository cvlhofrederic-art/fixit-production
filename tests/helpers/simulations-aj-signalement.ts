// tests/helpers/simulations-aj-signalement.ts — simulations communes des routes publiques AJ Signalement
// (adresse proposée, signalements semblables). À utiliser dans une fabrique vi.mock asynchrone, par exemple :
//   vi.mock('@/lib/rate-limit', async () => (await import('../helpers/simulations-aj-signalement')).limiteurParPrefixe(h.etat))
// (vi.mock est remonté en tête de fichier : la fabrique ne lit que l'état créé par vi.hoisted.)

import { vi } from 'vitest'

/** État du limiteur simulé : clés vues, préfixes de clé à refuser (lus à chaque appel, remplaçables entre deux tests). */
export interface EtatLimiteurSimule {
  limites: string[]
  refuser: string[]
}

/** Limiteur de débit : note chaque clé et refuse celles qui commencent par un préfixe de `refuser` ; IP fixe. */
export const limiteurParPrefixe = (etat: EtatLimiteurSimule) => ({
  checkRateLimit: vi.fn(async (cle: string) => {
    etat.limites.push(cle)
    return !etat.refuser.some((prefixe) => cle.startsWith(prefixe))
  }),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
})

/** Client Supabase du serveur : chaque table passe par le petit moteur du test. */
export const supabaseAdminSimule = (from: (table: string) => unknown) => ({ supabaseAdmin: { from: (table: string) => from(table) } })

/** Aucune session côté serveur (formulaire public, personne n'est connecté). */
export const sessionServeurAnonyme = () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } })),
})

/** Aucun utilisateur authentifié. */
export const authAnonyme = () => ({ getAuthUser: vi.fn(async () => null) })
