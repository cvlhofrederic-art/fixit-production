/**
 * Application-level PII encryption using AES-256-GCM (Web Crypto API).
 *
 * Why not pgcrypto? The encryption key needs to live in app-runtime
 * secrets, not in DB metadata. pgcrypto's pgp_sym_encrypt(text, key)
 * exposes the key any time the SQL function is invoked. AES-GCM via
 * Web Crypto keeps the key off the database.
 *
 * Format on the wire (base64-encoded):
 *
 *   nonce(12 bytes) | ciphertext(N bytes) | auth_tag(16 bytes)
 *
 * The auth tag is appended automatically by Web Crypto's GCM encrypt;
 * it travels at the end of the ciphertext buffer, so we just store
 * `nonce || gcmOutput` and let decrypt strip the tag.
 *
 * Key management:
 *   PII_ENCRYPTION_KEY = base64(32 random bytes)
 *   wrangler secret put PII_ENCRYPTION_KEY
 *
 * Rotation strategy: each row carries `pii_encryption_version`. When
 * we rotate, write `_v{n+1}` columns and migrate old rows in a cron.
 * For now version is implicitly 1 across all rows.
 */

const NONCE_BYTES = 12
const KEY_BYTES = 32

let _cachedKey: CryptoKey | null = null

function decodeBase64(input: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(input)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  // Node fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return new Uint8Array(Buffer.from(input, 'base64'))
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  }
  return Buffer.from(bytes).toString('base64')
}

async function loadKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey
  const raw = process.env.PII_ENCRYPTION_KEY
  if (!raw) throw new Error('PII_ENCRYPTION_KEY env var is required for PII crypto')
  const keyBytes = decodeBase64(raw)
  if (keyBytes.length !== KEY_BYTES) {
    throw new Error(`PII_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${keyBytes.length})`)
  }
  _cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
  return _cachedKey
}

/**
 * Encrypt a string. Returns base64(nonce || ciphertext || tag).
 *
 * Each call uses a fresh random nonce — never reuse a (key, nonce)
 * pair with AES-GCM, even for identical plaintext.
 */
export async function encryptPII(plaintext: string): Promise<string> {
  if (typeof plaintext !== 'string') {
    throw new TypeError('encryptPII expects a string')
  }
  const key = await loadKey()
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const data = new TextEncoder().encode(plaintext)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource },
      key,
      data as BufferSource
    )
  )
  const out = new Uint8Array(NONCE_BYTES + ciphertext.length)
  out.set(nonce, 0)
  out.set(ciphertext, NONCE_BYTES)
  return encodeBase64(out)
}

/**
 * Decrypt a payload produced by encryptPII. Throws on tamper.
 */
export async function decryptPII(payload: string): Promise<string> {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new TypeError('decryptPII expects a non-empty string')
  }
  const key = await loadKey()
  const bytes = decodeBase64(payload)
  if (bytes.length <= NONCE_BYTES) {
    throw new Error('decryptPII: payload too short')
  }
  const nonce = bytes.subarray(0, NONCE_BYTES)
  const ciphertext = bytes.subarray(NONCE_BYTES)
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource },
    key,
    ciphertext as BufferSource
  )
  return new TextDecoder().decode(plain)
}

/** Encrypt arbitrary JSON-serialisable data. */
export async function encryptJSON(value: unknown): Promise<string> {
  return encryptPII(JSON.stringify(value))
}

/** Decrypt JSON produced by encryptJSON. */
export async function decryptJSON<T = unknown>(payload: string): Promise<T> {
  const raw = await decryptPII(payload)
  return JSON.parse(raw) as T
}

/** Test-only escape hatch — drops the cached key so unit tests can
 *  swap PII_ENCRYPTION_KEY between scenarios. */
export function _resetForTests(): void {
  _cachedKey = null
}
