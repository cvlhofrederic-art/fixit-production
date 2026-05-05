// ── Hash chain pour devis/factures (FR-V1) ───────────────────────────────────
// Conformité loi anti-fraude TVA art. 88 LF 2016, condition Inaltérabilité (I)
// d'ISCA : tout document émis reçoit un content_hash + previous_hash + signature
// HMAC qui chaîne les documents par artisan. Toute altération post-émission est
// détectable via la vue v_devis_chain_check / v_factures_chain_check.
//
// Web Crypto API uniquement (compatible Cloudflare Workers).

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

/**
 * Champs du document inclus dans le payload canonique. L'ordre est strict.
 * NE PAS inclure des champs mutables après émission (cancelled_at, paid_at...).
 */
export interface CanonicalDocPayload {
  numero: string
  artisan_user_id: string
  client_name: string
  total_ht_cents: number
  total_tax_cents: number
  total_ttc_cents: number
  items: unknown
  signed_at: string
}

/**
 * Sérialisation déterministe du payload canonique pour hash.
 * Trie les clés alphabétiquement à chaque niveau pour éviter toute variation
 * de représentation entre runs.
 */
export function canonicalize(payload: CanonicalDocPayload): string {
  return stableStringify(payload as unknown as Record<string, unknown>)
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  // NOSONAR typescript:S2871 - localeCompare est volontairement REFUSÉ ici.
  // Un canonical hash doit être strictement byte-deterministic (codepoint UTF-16),
  // indépendant de la locale du runtime. Sinon la chaîne de hash diverge entre
  // serveurs FR/UTF-8, ZH, AR, etc., cassant l'intégrité ISCA (loi anti-fraude TVA).
  const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}'
}

/** SHA-256 hex du payload canonique. */
export async function computeContentHash(payload: CanonicalDocPayload): Promise<string> {
  const data = new TextEncoder().encode(canonicalize(payload))
  const buf = await crypto.subtle.digest('SHA-256', data)
  return bufToHex(buf)
}

/** HMAC-SHA256(secret, content_hash || previous_hash) → hex. */
export async function computeChainSignature(
  contentHash: string,
  previousHash: string | null,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const data = new TextEncoder().encode(contentHash + (previousHash || ''))
  const sig = await crypto.subtle.sign('HMAC', key, data)
  return bufToHex(sig)
}

function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Calcule l'ensemble (content_hash, previous_hash, chain_signature, signed_at)
 * pour un document qui passe à status='sent' (devis) ou 'pending' (facture).
 *
 * - previous_hash = content_hash du dernier document signé du même artisan
 * - signed_at = now()
 *
 * Le secret HMAC est tiré de l'env var DOC_HASH_SECRET. Si absent, lance.
 */
export async function buildHashChainFields(
  table: 'devis' | 'factures',
  payload: CanonicalDocPayload,
): Promise<{
  content_hash: string
  previous_hash: string | null
  chain_signature: string
  signed_at: string
}> {
  const secret = process.env.DOC_HASH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('DOC_HASH_SECRET env var missing or too short (32+ chars required)')
  }

  // 1. previous_hash = dernier doc signé du même artisan
  const { data: prev, error } = await supabaseAdmin
    .from(table)
    .select('content_hash')
    .eq('artisan_user_id', payload.artisan_user_id)
    .not('signed_at', 'is', null)
    .order('signed_at', { ascending: false })
    .limit(1)
  if (error) {
    logger.error(`[document-integrity] previous_hash lookup ${table} failed:`, error.message)
    throw new Error('Failed to fetch previous document hash')
  }
  const previous_hash = prev && prev.length > 0 && prev[0].content_hash ? prev[0].content_hash : null

  // 2. content_hash du payload courant
  const content_hash = await computeContentHash(payload)

  // 3. chain_signature
  const chain_signature = await computeChainSignature(content_hash, previous_hash, secret)

  return { content_hash, previous_hash, chain_signature, signed_at: payload.signed_at }
}

/**
 * Vérifie la chaîne pour un document donné (test/audit).
 * Retourne true si le content_hash recomputed match + signature valide.
 */
export async function verifyDocumentIntegrity(
  payload: CanonicalDocPayload,
  storedContentHash: string,
  storedPreviousHash: string | null,
  storedSignature: string,
): Promise<boolean> {
  const secret = process.env.DOC_HASH_SECRET
  if (!secret) return false

  const expectedHash = await computeContentHash(payload)
  if (expectedHash !== storedContentHash) return false

  const expectedSig = await computeChainSignature(storedContentHash, storedPreviousHash, secret)
  return expectedSig === storedSignature
}
