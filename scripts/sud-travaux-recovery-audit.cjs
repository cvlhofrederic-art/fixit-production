const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '/Users/elgato_fofo/Desktop/fixit-production/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USER_ID = 'c0f138e6-1725-406e-a631-03e1b72acfe4'
const FACT_002_ROW_ID = '006a3d47-9967-4982-b5f5-b5d740313d07'

async function main() {
  console.log('═══ documents_audit_log pour FACT-2026-002 ═══')
  const { data: byRecord, error: e1 } = await supabase
    .from('documents_audit_log')
    .select('id, action, table_name, doc_number, old_status, new_status, cancelled_reason, details, created_at')
    .eq('record_id', FACT_002_ROW_ID)
    .order('created_at', { ascending: true })
  console.log('  by record_id:', e1 || `${byRecord?.length || 0} entries`)
  for (const e of (byRecord || [])) {
    console.log('   →', JSON.stringify(e, null, 2))
  }

  console.log('\n═══ documents_audit_log pour TOUTES factures Sud travaux ═══')
  const { data: allFor } = await supabase
    .from('documents_audit_log')
    .select('action, doc_number, old_status, new_status, details, created_at')
    .eq('user_id', USER_ID)
    .eq('table_name', 'factures')
    .order('created_at', { ascending: true })
    .limit(30)
  for (const e of (allFor || [])) {
    console.log(`  ${e.created_at} | ${e.doc_number} | ${e.action} | ${e.old_status}→${e.new_status} | details: ${JSON.stringify(e.details)}`)
  }

  console.log('\n═══ audit_logs (général migration 042) pour user ═══')
  const { data: gen, error: e3 } = await supabase
    .from('audit_logs')
    .select('action, table_name, details, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(20)
  console.log('  status:', e3 || `${gen?.length || 0} entries`)
  for (const e of (gen || [])) {
    console.log(`  ${e.created_at} | ${e.table_name}.${e.action} | ${JSON.stringify(e.details).slice(0, 200)}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
