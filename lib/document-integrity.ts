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
 * Référence minimale d'un document signé, pour la sélection du previous_hash.
 * `id` (UUID) sert de tie-break déterministe, aligné sur l'ORDER BY des vues.
 */
export interface SignedRowRef {
  id: string
  signed_at: string | null
  content_hash: string | null
}

/**
 * Surface minimale du client Supabase utilisée par fetchPreviousContentHash.
 * Permet d'injecter un faux builder en test sans mocker tout @supabase/supabase-js.
 */
export interface ChainQueryClient {
  from(table: string): {
    select(cols: string): {
      eq(col: string, val: unknown): {
        not(col: string, op: string, val: unknown): {
          // is() est optionnel : on l'appelle pour deleted_at, mais le fallback
          // (colonne absente) doit pouvoir reconstruire une requête sans is().
          is?(col: string, val: unknown): unknown
          order(col: string, opts: { ascending: boolean }): {
            order(col: string, opts: { ascending: boolean }): {
              limit(n: number): Promise<{ data: SignedRowRef[] | null; error: { message: string } | null }>
            }
          }
        }
      }
    }
  }
}

/**
 * Sélectionne, parmi des documents signés du même artisan, celui qui précède
 * immédiatement le prochain document inséré, EXACTEMENT comme la fenêtre
 * LAG(content_hash) OVER (PARTITION BY artisan ORDER BY signed_at, id) des vues
 * v_devis_chain_check / v_factures_chain_check.
 *
 * Ordre des vues : (signed_at, id) ASC. Le « précédent » d'un futur doc est donc
 * le DERNIER de cet ordre, i.e. le max lexicographique sur (signed_at, id).
 * Pure et exportée pour test unitaire (hardening bug #2).
 */
export function pickLatestSignedRow(rows: SignedRowRef[]): SignedRowRef | null {
  let best: SignedRowRef | null = null
  for (const r of rows) {
    if (best === null) { best = r; continue }
    const sa = r.signed_at ?? ''
    const sb = best.signed_at ?? ''
    if (sa > sb) { best = r; continue }
    if (sa === sb && r.id > best.id) { best = r }
  }
  return best
}

/**
 * Récupère le content_hash du document signé précédent du même artisan, aligné
 * sur les vues d'audit : filtre deleted_at IS NULL + ordre (signed_at, id).
 *
 * Hardening bug #2 :
 *  - AVANT : tri signed_at DESC seul, sans deleted_at IS NULL, sans tie-break id.
 *    → (a) un doc soft-deleté pouvait être chaîné (faux « broken » côté vue),
 *      (b) égalité signed_at à la ms près pouvait diverger de la vue.
 *  - APRÈS : deleted_at IS NULL + order(signed_at desc, id desc) + limit(1)
 *    (== dernière ligne de l'ordre ASC (signed_at, id) de la vue).
 *
 * Fallback défensif (cf. lib/document-sync.ts) : si la colonne deleted_at
 * n'existe pas encore sur l'environnement ciblé, on retente sans ce filtre
 * plutôt que de bloquer l'émission. Les migrations 062 (factures) et 078
 * (devis) l'ajoutent : ce fallback ne sert qu'en defense-in-depth.
 */
export async function fetchPreviousContentHash(
  table: 'devis' | 'factures',
  artisanUserId: string,
  client: ChainQueryClient,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any = client
    .from(table)
    .select('id,content_hash,signed_at')
    .eq('artisan_user_id', artisanUserId)
    .not('signed_at', 'is', null)

  // Requête principale : filtrée deleted_at IS NULL (alignée vue).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withDeletedFilter: any = typeof base.is === 'function' ? base.is('deleted_at', null) : base
  let result = await withDeletedFilter
    .order('signed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)

  // Fallback si la colonne deleted_at est absente sur cet environnement.
  if (result.error && /deleted_at.*does not exist/i.test(result.error.message || '')) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fallback: any = client
      .from(table)
      .select('id,content_hash,signed_at')
      .eq('artisan_user_id', artisanUserId)
      .not('signed_at', 'is', null)
    result = await fallback
      .order('signed_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
  }

  if (result.error) {
    logger.error(`[document-integrity] previous_hash lookup ${table} failed:`, result.error.message)
    throw new Error('Failed to fetch previous document hash')
  }

  const rows = (result.data as SignedRowRef[] | null) || []
  // limit(1) renvoie déjà la bonne ligne quand l'ordre SQL est honoré ; on
  // applique malgré tout pickLatestSignedRow par sécurité (et pour le cas d'un
  // builder de test qui ne trierait pas). Aligne le runtime sur la vue.
  const prev = pickLatestSignedRow(rows)
  return prev && prev.content_hash ? prev.content_hash : null
}

/**
 * Calcule l'ensemble (content_hash, previous_hash, chain_signature, signed_at)
 * pour un document qui passe à status='sent' (devis) ou 'pending' (facture).
 *
 * - previous_hash = content_hash du dernier document signé du même artisan,
 *   sélectionné comme la vue d'audit (deleted_at IS NULL, ordre (signed_at, id)).
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

  // 1. previous_hash = dernier doc signé du même artisan (aligné vue d'audit)
  const previous_hash = await fetchPreviousContentHash(
    table,
    payload.artisan_user_id,
    supabaseAdmin as unknown as ChainQueryClient,
  )

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
