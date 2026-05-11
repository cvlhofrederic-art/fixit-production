import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

interface GmailPubSubMessage {
  message?: {
    data?: string
    messageId?: string
    publishTime?: string
  }
  subscription?: string
}

interface GmailPushPayload {
  emailAddress: string
  historyId: string
}

const WEBHOOK_TOKEN_HEADER = 'x-gmail-webhook-token'

export async function POST(req: NextRequest) {
  const token = req.headers.get(WEBHOOK_TOKEN_HEADER)
  if (!process.env.GMAIL_WEBHOOK_SECRET || token !== process.env.GMAIL_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as GmailPubSubMessage | null
  if (!body?.message?.data) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  let payload: GmailPushPayload
  try {
    const decoded = Buffer.from(body.message.data, 'base64').toString('utf-8')
    payload = JSON.parse(decoded)
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  if (!payload.emailAddress) {
    return NextResponse.json({ error: 'missing_email' }, { status: 400 })
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: tokenRow } = await supabaseAdmin
    .from('syndic_oauth_tokens')
    .select('syndic_id, email_compte')
    .eq('email_compte', payload.emailAddress)
    .maybeSingle()

  if (!tokenRow) {
    logger.warn('webhook: no syndic for email', { email: payload.emailAddress })
    return NextResponse.json({ status: 'ignored', reason: 'no_syndic' })
  }

  // Déclenche poll ciblé sans bloquer le webhook (qui doit ack rapidement à Pub/Sub)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (siteUrl) {
    void fetch(`${siteUrl}/api/email-agent/poll`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-trigger': process.env.INTERNAL_POLL_TOKEN ?? '',
      },
      body: JSON.stringify({ syndic_id: tokenRow.syndic_id, history_id: payload.historyId }),
    }).catch((err: unknown) => {
      logger.error('webhook: trigger poll failed', { error: err instanceof Error ? err.message : String(err) })
    })
  }

  return NextResponse.json({ status: 'queued', syndic_id: tokenRow.syndic_id })
}
