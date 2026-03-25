import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build'

// Server-side Supabase client with service_role key — bypasses RLS.
// Placeholder values prevent build crashes when env vars are absent (CI).
// API calls fail gracefully at runtime if the key is invalid.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
