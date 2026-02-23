// ── Rate Limiting en mémoire (suffisant pour MVP) ────────────────────────────
// Pour production à grande échelle : remplacer par Upstash Redis

import type { NextRequest } from 'next/server'

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

/**
 * Vérifie si la requête dépasse la limite
 * @param identifier - IP ou user_id
 * @param limit - Nombre max de requêtes dans la fenêtre
 * @param windowMs - Fenêtre de temps en ms (défaut: 1 minute)
 * @returns true si autorisé, false si rate limité
 */
export function checkRateLimit(identifier: string, limit = 20, windowMs = 60_000): boolean {
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
