// Script to add missing columns to profiles_artisan
// Run with: node scripts/add-columns.js

const { Pool } = require('pg')

// Supabase direct connection (IPv4, port 5432)
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Or: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

const PROJECT_REF = 'irluhepekbqgquveaett'
const DB_PASSWORD = 'sb_secret_lDcyzgFqQMUE65_bCpzuAg_rlTsd6tB'

// Try multiple connection strings
const connectionStrings = [
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
  `postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
  `postgresql://postgres.${PROJECT_REF}:${DB_PASSWORD}@aws-0-eu-west-3.pooler.supabase.com:6543/postgres`,
]

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

async function tryConnection(connStr, label) {
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  try {
    console.log(`Trying ${label}...`)
    await pool.query(sql)
    console.log(`✅ SUCCESS with ${label}`)
    await pool.end()
    return true
  } catch (e) {
    console.log(`❌ Failed: ${e.message.substring(0, 100)}`)
    await pool.end().catch(() => {})
    return false
  }
}

async function main() {
  console.log('🔧 Adding missing columns to profiles_artisan...\n')

  for (let i = 0; i < connectionStrings.length; i++) {
    const success = await tryConnection(connectionStrings[i], `Connection ${i + 1}`)
    if (success) {
      console.log('\n✅ Migration complete!')
      process.exit(0)
    }
  }

  console.log('\n❌ All connections failed.')
  console.log('\nPlease run this SQL in Supabase SQL Editor:')
  console.log('https://supabase.com/dashboard/project/irluhepekbqgquveaett/sql/new')
  console.log(sql)
}

main().catch(console.error)
