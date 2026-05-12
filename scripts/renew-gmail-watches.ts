// scripts/renew-gmail-watches.ts
// ──────────────────────────────────────────────────────────────────────────────
// À exécuter quotidiennement (cron Cloudflare ou GitHub Actions).
// Renouvelle les Gmail watches qui expirent dans < 24h.
//
// Usage :
//   OAUTH_TOKENS_ENCRYPTION_KEY="..." \
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   NEXT_PUBLIC_SUPABASE_URL="..." \
//   GCP_PROJECT_ID="..." \
//   GMAIL_PUSH_TOPIC="gmail-push" \
//   npx tsx scripts/renew-gmail-watches.ts
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { getDecryptedToken } from '../lib/oauth/tokens'

interface TokenRow {
  syndic_id: string
  email_compte: string
  watch_expiry: string | null
}

interface GmailWatchResponse {
  historyId: string
  expiration: string
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const gcpProject = process.env.GCP_PROJECT_ID
  const gmailTopic = process.env.GMAIL_PUSH_TOPIC

  if (!supabaseUrl || !serviceKey) {
    console.error('[renew-watches] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!gcpProject || !gmailTopic) {
    console.error('[renew-watches] Missing GCP_PROJECT_ID or GMAIL_PUSH_TOPIC')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const dayFromNow = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

  const { data: expiring, error } = await supabase
    .from('syndic_oauth_tokens')
    .select('syndic_id, email_compte, watch_expiry')
    .or(`watch_expiry.is.null,watch_expiry.lt.${dayFromNow}`)
    .not('access_token_enc', 'is', null)

  if (error) {
    console.error('[renew-watches] fetch failed:', error.message)
    process.exit(1)
  }

  const rows = (expiring ?? []) as TokenRow[]
  console.log(`[renew-watches] ${rows.length} watches à renouveler`)

  let success = 0
  let failed = 0
  for (const row of rows) {
    try {
      const token = await getDecryptedToken(supabase, row.syndic_id)
      if (!token) {
        console.warn(`[renew] skip ${row.syndic_id.slice(0, 8)} (no token)`)
        failed++
        continue
      }

      const watchRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          topicName: `projects/${gcpProject}/topics/${gmailTopic}`,
          labelIds: ['INBOX'],
        }),
      })

      if (!watchRes.ok) {
        console.error(`[renew] ✗ ${row.syndic_id.slice(0, 8)}: status ${watchRes.status}`)
        failed++
        continue
      }

      const watchData = await watchRes.json() as GmailWatchResponse
      await supabase
        .from('syndic_oauth_tokens')
        .update({ watch_expiry: new Date(Number(watchData.expiration)).toISOString() })
        .eq('syndic_id', row.syndic_id)

      success++
      console.log(`[renew] ✓ ${row.syndic_id.slice(0, 8)} → expires ${watchData.expiration}`)
    } catch (err) {
      failed++
      console.error(`[renew] ✗ ${row.syndic_id.slice(0, 8)}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`[renew-watches] terminé : ${success} success, ${failed} failed sur ${rows.length}`)
  process.exit(failed > 0 && success === 0 ? 1 : 0)
}

main().catch(err => {
  console.error('[renew-watches] FATAL:', err)
  process.exit(1)
})
