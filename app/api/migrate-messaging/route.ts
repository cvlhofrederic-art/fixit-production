import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'

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
  if (!checkRateLimit(`migrate_messaging_${ip}`, 3, 60_000)) return rateLimitResponse()

  const results: Record<string, any> = {}

  // 1. Create booking_messages table
  try {
    const { error } = await supabaseAdmin.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS booking_messages (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          booking_id  UUID NOT NULL,
          sender_id   UUID NOT NULL,
          sender_role TEXT NOT NULL DEFAULT 'client',
          sender_name TEXT NOT NULL DEFAULT '',
          content     TEXT NOT NULL,
          type        TEXT NOT NULL DEFAULT 'text',
          read_at     TIMESTAMPTZ,
          created_at  TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_booking_messages_booking ON booking_messages(booking_id, created_at ASC);
      `
    })
    results.booking_messages_table = error ? { error: error.message } : 'OK'
  } catch (e: any) {
    // Try direct insert to check if table exists
    results.booking_messages_table = { rpc_error: e.message }
  }

  // 2. Add columns to profiles_artisan
  const columns = [
    { name: 'auto_accept', type: 'BOOLEAN DEFAULT false' },
    { name: 'auto_block_duration_minutes', type: 'INTEGER DEFAULT 240' },
    { name: 'auto_reply_message', type: 'TEXT DEFAULT \'\'' },
  ]

  for (const col of columns) {
    try {
      // Try inserting a test value to see if column exists
      const { data: testData } = await supabaseAdmin
        .from('profiles_artisan')
        .select(col.name)
        .limit(1)
      results[`profiles_artisan.${col.name}`] = 'EXISTS'
    } catch {
      results[`profiles_artisan.${col.name}`] = 'NEEDS_CREATION'
    }
  }

  // 3. Add expires_at to bookings
  try {
    const { data: testData } = await supabaseAdmin
      .from('bookings')
      .select('expires_at')
      .limit(1)
    results['bookings.expires_at'] = 'EXISTS'
  } catch {
    results['bookings.expires_at'] = 'NEEDS_CREATION'
  }

  // Return SQL for manual execution if needed
  const manualSql = `
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/irluhepekbqgquveaett/sql/new

-- 1. Create booking_messages table
CREATE TABLE IF NOT EXISTS booking_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL,
  sender_id   UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'client',
  sender_name TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'text',
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking ON booking_messages(booking_id, created_at ASC);

-- 2. Add columns to profiles_artisan
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_accept BOOLEAN DEFAULT false;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_block_duration_minutes INTEGER DEFAULT 240;
ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS auto_reply_message TEXT DEFAULT '';

-- 3. Add expires_at to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 4. Enable Realtime on booking_messages
ALTER PUBLICATION supabase_realtime ADD TABLE booking_messages;
  `

  return NextResponse.json({
    results,
    manualSql,
    instruction: 'If any column shows NEEDS_CREATION, run the SQL above in Supabase SQL Editor',
  })
}
