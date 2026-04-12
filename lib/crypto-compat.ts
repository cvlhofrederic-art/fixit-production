// ── Web Crypto compatible helpers ────────────────────────────────────────────
// Replaces Node.js `crypto` module for Cloudflare Workers compatibility.
// Uses globalThis.crypto (available in Workers, Edge, and Node.js 19+).

/**
 * Generate a hex string of random bytes using Web Crypto API.
 * Drop-in replacement for `crypto.randomBytes(n).toString('hex')`.
 */
export function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

// ── RSA-SHA1 signing for Portugal fiscal compliance ─────────────────────────
// Replaces Node.js `crypto.createSign('SHA1')` / `crypto.createVerify('SHA1')`

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

const RSA_SHA1_PARAMS = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' } as const

/**
 * RSA-SHA1 sign data and return Base64 string.
 * Drop-in async replacement for Node.js crypto.createSign('SHA1').
 */
export async function rsaSha1Sign(data: string, privateKeyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    RSA_SHA1_PARAMS,
    false,
    ['sign'],
  )
  const encoded = new TextEncoder().encode(data)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoded)
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

/**
 * RSA-SHA1 verify a Base64 signature.
 * Drop-in async replacement for Node.js crypto.createVerify('SHA1').
 */
export async function rsaSha1Verify(data: string, signatureB64: string, publicKeyPem: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'spki',
    pemToArrayBuffer(publicKeyPem),
    RSA_SHA1_PARAMS,
    false,
    ['verify'],
  )
  const encoded = new TextEncoder().encode(data)
  const sigBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0))
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sigBytes, encoded)
}
