import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

// Diagnostic: vérifie quelles colonnes existent dans profiles_artisan
// ⚠️ SÉCURISÉ : nécessite authentification admin
export async function GET(request: NextRequest) {
  // ── SÉCURITÉ : auth obligatoire + vérification admin ──────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }
  const ip = getClientIP(request)
  if (!checkRateLimit(`db_check_${ip}`, 5, 60_000)) return rateLimitResponse()

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const columnsToCheck = [
    'id', 'user_id', 'company_name', 'siret', 'bio', 'categories',
    'hourly_rate', 'zone_radius_km', 'latitude', 'longitude',
    'rating_avg', 'rating_count', 'verified', 'subscription_tier',
    'active', 'created_at', 'updated_at',
    // Colonnes ajoutées par migrations
    'phone', 'email', 'legal_form', 'siren', 'naf_code', 'naf_label',
    'company_address', 'company_city', 'company_postal_code',
    'auto_accept', 'auto_block_duration_minutes', 'auto_reply_message',
    'insurance_url', 'kbis_url', 'profile_photo_url',
  ]

  const results: Record<string, string> = {}

  // Test each column individually by trying to select it
  for (const col of columnsToCheck) {
    const { data, error } = await supabaseAdmin
      .from('profiles_artisan')
      .select(col)
      .limit(1)

    if (error) {
      results[col] = `❌ MISSING — ${error.message}`
    } else {
      results[col] = '✅ EXISTS'
    }
  }

  const missingColumns = Object.entries(results)
    .filter(([_, v]) => v.startsWith('❌'))
    .map(([k]) => k)

  // Generate migration SQL for missing columns
  const columnDefs: Record<string, string> = {
    phone: 'TEXT',
    email: 'TEXT',
    legal_form: 'TEXT',
    siren: 'TEXT',
    naf_code: 'TEXT',
    naf_label: 'TEXT',
    company_address: 'TEXT',
    company_city: 'TEXT',
    company_postal_code: 'TEXT',
    auto_accept: 'BOOLEAN DEFAULT false',
    auto_block_duration_minutes: 'INTEGER DEFAULT 240',
    auto_reply_message: "TEXT DEFAULT ''",
    zone_radius_km: 'INTEGER DEFAULT 30',
    insurance_url: 'TEXT',
    kbis_url: 'TEXT',
    profile_photo_url: 'TEXT',
  }

  const migrationSql = missingColumns
    .filter(col => columnDefs[col])
    .map(col => `ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS ${col} ${columnDefs[col]};`)
    .join('\n')

  return NextResponse.json({
    total_checked: columnsToCheck.length,
    existing: columnsToCheck.length - missingColumns.length,
    missing: missingColumns.length,
    columns: results,
    migration_needed: missingColumns.length > 0,
    migration_sql: migrationSql || 'Aucune migration nécessaire',
    run_at: 'https://supabase.com/dashboard/project/irluhepekbqgquveaett/sql/new',
  })
}
