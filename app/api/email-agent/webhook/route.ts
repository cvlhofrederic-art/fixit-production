import { NextRequest, NextResponse, after } from 'next/server'
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

  // Déclenche poll ciblé sans bloquer le webhook (qui doit ack rapidement à Pub/Sub).
  // Base URL : NEXT_PUBLIC_APP_URL (inlinée au build + wrangler [vars]),
  // fallback legacy NEXT_PUBLIC_SITE_URL. Sans token interne, on n'envoie RIEN
  // (jamais de header vide — le poll refuserait de toute façon).
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''
  const internalToken = process.env.INTERNAL_POLL_TOKEN || ''
  if (!siteUrl) {
    logger.warn('webhook: NEXT_PUBLIC_APP_URL absente — poll temps réel non déclenché', {
      syndic_id: tokenRow.syndic_id,
    })
  } else if (!internalToken) {
    logger.warn('webhook: INTERNAL_POLL_TOKEN absent — poll temps réel non déclenché', {
      syndic_id: tokenRow.syndic_id,
    })
  } else {
    // ALF-1 — Sous workerd (Cloudflare Workers), une sous-requête fire-and-forget
    // (`void fetch(...)`) peut être annulée dès que la réponse part. `after()`
    // (next/server, stable en Next 16) enregistre le callback sur le
    // `ctx.waitUntil` du Worker via OpenNext (cloudflare-node.js passe
    // ctx.waitUntil → provideNextAfterProvider l'expose via
    // Symbol.for('@next/request-context'), que after() consomme). Le fetch
    // survit donc à l'envoi de la réponse tout en s'exécutant APRÈS elle :
    // l'ack Pub/Sub reste immédiat et non bloquant.
    const syndicId = tokenRow.syndic_id
    try {
      after(async () => {
        try {
          const pollRes = await fetch(`${siteUrl}/api/email-agent/poll`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-internal-trigger': internalToken,
            },
            body: JSON.stringify({ syndic_id: syndicId, history_id: payload.historyId }),
          })
          if (!pollRes.ok) {
            logger.warn('webhook: trigger poll non-ok', { status: pollRes.status, syndic_id: syndicId })
          }
        } catch (err: unknown) {
          // Échec loggé, jamais propagé : la réponse (ack Pub/Sub) est déjà partie.
          logger.warn('webhook: trigger poll failed', {
            error: err instanceof Error ? err.message : String(err),
            syndic_id: syndicId,
          })
        }
      })
    } catch (err: unknown) {
      // after() hors contexte requête Next (ne doit pas arriver en prod sous
      // OpenNext) — on loggue et on ack quand même Pub/Sub, jamais d'échec propagé.
      logger.warn('webhook: after() indisponible — poll temps réel non déclenché', {
        error: err instanceof Error ? err.message : String(err),
        syndic_id: syndicId,
      })
    }
  }

  return NextResponse.json({ status: 'queued', syndic_id: tokenRow.syndic_id })
}
