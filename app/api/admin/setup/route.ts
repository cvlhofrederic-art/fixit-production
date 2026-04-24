import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { adminSetupQuerySchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

// GET /api/admin/setup?step=tables|admin|all
// ⚠️ SÉCURISÉ : nécessite authentification super_admin + vérification email
export async function GET(request: NextRequest) {
  // ── Rate limit strict pour endpoint admin ──────────────────────────────
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`admin_setup_${ip}`, 5, 60_000))) return rateLimitResponse()

  // ── Vérification authentification ────────────────────────────────────────
  const user = await getAuthUser(request as any)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }

  // ── Vérification admin via email (non forgeable, contrairement à user_metadata) ──
  const ADMIN_EMAILS = [process.env.ADMIN_EMAIL].filter(Boolean) as string[]
  if (!user.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Accès réservé aux super_admin' }, { status: 403 })
  }

  const url = new URL(request.url)
  const parsed = adminSetupQuerySchema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join('; ') }, { status: 400 })
  }
  const { step } = parsed.data
  const results: Record<string, any> = {}

  // ── ÉTAPE 1 : Créer les tables ──────────────────────────────────────────────
  if (step === 'tables' || step === 'all') {
    try {
      // Tables should exist from migrations. Verify they're present.
      const tablesToCheck = ['syndic_immeubles', 'syndic_signalements', 'syndic_signalement_messages', 'syndic_missions']
      const tableErrors: string[] = []
      for (const table of tablesToCheck) {
        const { error } = await supabaseAdmin.from(table).select('id').limit(0)
        if (error) {
          tableErrors.push(`Table ${table} manquante: ${error.message}`)
        }
      }
      results.tables = tableErrors.length === 0
        ? { success: true, message: 'Toutes les tables existent' }
        : { success: false, errors: tableErrors, action: 'Exécutez les migrations Supabase ou utilisez le SQL Editor' }
    } catch (e: unknown) {
      results.tables = { success: false, error: e instanceof Error ? e.message : 'Internal error' }
    }
  }

  // ── ÉTAPE 2 : Créer le compte super_admin ────────────────────────────────────
  if (step === 'admin' || step === 'all') {
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      results.admin = { success: false, error: 'Variables ADMIN_EMAIL et ADMIN_PASSWORD requises dans les env vars' }
    } else {
      try {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
        if (listError) throw listError

        const existing = users.find(u => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase())

        if (existing) {
          const { data, error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            app_metadata: {
              ...(existing.app_metadata || {}),
              role: 'super_admin',
            },
            user_metadata: {
              ...existing.user_metadata,
              full_name: 'Super Admin Vitfix',
            }
          })
          results.admin = {
            success: !error,
            action: 'updated',
            user_id: existing.id,
            email: existing.email,
            role: data?.user?.app_metadata?.role,
            error: error?.message,
          }
        } else {
          const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            app_metadata: { role: 'super_admin' },
            user_metadata: { full_name: 'Super Admin Vitfix' },
          })
          results.admin = {
            success: !error,
            action: 'created',
            user_id: data?.user?.id,
            email: data?.user?.email,
            role: data?.user?.app_metadata?.role,
            error: error?.message,
          }
        }
      } catch (e: unknown) {
        results.admin = { success: false, error: e instanceof Error ? e.message : 'Internal error' }
      }
    }
  }

  // ── ÉTAPE 3 : Colonnes assurance + scan anti-fraude ──────────────────────
  if (step === 'insurance' || step === 'all') {
    const insuranceSql = `
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_name TEXT;
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_number TEXT;
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_coverage TEXT DEFAULT 'France métropolitaine';
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_type TEXT DEFAULT 'rc_pro';
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_expiry DATE;
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT false;
      ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS insurance_scan_data JSONB;
    `
    try {
      // supabaseAdmin can execute raw SQL via rpc if available, otherwise use individual updates
      // Try adding columns one by one via Supabase's postgrest
      const colDefs = [
        { col: 'insurance_name', type: 'TEXT' },
        { col: 'insurance_number', type: 'TEXT' },
        { col: 'insurance_coverage', type: 'TEXT', default: "'France métropolitaine'" },
        { col: 'insurance_type', type: 'TEXT', default: "'rc_pro'" },
        { col: 'insurance_expiry', type: 'DATE' },
        { col: 'insurance_verified', type: 'BOOLEAN', default: 'false' },
        { col: 'insurance_scan_data', type: 'JSONB' },
      ]

      // Test if columns already exist by trying to select them
      const { error: testErr } = await supabaseAdmin.from('profiles_artisan').select('insurance_name').limit(0)
      if (testErr) {
        // Columns don't exist yet — we need to add them via Supabase Dashboard SQL editor
        results.insurance = {
          success: false,
          action: 'manual_sql_needed',
          sql: insuranceSql,
          message: 'Run this SQL in Supabase Dashboard > SQL Editor to add the columns',
        }
      } else {
        results.insurance = { success: true, action: 'columns_exist' }
      }
    } catch (e: unknown) {
      results.insurance = { success: false, error: e instanceof Error ? e.message : 'Internal error' }
    }
  }

  return NextResponse.json({
    ...results,
    timestamp: new Date().toISOString(),
  })
}
