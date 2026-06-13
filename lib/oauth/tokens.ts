// ── Tokens OAuth chiffrés CÔTÉ APPLICATION (AES-256-GCM, Web Crypto) ─────────
//
// Refonte audit P2 (TSQ-02/FNC-02) : l'ancien flux RPC set_config +
// get/set_encrypted_oauth_token était STRUCTURELLEMENT mort en prod —
// PostgREST n'expose pas pg_catalog.set_config, et le GUC transaction-local
// ne survit de toute façon pas entre deux .rpc() (1 transaction par requête
// PostgREST). Les fonctions DB référençaient en plus t.token_expiry,
// colonne inexistante en live. 0 token n'a jamais été persisté par ce chemin.
//
// Nouveau flux : chiffrement applicatif via globalThis.crypto.subtle
// (disponible sous workerd/Cloudflare Workers ET Node ≥ 20) :
//   - AES-256-GCM, clé = SHA-256(OAUTH_TOKENS_ENCRYPTION_KEY) (≥ 32 chars)
//   - IV aléatoire de 12 octets, préfixé au ciphertext, le tout en base64
//   - stockage dans access_token_enc / refresh_token_enc,
//     encryption_version = 2
//
// ⚠️ Compat lecture BYTEA (OAUT-1) : access_token_enc / refresh_token_enc ont
// été créées en BYTEA par 20260512_encrypt_oauth_tokens.sql. L'écriture d'une
// chaîne base64 dans un bytea passe, mais PostgREST RELIT un bytea au format
// hex Postgres ('\x6261…'). normalizeStoredPayload() décode ce format avant
// déchiffrement. La migration 20260612000008_oauth_cleanup.sql convertit les
// colonnes en text (convert_from UTF8) — le helper devient alors un no-op.
//
// ⚠️ Colonnes legacy de syndic_oauth_tokens — ni lues ni écrites ici, et
// PURGÉES par 20260612000008_oauth_cleanup.sql (0 ligne en prod, audit
// 2026-06-12) :
//   - access_token / refresh_token (clair, legacy)
//   - access_token_encrypted / refresh_token_encrypted (pgcrypto v1, mort-né)
// Les fonctions DB get/set_encrypted_oauth_token (mortes) sont droppées par la
// même migration.
//
// Une ligne avec encryption_version null/1 (ou colonnes *_enc vides) est
// considérée SANS token : re-connexion OAuth requise (logger.warn explicite).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database-types'
import { logger } from '@/lib/logger'

type TokensClient = SupabaseClient<Database>

// Version 2 = chiffrement applicatif AES-256-GCM (v1 = RPC pgcrypto, morte).
export const ENCRYPTION_VERSION = 2

const IV_LENGTH = 12 // octets — taille standard GCM

export interface DecryptedToken {
  access_token: string
  refresh_token: string
  expires_at: string | null
}

export interface SetTokenParams {
  syndic_id: string
  access_token: string
  refresh_token: string
  expires_at: string
  provider?: string
}

export function getEncryptionKey(): string {
  const key = process.env.OAUTH_TOKENS_ENCRYPTION_KEY
  if (!key) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY is not set')
  }
  if (key.length < 32) {
    throw new Error('OAUTH_TOKENS_ENCRYPTION_KEY must be at least 32 chars')
  }
  return key
}

// Dérive (et met en cache) la CryptoKey AES-256 depuis la clé d'env.
// SHA-256 de la passphrase → 32 octets exactement, déterministe.
const keyCache = new Map<string, Promise<CryptoKey>>()

function deriveAesKey(): Promise<CryptoKey> {
  const passphrase = getEncryptionKey()
  let cached = keyCache.get(passphrase)
  if (!cached) {
    cached = (async () => {
      const digest = await globalThis.crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(passphrase),
      )
      return globalThis.crypto.subtle.importKey(
        'raw',
        digest,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
    keyCache.set(passphrase, cached)
  }
  return cached
}

// Chiffre un token : base64(IV 12 octets ‖ ciphertext+tag GCM).
export async function encryptToken(plaintext: string): Promise<string> {
  const key = await deriveAesKey()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const payload = new Uint8Array(IV_LENGTH + ciphertext.byteLength)
  payload.set(iv, 0)
  payload.set(new Uint8Array(ciphertext), IV_LENGTH)
  return Buffer.from(payload).toString('base64')
}

// ── Compat lecture BYTEA (OAUT-1) ─────────────────────────────────────────────
// Tant que les colonnes *_enc sont en BYTEA en live (état créé par 20260512,
// corrigé par 20260612000008), PostgREST sérialise leur contenu au format hex
// Postgres : la chaîne base64 'YWJj…' écrite par setEncryptedToken est relue
// '\x59574a6a…'. Ce helper détecte le préfixe '\x' et décode l'hex vers UTF-8
// pour retrouver la chaîne base64 d'origine. Sur une colonne text (état
// cible), la valeur ne commence jamais par '\x' (base64 = [A-Za-z0-9+/=]) :
// le helper rend la valeur inchangée. Un hex corrompu produit un base64
// invalide → decryptToken throw → null + warn (chemin déjà couvert).
export function normalizeStoredPayload(value: string): string {
  if (!value.startsWith('\\x')) return value
  return Buffer.from(value.slice(2), 'hex').toString('utf8')
}

// Déchiffre un payload produit par encryptToken. Throw si payload invalide,
// clé différente ou données corrompues (tag GCM non vérifiable).
export async function decryptToken(payload: string): Promise<string> {
  const key = await deriveAesKey()
  const bytes = Buffer.from(payload, 'base64')
  if (bytes.length <= IV_LENGTH) {
    throw new Error('decryptToken: payload trop court (IV manquant)')
  }
  const iv = bytes.subarray(0, IV_LENGTH)
  const ciphertext = bytes.subarray(IV_LENGTH)
  const plaintext = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )
  return new TextDecoder().decode(plaintext)
}

// Upsert des tokens chiffrés (colonnes *_enc uniquement, version 2).
export async function setEncryptedToken(
  client: TokensClient,
  params: SetTokenParams,
): Promise<void> {
  const [accessEnc, refreshEnc] = await Promise.all([
    encryptToken(params.access_token),
    encryptToken(params.refresh_token),
  ])
  const { error } = await client
    .from('syndic_oauth_tokens')
    .upsert(
      {
        syndic_id: params.syndic_id,
        provider: params.provider ?? 'gmail',
        access_token_enc: accessEnc,
        refresh_token_enc: refreshEnc,
        expires_at: params.expires_at,
        encryption_version: ENCRYPTION_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'syndic_id' },
    )
  if (error) {
    throw new Error(`setEncryptedToken failed: ${error.message}`)
  }
}

// Lit et déchiffre les tokens d'un syndic.
// - Erreur DB → throw (l'appelant doit compter l'échec, pas répondre à vide).
// - Aucune ligne → null.
// - Ligne legacy (encryption_version ≠ 2 ou colonnes *_enc vides) ou payload
//   indéchiffrable → null + logger.warn : re-connexion OAuth requise.
export async function getDecryptedToken(
  client: TokensClient,
  syndicId: string,
): Promise<DecryptedToken | null> {
  const { data, error } = await client
    .from('syndic_oauth_tokens')
    .select('access_token_enc, refresh_token_enc, expires_at, encryption_version')
    .eq('syndic_id', syndicId)
    .maybeSingle()
  if (error) {
    throw new Error(`getDecryptedToken failed: ${error.message}`)
  }
  if (!data) return null

  if (
    data.encryption_version !== ENCRYPTION_VERSION ||
    !data.access_token_enc ||
    !data.refresh_token_enc
  ) {
    logger.warn(
      '[oauth/tokens] Ligne token legacy ou incomplète — re-connexion OAuth requise',
      { syndic_id: syndicId, encryption_version: data.encryption_version ?? null },
    )
    return null
  }

  try {
    const [accessToken, refreshToken] = await Promise.all([
      decryptToken(normalizeStoredPayload(data.access_token_enc)),
      decryptToken(normalizeStoredPayload(data.refresh_token_enc)),
    ])
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: data.expires_at,
    }
  } catch (err: unknown) {
    logger.warn(
      '[oauth/tokens] Déchiffrement impossible (clé changée ou données corrompues) — re-connexion OAuth requise',
      {
        syndic_id: syndicId,
        error: err instanceof Error ? err.message : String(err),
      },
    )
    return null
  }
}
