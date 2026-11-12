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
//
// AJ Signalement, PR 3, lot 9 (décisions F7 et H13), sans changement pour les autres e-mails :
//   - étiquettes lues dans data.tags (objet clé → valeur selon la documentation de Resend, relue le 12/11/2026) ;
//   - plainte (email.complained) sur un message étiqueté type=aj-diffusion → opposition « plainte » du destinataire
//     (lib/aj-signalement/webhook-diffusion.ts) ; base indisponible → 503 pour que Resend réessaie ;
//   - rebond : aucune opposition (Resend écarte déjà l'adresse) ; sous-type lu dans bounce.subType (champ documenté ;
//     l'ancien bounce.sub_type n'existe pas dans les événements de Resend).
// PR 3, relecture 3 (cahier § 8.2, « Journalisation » : Sentry ne reçoit jamais d'adresse, d'objet ni de texte) : pour
// un e-mail d'AJ Signalement (étiquette type aj-signalement… ou aj-diffusion…), les alertes Sentry ne portent ni
// l'objet ni le texte du rebond (souvent « 550 5.1.1 <adresse> ») ; identifiant, domaines et type de rebond restent.
// Les autres e-mails de VitFix sont inchangés.

import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { logger } from '@/lib/logger'
import { emailAjSignalementQr, traiterPlainteDiffusionQr } from '@/lib/aj-signalement/webhook-diffusion'

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
    // Documentation de Resend (événement email.bounced) : type (Permanent, Temporary), subType (Suppressed,
    // MessageRejected…), message, diagnosticCode (réponses SMTP).
    bounce?: { type?: string; subType?: string; message?: string; diagnosticCode?: unknown }
    complaint?: { type?: string; user_agent?: string }
    // Étiquettes posées à l'envoi : objet { nom: valeur } dans les événements (forme tableau tolérée par la lecture).
    tags?: unknown
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

  // AJ Signalement : ni objet ni texte du rebond dans Sentry (voir l'en-tête) ; autres e-mails : inchangé.
  const ajSignalement = emailAjSignalementQr(event.data?.tags)
  const objet = ajSignalement ? {} : { subject: event.data.subject }

  switch (event.type) {
    case 'email.bounced': {
      const bounceType = event.data.bounce?.type ?? 'unknown'
      const bounceSubType = event.data.bounce?.subType ?? 'unknown'
      // Hard bounces = critical (mauvaise adresse / blacklist), soft = warning
      const isHard = bounceType.toLowerCase() === 'hard' || bounceType.toLowerCase() === 'permanent'
      Sentry.captureMessage(`Resend email bounced (${bounceType}/${bounceSubType})`, {
        level: isHard ? 'error' : 'warning',
        tags: { ...baseTags, bounce_type: bounceType, bounce_sub_type: bounceSubType },
        extra: {
          emailId: event.data.email_id,
          recipientDomains,
          ...objet,
          ...(ajSignalement ? {} : { message: event.data.bounce?.message }),
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
          ...objet,
          complaintType: event.data.complaint?.type,
        },
      })
      log.error('Email complaint received', {
        emailId: event.data.email_id,
        recipientDomains,
      })
      // AJ Signalement (H13) : une plainte sur un message de diffusion vaut opposition ; les autres e-mails ne sont pas
      // touchés. Base indisponible : 503, Resend renvoie l'événement (l'opposition est idempotente).
      const plainte = await traiterPlainteDiffusionQr(event.data.tags)
      if (plainte === 'erreur') return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 })
      break
    }

    case 'email.delivery_delayed': {
      Sentry.captureMessage('Resend email delivery delayed', {
        level: 'warning',
        tags: baseTags,
        extra: {
          emailId: event.data.email_id,
          recipientDomains,
          ...objet,
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
      // Pas d'alerting Sentry — juste un log info pour traçabilité dataflow.
      // (logger.withTenant n'expose pas debug, on utilise info verbose).
      log.info('Email event', { type: event.type, emailId: event.data.email_id })
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
