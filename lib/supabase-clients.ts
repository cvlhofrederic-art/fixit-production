/**
 * Centralised factories for Supabase clients used by API routes.
 *
 * - getAdminClient() returns a fresh service-role client (bypasses RLS).
 *   Use ONLY for legitimate cross-tenant work (cron ingest, public reads
 *   guarded by app-level checks, anonymous access via secret tokens).
 *
 * - getAnonClient() returns a fresh anon-key client. Combined with a
 *   user's Bearer token (via authenticateRequest) it lets RLS policies
 *   enforce tenant isolation.
 *
 * - authenticateRequest(req) extracts and validates a Bearer token,
 *   returning the Supabase user or null. Single source of truth for
 *   the marketplace/RFQ token-auth pattern.
 *
 * Both factories throw if env vars are missing so misconfiguration
 * surfaces immediately rather than 500-ing on the first DB call.
 *
 * The pre-existing `supabaseAdmin` singleton in lib/supabase-server.ts
 * is left untouched to avoid disturbing routes that depend on its
 * placeholder-tolerant build-time behaviour.
 */
import type { NextRequest } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'

function readEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, anonKey, serviceKey }
}

export function getAdminClient(): SupabaseClient {
  const { url, serviceKey } = readEnv()
  if (!url || !serviceKey) throw new Error('Missing Supabase env vars (SUPABASE_SERVICE_ROLE_KEY)')
  return createClient(url, serviceKey)
}

export function getAnonClient(): SupabaseClient {
  const { url, anonKey } = readEnv()
  if (!url || !anonKey) throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  return createClient(url, anonKey)
}

/**
 * Returns an anon client with the user's JWT attached to every request.
 * RLS policies that reference auth.uid() will then enforce tenant isolation.
 * Use this for any user-scoped mutation that has matching RLS policies —
 * it is the safe replacement for getAdminClient() on those paths.
 */
export function getAuthedClient(token: string): SupabaseClient {
  const { url, anonKey } = readEnv()
  if (!url || !anonKey) throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  if (!token) throw new Error('getAuthedClient called without a token')
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getBearerToken(req: NextRequest): string | null {
  const header = req.headers.get('authorization')
  if (!header) return null
  const token = header.replace(/^Bearer\s+/i, '').trim()
  return token.length > 0 ? token : null
}

export async function authenticateRequest(req: NextRequest): Promise<User | null> {
  const token = getBearerToken(req)
  if (!token) return null
  const { data: { user }, error } = await getAnonClient().auth.getUser(token)
  if (error || !user) return null
  return user
}
