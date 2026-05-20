import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const { data: tokenRow } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .select('email_compte, token_expiry')
      .eq('syndic_id', user.id)
      .maybeSingle()

    const connected = Boolean(tokenRow?.email_compte)
    const email_compte = tokenRow?.email_compte ?? null

    if (!connected) {
      return NextResponse.json({
        connected: false,
        email_compte: null,
        drafts_pending: 0,
        emails_analysed: 0,
      })
    }

    const [{ count: draftsPending }, { count: emailsAnalysed }] = await Promise.all([
      supabaseAdmin
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', user.id)
        .eq('draft_status', 'pending_review'),
      supabaseAdmin
        .from('syndic_emails_analysed')
        .select('*', { count: 'exact', head: true })
        .eq('syndic_id', user.id),
    ])

    return NextResponse.json({
      connected: true,
      email_compte,
      drafts_pending: draftsPending ?? 0,
      emails_analysed: emailsAnalysed ?? 0,
    })
  } catch (err) {
    logger.error('email-agent status failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
