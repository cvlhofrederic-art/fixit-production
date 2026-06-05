// scripts/migrate-encrypt-oauth-tokens.ts
// ──────────────────────────────────────────────────────────────────────────────
// Script one-shot : encrypte tous les tokens OAuth existants (plain) vers les
// colonnes chiffrées via le wrapper. À lancer une fois après application de la
// migration 20260512_encrypt_oauth_tokens.sql.
//
// Usage :
//   OAUTH_TOKENS_ENCRYPTION_KEY="..." \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   NEXT_PUBLIC_SUPABASE_URL="..." \
//   npx tsx scripts/migrate-encrypt-oauth-tokens.ts --dry-run
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { setEncryptedToken, getEncryptionKey } from '../lib/oauth/tokens'

interface PlainRow {
  syndic_id: string
  access_token: string | null
  refresh_token: string | null
  token_expiry: string | null
  access_token_enc: unknown | null
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  console.log(`[backfill] mode = ${dryRun ? 'DRY RUN' : 'APPLY'}`)

  getEncryptionKey()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[backfill] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  const client = createClient(supabaseUrl, serviceKey)

  const { data, error } = await client
    .from('syndic_oauth_tokens')
    .select('syndic_id, access_token, refresh_token, token_expiry, access_token_enc')
    .is('access_token_enc', null)

  if (error) {
    console.error('[backfill] fetch failed:', error.message)
    process.exit(1)
  }

  const rows = (data ?? []) as PlainRow[]
  console.log(`[backfill] ${rows.length} rows à migrer`)

  if (rows.length === 0) {
    console.log('[backfill] Aucun row à migrer (tout est déjà chiffré).')
    process.exit(0)
  }

  if (dryRun) {
    console.log('[backfill] DRY RUN — aucun changement appliqué')
    rows.forEach(r => console.log(`  - syndic ${r.syndic_id.slice(0, 8)}... access=${r.access_token?.slice(0, 10) ?? 'MISSING'}...`))
    process.exit(0)
  }

  let success = 0
  let failed = 0
  for (const row of rows) {
    if (!row.access_token || !row.refresh_token || !row.token_expiry) {
      console.warn(`[backfill] skip ${row.syndic_id.slice(0, 8)} (tokens manquants ou pas d'expiry)`)
      failed++
      continue
    }
    try {
      await setEncryptedToken(client, {
        syndic_id: row.syndic_id,
        access_token: row.access_token,
        refresh_token: row.refresh_token,
        expires_at: row.token_expiry,
      })
      success++
      console.log(`[backfill] ✓ ${row.syndic_id.slice(0, 8)}`)
    } catch (err) {
      failed++
      console.error(`[backfill] ✗ ${row.syndic_id.slice(0, 8)}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`[backfill] terminé : ${success} success, ${failed} failed sur ${rows.length}`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[backfill] FATAL:', err)
  process.exit(1)
})
