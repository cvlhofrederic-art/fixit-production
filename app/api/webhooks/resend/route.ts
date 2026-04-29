// app/api/webhooks/resend/route.ts
//
// Webhook Resend → Sentry pour tracking deliverability email (bounces,
// complaints, delays). Reçoit les events Resend (signés via Svix HMAC-SHA256)
// et envoie les anomalies vers Sentry pour alerting/monitoring.
//
// Setup :
//   1. wrangler secret put RESEND_WEBHOOK_SECRET   (commence par "whsec_...")
//   2. Resend > Webhooks > Add endpoint :
//      URL    : https://vitfix.io/api/webhooks/resend
//      Events : email.bounced, email.complained, email.delivery_delayed,
//               email.delivered (debug), email.sent (debug)
//   3. Copier le Signing secret depuis Resend dans le secret Wrangler.

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'

const log = logger.withTenant('api/webhooks/resend')

export const runtime = 'nodejs'
export const maxDuration = 10

// Tolérance pour replay attacks : on rejette les requêtes plus vieilles que 5 min.
const REPLAY_WINDOW_SECONDS = 5 * 60

type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.bounced'
  | 'email.complained'
  | 'email.opened'
  | 'email.clicked'

interface ResendEvent {
  type: ResendEventType
  created_at: string
  data: {
    email_id?: string
    from?: string
    to?: string[] | string
    subject?: string
    bounce?: { type?: string; sub_type?: string; message?: string }
    complaint?: { type?: string; user_agent?: string }
    [key: string]: unknown
  }
}

/**
 * Vérifie la signature Svix d'un webhook Resend.
 * Format : `${svix_id}.${svix_timestamp}.${body}` signé HMAC-SHA256 avec
 * le secret. Retourne true si au moins une des signatures du header matche.
 *
 * Le header `svix-signature` peut contenir plusieurs signatures séparées par
 * des espaces, ex: "v1,abc123 v1,def456" — on accepte si UNE matche
 * (rotation de clé en cours).
 */
function verifySvixSignature(opts: {
  secret: string
  svixId: string
  svixTimestamp: string
  svixSignature: string
  body: string
}): boolean {
  // Le secret Resend/Svix commence par "whsec_" — on strip ce préfixe et on
  // décode le reste en base64 pour obtenir la vraie clé HMAC.
  const cleanSecret = opts.secret.startsWith('whsec_')
    ? opts.secret.slice(6)
    : opts.secret
  let secretBytes: Buffer
  try {
    secretBytes = Buffer.from(cleanSecret, 'base64')
  } catch {
    return false
  }

  const signedPayload = `${opts.svixId}.${opts.svixTimestamp}.${opts.body}`
  const expectedSig = createHmac('sha256', secretBytes)
    .update(signedPayload)
    .digest('base64')

  // Le header peut contenir plusieurs signatures préfixées "v1,"
  const providedSigs = opts.svixSignature
    .split(' ')
    .map(s => s.trim())
    .filter(s => s.startsWith('v1,'))
    .map(s => s.slice(3))

  const expectedBuf = Buffer.from(expectedSig, 'base64')
  for (const provided of providedSigs) {
    let providedBuf: Buffer
    try {
      providedBuf = Buffer.from(provided, 'base64')
    } catch {
      continue
    }
    if (providedBuf.length !== expectedBuf.length) continue
    if (timingSafeEqual(providedBuf, expectedBuf)) return true
  }
  return false
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    log.error('RESEND_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    log.warn('Missing svix headers', {
      hasId: !!svixId,
      hasTimestamp: !!svixTimestamp,
      hasSignature: !!svixSignature,
    })
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 400 })
  }

  // Anti-replay : timestamp doit être dans la fenêtre acceptable.
  const tsSeconds = parseInt(svixTimestamp, 10)
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (Number.isNaN(tsSeconds) || Math.abs(nowSeconds - tsSeconds) > REPLAY_WINDOW_SECONDS) {
    log.warn('Timestamp outside replay window', { tsSeconds, nowSeconds })
    return NextResponse.json({ error: 'Timestamp invalid' }, { status: 400 })
  }

  const body = await request.text()

  if (!verifySvixSignature({
    secret,
    svixId,
    svixTimestamp,
    svixSignature,
    body,
  })) {
    log.warn('Signature verification failed', { svixId })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(body) as ResendEvent
  } catch {
    log.warn('Invalid JSON body')
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Sanitize recipients pour les logs : on garde uniquement le domaine pour
  // ne pas leak les emails complets dans Sentry.
  const recipients = Array.isArray(event.data?.to) ? event.data.to : event.data?.to ? [event.data.to] : []
  const recipientDomains = recipients
    .map(r => r.split('@')[1] ?? 'unknown')
    .filter((v, i, a) => a.indexOf(v) === i) // dédoublonne

  const baseTags = {
    integration: 'resend',
    event_type: event.type,
  }

  switch (event.type) {
    case 'email.bounced': {
      const bounceType = event.data.bounce?.type ?? 'unknown'
      const bounceSubType = event.data.bounce?.sub_type ?? 'unknown'
      // Hard bounces = critical (mauvaise adresse / blacklist), soft = warning
      const isHard = bounceType.toLowerCase() === 'hard' || bounceType.toLowerCase() === 'permanent'
      Sentry.captureMessage(`Resend email bounced (${bounceType}/${bounceSubType})`, {
        level: isHard ? 'error' : 'warning',
        tags: { ...baseTags, bounce_type: bounceType, bounce_sub_type: bounceSubType },
        extra: {
          emailId: event.data.email_id,
          recipientDomains,
          subject: event.data.subject,
          message: event.data.bounce?.message,
        },
      })
      log.warn('Email bounced', {
        type: bounceType,
        subType: bounceSubType,
        emailId: event.data.email_id,
        recipientDomains,
      })
      break
    }

    case 'email.complained': {
      // Spam complaint : très grave pour la réputation domain.
      Sentry.captureMessage('Resend email complaint (spam report)', {
        level: 'error',
        tags: baseTags,
        extra: {
          emailId: event.data.email_id,
          recipientDomains,
          subject: event.data.subject,
          complaintType: event.data.complaint?.type,
        },
      })
      log.error('Email complaint received', {
        emailId: event.data.email_id,
        recipientDomains,
      })
      break
    }

    case 'email.delivery_delayed': {
      Sentry.captureMessage('Resend email delivery delayed', {
        level: 'warning',
        tags: baseTags,
        extra: {
          emailId: event.data.email_id,
          recipientDomains,
          subject: event.data.subject,
        },
      })
      log.info('Email delivery delayed', {
        emailId: event.data.email_id,
        recipientDomains,
      })
      break
    }

    case 'email.sent':
    case 'email.delivered':
      // Pas d'alerting Sentry — juste un log debug pour traçabilité dataflow.
      log.debug('Email event', { type: event.type, emailId: event.data.email_id })
      break

    case 'email.opened':
    case 'email.clicked':
      // Engagement events — pas pertinent pour Sentry. Skip silencieux.
      break

    default:
      log.info('Unhandled Resend event type', { type: event.type })
  }

  return NextResponse.json({ received: true })
}
