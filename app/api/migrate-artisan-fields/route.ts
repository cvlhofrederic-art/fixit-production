import { NextResponse } from 'next/server'

// One-time migration: add columns and update profiles_artisan with verified company fields
// Uses direct PostgreSQL query via Supabase's pg endpoint
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const sql = `
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS legal_form text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS siren text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS naf_code text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS naf_label text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS company_address text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS company_city text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS company_postal_code text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS phone text;
    ALTER TABLE profiles_artisan ADD COLUMN IF NOT EXISTS email text;

    UPDATE profiles_artisan SET
      legal_form = 'Entrepreneur individuel',
      siren = '953951589',
      naf_code = '81.30Z',
      naf_label = 'Services d''aménagement paysager',
      company_address = 'Rés L''aurore Bat B, 13600 La Ciotat',
      company_city = 'La Ciotat',
      company_postal_code = '13600',
      phone = '06 51 46 66 98',
      email = 'leporesebastien.pro@gmail.com'
    WHERE siret = '95395158900019';
  `

  // Try Supabase SQL HTTP endpoint (several possible paths)
  const endpoints = [
    '/sql',
    '/pg',
    '/pg/query',
    '/rest/v1/rpc/exec_sql',
  ]

  const results: any = {}

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${supabaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ query: sql })
      })
      const text = await res.text()
      results[endpoint] = { status: res.status, body: text.substring(0, 500) }
      if (res.ok) {
        return NextResponse.json({ success: true, endpoint, result: text.substring(0, 500) })
      }
    } catch (e: any) {
      results[endpoint] = { error: e.message }
    }
  }

  return NextResponse.json({
    success: false,
    results,
    manualSql: sql,
    instruction: 'Go to https://supabase.com/dashboard/project/irluhepekbqgquveaett/sql/new and run the SQL above',
  })
}
