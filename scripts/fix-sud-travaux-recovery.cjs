const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '/Users/elgato_fofo/Desktop/fixit-production/.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const USER_ID = 'c0f138e6-1725-406e-a631-03e1b72acfe4'

async function main() {
  console.log('═══════════ PHASE 1 — État FACT-2026-002 ═══════════')
  const { data: fact002 } = await supabase
    .from('factures')
    .select('id, numero, client_name, total_ttc_cents, total_ht_cents, status, created_at, updated_at, raw_data')
    .eq('artisan_user_id', USER_ID)
    .eq('numero', 'FACT-2026-002')
    .single()
  console.log({
    id: fact002.id,
    client_name: fact002.client_name,
    total_ttc: (fact002.total_ttc_cents || 0) / 100 + '€',
    total_ht: (fact002.total_ht_cents || 0) / 100 + '€',
    status: fact002.status,
    created_at: fact002.created_at,
    updated_at: fact002.updated_at,
    raw_docTitle: fact002.raw_data?.docTitle,
    raw_subType: fact002.raw_data?.factureSubType,
  })

  console.log('\n═══════════ PHASE 2 — Tables audit possibles ═══════════')
  for (const t of ['factures_audit', 'audit_log', 'documents_audit', 'audit_documents', 'document_history']) {
    const { error } = await supabase.from(t).select('id').limit(1)
    console.log(`  ${t}: ${error ? '✗ ' + error.code : '✓ existe'}`)
  }

  console.log('\n═══════════ PHASE 3 — Toutes les factures actuelles ═══════════')
  const { data: allFac } = await supabase
    .from('factures')
    .select('numero, client_name, total_ttc_cents, status, created_at, cancelled_at')
    .eq('artisan_user_id', USER_ID)
    .order('created_at', { ascending: true })
  for (const f of allFac) {
    const flag = f.cancelled_at ? ' [CANCELLED]' : ''
    console.log(`  ${f.numero}  ${(f.total_ttc_cents/100).toFixed(2)}€  ${f.client_name}  ${f.status}${flag}  ${f.created_at}`)
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
