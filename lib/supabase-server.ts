import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key-for-build'

// Server-side Supabase client with service_role key - bypasses RLS
// Note: placeholder values are used during build/CI to prevent crashes;
// actual API calls will fail gracefully at runtime if env vars are missing
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
