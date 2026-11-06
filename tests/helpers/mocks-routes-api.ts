// tests/helpers/mocks-routes-api.ts — simulations communes des modules appelés par les routes API.
// À utiliser dans une fabrique vi.mock asynchrone, par exemple :
//   vi.mock('@/lib/rate-limit', async () => (await import('../helpers/mocks-routes-api')).rateLimitPermissif())
// (vi.mock est remonté en tête de fichier : la fabrique ne peut pas lire une variable du module de test.)

import { vi } from 'vitest'

/** Limite de débit toujours franchie : IP fixe, aucune réponse 429. */
export const rateLimitPermissif = () => ({
  checkRateLimit: vi.fn(async () => true),
  getClientIP: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => Response.json({ error: 'rate' }, { status: 429 })),
})

/** Journal muet : les appels restent observables par les espions. */
export const loggerSilencieux = () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } })
