// ── App Cache Layer — Upstash Redis ──────────────────────────────────────────
// Cache applicatif pour réduire les requêtes DB sur les données fréquemment lues.
// Fallback transparent en mémoire si Redis non configuré (dev local).

import { Redis } from '@upstash/redis'

// ── Redis client (réutilise les mêmes env vars que rate-limit) ───────────────
let redis: Redis | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

// ── Fallback en mémoire ──────────────────────────────────────────────────────
const memCache = new Map<string, { value: unknown; expiresAt: number }>()
const MEM_CACHE_MAX = 500

function memGet<T>(key: string): T | null {
  const entry = memCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key)
    return null
  }
  return entry.value as T
}

function memSet(key: string, value: unknown, ttlSeconds: number) {
  if (memCache.size >= MEM_CACHE_MAX) {
    const firstKey = memCache.keys().next().value
    if (firstKey) memCache.delete(firstKey)
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 })
}

function memDel(key: string) {
  memCache.delete(key)
}

// ── API publique ─────────────────────────────────────────────────────────────

const PREFIX = 'fixit:cache:'

/**
 * Récupère une valeur du cache.
 * @returns La valeur cachée ou null si absente/expirée.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const prefixed = PREFIX + key
  if (redis) {
    try {
      const value = await redis.get<T>(prefixed)
      return value ?? null
    } catch {
      return memGet<T>(prefixed)
    }
  }
  return memGet<T>(prefixed)
}

/**
 * Stocke une valeur dans le cache avec un TTL en secondes.
 * @param ttl - Durée de vie en secondes (défaut: 300 = 5 min)
 */
export async function cacheSet<T>(key: string, value: T, ttl = 300): Promise<void> {
  const prefixed = PREFIX + key
  if (redis) {
    try {
      await redis.set(prefixed, value, { ex: ttl })
      return
    } catch {
      memSet(prefixed, value, ttl)
      return
    }
  }
  memSet(prefixed, value, ttl)
}

/**
 * Supprime une entrée du cache (invalidation).
 */
export async function cacheDel(key: string): Promise<void> {
  const prefixed = PREFIX + key
  if (redis) {
    try {
      await redis.del(prefixed)
    } catch {
      // ignore
    }
  }
  memDel(prefixed)
}

/**
 * Supprime toutes les entrées matchant un pattern (ex: "artisan:*").
 * Utile pour invalider un groupe de clés après une mise à jour.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<void> {
  const prefixed = PREFIX + pattern
  if (redis) {
    try {
      const keys = await redis.keys(prefixed)
      if (keys.length > 0) {
        await Promise.all(keys.map(k => redis!.del(k)))
      }
    } catch {
      // ignore
    }
  }
  // In-memory fallback
  const prefix = PREFIX + pattern.replace('*', '')
  for (const k of memCache.keys()) {
    if (k.startsWith(prefix)) memCache.delete(k)
  }
}

/**
 * Cache-through helper : lit du cache, sinon exécute la fonction et cache le résultat.
 *
 * @example
 * const artisan = await cacheable('artisan:abc123', () => fetchArtisan('abc123'), 600)
 */
export async function cacheable<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = 300,
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached

  const value = await fn()
  if (value !== null && value !== undefined) {
    await cacheSet(key, value, ttl)
  }
  return value
}
