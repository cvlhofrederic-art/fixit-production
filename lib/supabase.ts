import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key-for-build'

// storageKey unique par rôle pour éviter les conflits de session multi-onglets
// (ex: syndic + artisan connectés dans le même navigateur)
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  cookieOptions: {
    // Les cookies Supabase sont gérés automatiquement par @supabase/ssr
    // La séparation se fait par le middleware qui gère les rôles
  },
})
