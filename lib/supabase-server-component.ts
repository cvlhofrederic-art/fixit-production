// ── Supabase Client for Server Components & Route Handlers ──────────────────
// Uses @supabase/ssr createServerClient with cookie-based auth.
// This client RESPECTS RLS policies (unlike supabase-server.ts which uses service_role).

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Placeholder for CI builds when env vars are absent (prevents build crash)
const BUILD_PLACEHOLDER_KEY = 'placeholder-key-for-build'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || BUILD_PLACEHOLDER_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}
