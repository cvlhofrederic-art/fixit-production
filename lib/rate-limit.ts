// ── Rate Limiting avec Upstash Redis ──────────────────────────────────────────
// Utilise @upstash/ratelimit pour un rate limiting distribué et persistant.
// Fallback automatique vers un rate limiter en mémoire si les env vars ne sont
// pas configurées (dev local sans Redis).

import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// ── Upstash Redis rate limiter (production) ──────────────────────────────────
let ratelimit: Ratelimit | null = null

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  ratelimit = new Ratelimit({
    redis,
    // Sliding window : 20 requêtes par fenêtre de 60 secondes
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    analytics: true,
    prefix: 'fixit:ratelimit',
  })
}

// ── Fallback en mémoire (dev local) ──────────────────────────────────────────
interface RateLimitEntry {
  count: number
  reset: number
}

const requestCounts = new Map<string, RateLimitEntry>()

// Nettoyer les entrées expirées toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of requestCounts.entries()) {
      if (now > entry.reset) requestCounts.delete(key)
    }
  }, 5 * 60 * 1000)
}

function checkRateLimitInMemory(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = requestCounts.get(identifier) || { count: 0, reset: now + windowMs }

  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + windowMs
  }

  entry.count++
  requestCounts.set(identifier, entry)
  return entry.count <= limit
}

// ── API publique ─────────────────────────────────────────────────────────────

/**
 * Vérifie si la requête dépasse la limite.
 * Utilise Upstash Redis si configuré, sinon fallback en mémoire.
 *
 * @param identifier - Clé unique (ex: `upload_${ip}`, `api_${userId}`)
 * @param limit - Nombre max de requêtes dans la fenêtre (défaut: 20)
 * @param windowMs - Fenêtre de temps en ms (défaut: 60 000 = 1 min)
 * @returns true si autorisé, false si rate limité
 */
export async function checkRateLimitAsync(
  identifier: string,
  limit = 20,
  windowMs = 60_000,
): Promise<boolean> {
  if (ratelimit) {
    const { success } = await ratelimit.limit(identifier)
    return success
  }
  return checkRateLimitInMemory(identifier, limit, windowMs)
}

/**
 * Version synchrone (fallback uniquement — pour rétro-compatibilité).
 * En production avec Upstash, préférer checkRateLimitAsync().
 * Cette fonction utilise toujours le rate limiter en mémoire pour
 * maintenir la compatibilité avec le code existant qui appelle checkRateLimit()
 * de manière synchrone. Le rate limiting Redis est appliqué en complément
 * dans les routes qui utilisent checkRateLimitAsync().
 */
export function checkRateLimit(identifier: string, limit = 20, windowMs = 60_000): boolean {
  return checkRateLimitInMemory(identifier, limit, windowMs)
}

/**
 * Extrait l'IP de la requête Next.js
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

/**
 * Response 429 standardisée
 */
export function rateLimitResponse() {
  return new Response(JSON.stringify({ error: 'Too many requests. Please wait before retrying.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': '60',
    },
  })
}
