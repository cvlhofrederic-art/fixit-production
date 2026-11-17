// tests/lib/rate-limit-empreinte.test.ts
//
// D13 (décision de Hugo du 17/11/2026, point 4) : lib/rate-limit.ts n'envoie plus à Upstash l'identifiant en clair
// (adresse IP, identifiant de compte) mais son empreinte ; l'option « analytics » d'Upstash est coupée.
//   - empreinte : HMAC-SHA-256 de l'identifiant, clé dérivée par HKDF-SHA-256 (sel « vitfix », info
//     « rate-limit-empreinte-v1 ») de SUPABASE_SERVICE_ROLE_KEY ; secret absent ou valeur de build : SHA-256 salé ;
//   - même identifiant → même clé : les limites ne changent pas, seul le format de la clé change ;
//   - Upstash en panne : repli en mémoire, comme avant.
// Upstash simulé (aucun appel réseau). Adresses IP de documentation (RFC 5737), secrets de test.

import { createHash, createHmac, hkdfSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const IP = '203.0.113.7'
const IDENTIFIANT = `qr_signalement_post_${IP}`
// Secrets de test à faible entropie, construits à l'exécution : Gitleaks ne les prend pas pour de vraies clés.
const SECRET = 'a'.repeat(40)
const AUTRE_SECRET = 'b'.repeat(40)

const clesEnvoyees: string[] = []
const optionsLimiteurs: Array<Record<string, unknown>> = []
let upstashEnPanne = false

beforeEach(() => {
  vi.resetModules()
  clesEnvoyees.length = 0
  optionsLimiteurs.length = 0
  upstashEnPanne = false
  vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.exemple.test')
  vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'jeton-de-test')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SECRET)
  vi.doMock('@upstash/redis', () => ({ Redis: class {} }))
  vi.doMock('@upstash/ratelimit', () => {
    class Ratelimit {
      static slidingWindow = (limite: number, fenetre: string) => ({ limite, fenetre })
      constructor(options: Record<string, unknown>) { optionsLimiteurs.push(options) }
      async limit(cle: string) {
        if (upstashEnPanne) throw new Error('Upstash indisponible')
        clesEnvoyees.push(cle)
        return { success: true }
      }
    }
    return { Ratelimit }
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.doUnmock('@upstash/redis')
  vi.doUnmock('@upstash/ratelimit')
})

const charger = async () => (await import('@/lib/rate-limit')).checkRateLimit

/** Empreinte attendue, recalculée ici avec node:crypto (HKDF puis HMAC), indépendamment de Web Crypto. */
const hmacAttendu = (secret: string, identifiant: string) => {
  const cle = Buffer.from(hkdfSync('sha256', secret, 'vitfix', 'rate-limit-empreinte-v1', 32))
  return createHmac('sha256', cle).update(identifiant).digest('hex')
}

describe('empreinte de l’identifiant envoyée à Upstash', () => {
  it('Upstash reçoit 64 hexadécimaux, jamais l’adresse IP ni l’identifiant en clair', async () => {
    const checkRateLimit = await charger()
    expect(await checkRateLimit(IDENTIFIANT, 5, 60_000)).toBe(true)
    expect(clesEnvoyees).toHaveLength(1)
    expect(clesEnvoyees[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(clesEnvoyees[0]).not.toContain(IP)
    expect(clesEnvoyees[0]).not.toContain('qr_signalement')
  })

  it('HMAC-SHA-256 sous une clé dérivée (HKDF) du secret serveur', async () => {
    const checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    expect(clesEnvoyees[0]).toBe(hmacAttendu(SECRET, IDENTIFIANT))
    // Jamais le SHA-256 nu de l'identifiant (une IPv4 n'a que 2^32 valeurs : il se renverserait).
    expect(clesEnvoyees[0]).not.toBe(createHash('sha256').update(IDENTIFIANT).digest('hex'))
  })

  it('même identifiant → même clé (limites inchangées) ; identifiants différents → clés différentes', async () => {
    const checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    await checkRateLimit('qr_signalement_post_198.51.100.4', 5, 60_000)
    expect(clesEnvoyees[0]).toBe(clesEnvoyees[1])
    expect(clesEnvoyees[2]).not.toBe(clesEnvoyees[0])
  })

  it('un autre secret donne une autre clé', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', AUTRE_SECRET)
    const checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    expect(clesEnvoyees[0]).toBe(hmacAttendu(AUTRE_SECRET, IDENTIFIANT))
    expect(clesEnvoyees[0]).not.toBe(hmacAttendu(SECRET, IDENTIFIANT))
  })

  it('secret absent ou valeur de build : SHA-256 salé, déterministe, jamais l’identifiant ni son SHA-256 nu', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    let checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    vi.resetModules()
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'placeholder-key-for-build')
    checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    expect(clesEnvoyees[0]).toMatch(/^[0-9a-f]{64}$/)
    expect(clesEnvoyees[0]).not.toContain(IP)
    expect(clesEnvoyees[0]).not.toBe(createHash('sha256').update(IDENTIFIANT).digest('hex'))
    expect(clesEnvoyees[0]).not.toBe(hmacAttendu(SECRET, IDENTIFIANT))
    expect(clesEnvoyees[1]).toBe(clesEnvoyees[0])
    expect(clesEnvoyees[2]).toBe(clesEnvoyees[0])
  })
})

describe('limiteurs Upstash', () => {
  it('option analytics coupée ; préfixe et fenêtre inchangés', async () => {
    const checkRateLimit = await charger()
    await checkRateLimit(IDENTIFIANT, 5, 60_000)
    expect(optionsLimiteurs).toHaveLength(1)
    expect(optionsLimiteurs[0].analytics).toBe(false)
    expect(optionsLimiteurs[0].prefix).toBe('fixit:ratelimit:60s:5')
    expect(optionsLimiteurs[0].limiter).toEqual({ limite: 5, fenetre: '60 s' })
  })

  it('Upstash en panne : repli en mémoire, limite toujours appliquée', async () => {
    upstashEnPanne = true
    const checkRateLimit = await charger()
    for (let i = 0; i < 3; i++) expect(await checkRateLimit(IDENTIFIANT, 3, 60_000)).toBe(true)
    expect(await checkRateLimit(IDENTIFIANT, 3, 60_000)).toBe(false)
  })
})
