// ── Store distribué des confirmations en attente (actions vocales Fixy AI) ───
// Sur Cloudflare Workers, chaque isolate a sa propre mémoire : un Map au niveau
// module perd les tokens créés par un autre isolate → le parcours critique
// « commande vocale → action confirmée » échoue par intermittence (audit
// 2026-06-10, Vague 3). Redis Upstash = source de vérité partagée entre
// isolates, avec TTL natif (pas de setInterval — inopérant sur Workers).
// Fallback en mémoire si Redis non configuré (dev local), même pattern que
// lib/rate-limit.ts.

import { Redis } from '@upstash/redis'

export interface PendingConfirmation {
  tool: string
  params: Record<string, unknown>
  artisanId: string
}

const TTL_SECONDS = 5 * 60
const PREFIX = 'fixit:pending-confirm:'

let redis: Redis | null = null
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// ── Fallback mémoire (dev local sans Redis) ──────────────────────────────────
const memStore = new Map<string, PendingConfirmation & { expiresAt: number }>()

function sweepMemStore() {
  if (memStore.size <= 100) return
  const now = Date.now()
  for (const [k, v] of memStore) {
    if (v.expiresAt < now) memStore.delete(k)
  }
}

export async function storePendingConfirmation(token: string, data: PendingConfirmation): Promise<void> {
  if (redis) {
    try {
      await redis.set(PREFIX + token, data, { ex: TTL_SECONDS })
      return
    } catch (e) {
      console.warn('[pending-confirmations] Redis set failed, fallback mémoire:', e)
    }
  }
  sweepMemStore()
  memStore.set(token, { ...data, expiresAt: Date.now() + TTL_SECONDS * 1000 })
}

// Consomme le token de façon ATOMIQUE (GETDEL) : un token ne peut être utilisé
// qu'une seule fois, même en cas de double-clic / requêtes concurrentes.
// Retourne null si inconnu, expiré ou déjà consommé.
export async function consumePendingConfirmation(token: string): Promise<PendingConfirmation | null> {
  if (redis) {
    try {
      const data = await redis.getdel<PendingConfirmation>(PREFIX + token)
      return data ?? null
    } catch (e) {
      console.warn('[pending-confirmations] Redis getdel failed, fallback mémoire:', e)
    }
  }
  const entry = memStore.get(token)
  if (!entry) return null
  memStore.delete(token)
  if (entry.expiresAt < Date.now()) return null
  const { expiresAt: _expiresAt, ...data } = entry
  return data
}
