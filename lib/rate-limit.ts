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
const MAX_MAP_SIZE = 10_000 // Limite mémoire : max 10k entrées (évite fuite mémoire sur Vercel)

// Nettoyer les entrées expirées toutes les 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of requestCounts.entries()) {
      if (now > entry.reset) requestCounts.delete(key)
    }
    // Sécurité anti fuite mémoire : si trop d'entrées, purger les plus anciennes
    if (requestCounts.size > MAX_MAP_SIZE) {
      const entries = Array.from(requestCounts.entries())
        .sort((a, b) => a[1].reset - b[1].reset)
      const toDelete = entries.slice(0, entries.length - MAX_MAP_SIZE / 2)
      toDelete.forEach(([key]) => requestCounts.delete(key))
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
 * Cette fonction est async et doit être appelée avec `await`.
 *
 * @param identifier - Clé unique (ex: `upload_${ip}`, `api_${userId}`)
 * @param limit - Nombre max de requêtes dans la fenêtre (défaut: 20)
 * @param windowMs - Fenêtre de temps en ms (défaut: 60 000 = 1 min)
 * @returns true si autorisé, false si rate limité
 */
export async function checkRateLimit(
  identifier: string,
  limit = 20,
  windowMs = 60_000,
): Promise<boolean> {
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(identifier)
      return success
    } catch (e) {
      // Redis down — fallback to in-memory
      console.warn('[rate-limit] Redis error, falling back to in-memory:', e)
      return checkRateLimitInMemory(identifier, limit, windowMs)
    }
  }
  return checkRateLimitInMemory(identifier, limit, windowMs)
}

/**
 * @deprecated Use checkRateLimit() (now async) instead.
 * Version synchrone — utilise uniquement le rate limiter en mémoire.
 * Gardée pour la transition progressive, mais ne bénéficie pas de Redis.
 */
export function checkRateLimitLocal(identifier: string, limit = 20, windowMs = 60_000): boolean {
  return checkRateLimitInMemory(identifier, limit, windowMs)
}

/**
 * Alias for backward compatibility during migration.
 * @deprecated Use checkRateLimit() (async) instead.
 */
export const checkRateLimitAsync = checkRateLimit

/**
 * Extrait l'IP de la requête Next.js
 */
export function getClientIP(request: NextRequest): string {
  // Cloudflare-first, then Vercel fallback, then generic
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
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
