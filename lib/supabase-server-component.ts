// ── Supabase Client for Server Components & Route Handlers ──────────────────
// Uses @supabase/ssr createServerClient with cookie-based auth.
// This client RESPECTS RLS policies (unlike supabase-server.ts which uses service_role).
//
// Usage in Server Components:
//   const supabase = await createServerSupabaseClient()
//   const { data } = await supabase.from('bookings').select('*')
//
// Usage in Route Handlers:
//   const supabase = await createServerSupabaseClient()
//   const { data: { user } } = await supabase.auth.getUser()

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client for Server Components / Server Actions / Route Handlers.
 * Reads cookies from the request to maintain the user's session.
 * Uses the anon key — RLS is enforced.
 *
 * NOTE: Once you run `supabase gen types typescript --linked > lib/database.types.ts`,
 * add the Database generic: createServerClient<Database>(...)
 * This will enable full column-level type checking on all queries.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
            // setAll called from a Server Component (read-only context).
            // Middleware handles token refresh, so this is safe to ignore.
          }
        },
      },
    }
  )
}
