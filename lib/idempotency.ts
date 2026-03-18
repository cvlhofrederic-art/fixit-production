// ── Idempotency key checking using Supabase ──────────────────────────────────
// Clients send an Idempotency-Key header, server checks if already processed.
// Prevents duplicate write operations (bookings, payments, messages, etc.)
//
// Requires table in Supabase:
// CREATE TABLE IF NOT EXISTS idempotency_keys (
//   key TEXT PRIMARY KEY,
//   response_body JSONB,
//   response_status INTEGER NOT NULL DEFAULT 200,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// -- Auto-cleanup old keys (older than 24h)
// CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

import { supabaseAdmin } from '@/lib/supabase-server'

export async function checkIdempotency(key: string | null): Promise<{ isDuplicate: boolean; cachedResponse?: { response_body: unknown; response_status: number } }> {
  if (!key) return { isDuplicate: false }

  try {
    const { data } = await supabaseAdmin
      .from('idempotency_keys')
      .select('response_body, response_status')
      .eq('key', key)
      .single()

    if (data) return { isDuplicate: true, cachedResponse: data }
  } catch (error) {
    // Table might not exist yet — treat as non-duplicate
    console.warn('[idempotency] checkIdempotency failed:', error instanceof Error ? error.message : error)
  }

  return { isDuplicate: false }
}

export async function saveIdempotencyResult(key: string | null, responseBody: unknown, responseStatus: number) {
  if (!key) return

  try {
    await supabaseAdmin.from('idempotency_keys').upsert({
      key,
      response_body: responseBody,
      response_status: responseStatus,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Non-critical — log but don't fail the request
    console.warn('[idempotency] Failed to save idempotency key:', key, error instanceof Error ? error.message : error)
  }
}

/**
 * Extract the Idempotency-Key header from a request.
 */
export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key') || request.headers.get('idempotency-key') || null
}

/**
 * Middleware-style helper: check idempotency and return cached response if duplicate.
 * Usage in route handler:
 *   const cached = await handleIdempotency(request)
 *   if (cached) return cached
 */
export async function handleIdempotency(request: Request): Promise<Response | null> {
  const key = getIdempotencyKey(request)
  if (!key) return null

  const { isDuplicate, cachedResponse } = await checkIdempotency(key)
  if (isDuplicate && cachedResponse) {
    return new Response(JSON.stringify(cachedResponse.response_body), {
      status: cachedResponse.response_status,
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Replayed': 'true',
      },
    })
  }

  return null
}
