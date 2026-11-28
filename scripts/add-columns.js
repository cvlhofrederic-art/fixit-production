// Script to add missing columns to profiles_artisan
// Run with: node scripts/add-columns.js

const { Pool } = require('pg')

// Supabase direct connection (IPv4, port 5432)
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Or: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres

require('dotenv').config({ path: '.env.local' })
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || ''
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || ''
// Certificat TLS de la base vérifié (relevé semgrep bypass-tls-verification du 28/10/2026) :
// avec rejectUnauthorized: false, un faux serveur pouvait recevoir le mot de passe de la base.
// Supabase signe ses certificats avec sa propre autorité : si la connexion échoue sur le
// certificat, télécharger le CA (Supabase > Project Settings > Database > SSL) et passer son
// chemin dans SUPABASE_DB_CA_CERT. Jamais de rejectUnauthorized: false.
const CA_CERT_PATH = process.env.SUPABASE_DB_CA_CERT || ''
function optionsSsl() {
  const ssl = { rejectUnauthorized: true }
  if (CA_CERT_PATH) ssl.ca = require('fs').readFileSync(CA_CERT_PATH, 'utf8')
  return ssl
}

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
`
// Note: seed data removed for security (contained PII).
// Use Supabase dashboard to update artisan profiles.

async function tryConnection(connStr, label) {
  const pool = new Pool({
    connectionString: connStr,
    ssl: optionsSsl(),
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
    if (/certificate|self.signed|CERT_/i.test(e.message)) console.log('   → certificat non reconnu : renseigner SUPABASE_DB_CA_CERT (voir le commentaire en tête du script)')
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
  console.log('https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new')
  console.log(sql)
}

main().catch(console.error)
