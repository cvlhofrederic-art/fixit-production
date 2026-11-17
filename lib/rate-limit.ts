// ── Rate Limiting avec Upstash Redis ──────────────────────────────────────────
// Utilise @upstash/ratelimit pour un rate limiting distribué et persistant.
// Fallback automatique vers un rate limiter en mémoire si les env vars ne sont
// pas configurées (dev local sans Redis).
//
// D13 (décision de Hugo du 17/11/2026, au nom de VitFix, point 4) : Upstash ne reçoit plus l'identifiant en clair
// (adresse IP, identifiant de compte…), seulement son EMPREINTE (empreinteIdentifiant ci-dessous), et l'option
// « analytics » d'Upstash est coupée (elle gardait chaque identifiant dans des ensembles `<préfixe>:events:<heure>`).
// Pour toutes les routes, une seule chose change : le format de la clé chez Upstash. Même identifiant → même empreinte :
// limites, fenêtres, préfixes et repli en mémoire sont inchangés ; les compteurs repartent de zéro au déploiement.
// Les relevés déjà écrits chez Upstash ne sont pas effacés par ce code (action à mener dans la console d'Upstash).

import type { NextRequest } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

// ── Empreinte de l'identifiant (D13) ─────────────────────────────────────────
// HMAC-SHA-256 de l'identifiant, sous une clé dérivée par HKDF-SHA-256 (sel « vitfix », info « rate-limit-empreinte-v1 »)
// de SUPABASE_SERVICE_ROLE_KEY : secret serveur déjà présent dans le Worker, sur le modèle de lib/equipe/lien-invitation.ts
// (aucun nouveau secret à poser ; la dérivation sépare les usages, l'empreinte ne révèle rien du secret). Pourquoi pas un
// simple SHA-256 salé : une IPv4 n'a que 2^32 valeurs, et un sel écrit dans ce dépôt public ne protège rien ; l'empreinte
// se retrouverait en quelques minutes. Sans la clé, l'empreinte HMAC ne se renverse pas.
// Secret absent ou valeur de build alors qu'Upstash est configuré (Worker mal configuré, secret renommé) : RIEN n'est
// envoyé à Upstash, les limites restent en mémoire, et une erreur part au journal une fois par isolat, sans l'identifiant
// (relecture du 17/11/2026 ; même règle que lib/equipe/lien-invitation.ts, qui refuse de signer sans ce secret).
// Changer le secret change les clés : les compteurs repartent de zéro, sans autre effet.

const ENCODEUR = new TextEncoder()
const VALEUR_DE_BUILD = 'placeholder-key-for-build'

/** Secret de l'empreinte, ou null (absent, ou valeur de build). */
function secretEmpreinte(): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  return secret && secret !== VALEUR_DE_BUILD ? secret : null
}

/** L'erreur « Upstash sans secret » n'est écrite qu'une fois par isolat. */
let secretAbsentSignale = false

let cleEmpreinteEnCache: { secret: string; cle: Promise<CryptoKey> } | null = null

function cleEmpreinte(secret: string): Promise<CryptoKey> {
  if (cleEmpreinteEnCache?.secret !== secret) {
    const cle = crypto.subtle
      .importKey('raw', ENCODEUR.encode(secret), 'HKDF', false, ['deriveKey'])
      .then((base) => crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: ENCODEUR.encode('vitfix'), info: ENCODEUR.encode('rate-limit-empreinte-v1') },
        base,
        { name: 'HMAC', hash: 'SHA-256', length: 256 },
        false,
        ['sign'],
      ))
    // Une dérivation échouée n'est pas gardée : l'appel suivant la retente.
    cle.catch(() => { if (cleEmpreinteEnCache?.cle === cle) cleEmpreinteEnCache = null })
    cleEmpreinteEnCache = { secret, cle }
  }
  return cleEmpreinteEnCache.cle
}

const enHex = (octets: ArrayBuffer): string => Array.from(new Uint8Array(octets), (o) => o.toString(16).padStart(2, '0')).join('')

/** Empreinte HMAC (64 hexadécimaux) de l'identifiant, seule forme envoyée à Upstash. */
async function empreinteIdentifiant(identifier: string, secret: string): Promise<string> {
  return enHex(await crypto.subtle.sign('HMAC', await cleEmpreinte(secret), ENCODEUR.encode(identifier)))
}

// ── Upstash Redis rate limiter (production) ──────────────────────────────────
// FR-V8 fix audit : un Ratelimit Upstash est instancié PAR couple (limit,
// windowMs) car la lib ne supporte pas le paramétrage per-call. Avant ce fix,
// /api/document-cancel (limit=10) était traité comme 20/min (le défaut global)
// et /api/devis/sync (limit=60) était capé à 20/min — bug bidirectionnel.
let redis: Redis | null = null
const limiters = new Map<string, Ratelimit>()

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (!redis) return null
  const windowSec = Math.max(1, Math.round(windowMs / 1000))
  const key = `${limit}:${windowSec}`
  const cached = limiters.get(key)
  if (cached) return cached
  const lim = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
    // D13 : coupé. Activé, il enregistrait chaque identifiant (adresse IP comprise) dans les relevés d'Upstash.
    analytics: false,
    prefix: `fixit:ratelimit:${windowSec}s:${limit}`,
  })
  limiters.set(key, lim)
  return lim
}

// ── Fallback en mémoire (dev local) ──────────────────────────────────────────
interface RateLimitEntry {
  count: number
  reset: number
}

const requestCounts = new Map<string, RateLimitEntry>()
const MAX_MAP_SIZE = 10_000 // Limite mémoire : max 10k entrées (évite fuite mémoire sur Workers)

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
 * Upstash ne reçoit que l'empreinte de l'identifiant (D13) ; le repli en mémoire garde l'identifiant, qui ne quitte
 * pas l'isolat.
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
  const lim = getLimiter(limit, windowMs)
  if (lim) {
    const secret = secretEmpreinte()
    if (!secret) {
      // D13 : sans le secret, l'empreinte se renverserait. Rien ne part à Upstash ; limites en mémoire.
      if (!secretAbsentSignale) {
        secretAbsentSignale = true
        logger.error('[rate-limit] Upstash configuré sans SUPABASE_SERVICE_ROLE_KEY : rien n’est envoyé à Upstash, limites en mémoire seulement')
      }
      return checkRateLimitInMemory(identifier, limit, windowMs)
    }
    try {
      const { success } = await lim.limit(await empreinteIdentifiant(identifier, secret))
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
  // Cloudflare-first, then generic forwarded headers
  return (
    request.headers.get('cf-connecting-ip') ||
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
