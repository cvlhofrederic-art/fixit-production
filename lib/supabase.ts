import { createBrowserClient } from '@supabase/ssr'
import { creerVerrouAuth } from '@/lib/auth/verrou-auth'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build'

// Client navigateur unique : @supabase/ssr renvoie ce même singleton à tout autre appel de createBrowserClient.
// La session est en cookies (gérés par @supabase/ssr) ; la séparation des rôles est faite par le middleware.
// `auth.lock` : verrou d'auth qui ne laisse jamais le client mort quand le verrou partagé entre onglets est
// abandonné après 10 s (AbortError « signal is aborted without reason », Sentry C et X) — lib/auth/verrou-auth.ts.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: creerVerrouAuth() },
})
