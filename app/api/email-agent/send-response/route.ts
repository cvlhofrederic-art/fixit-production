import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { validateBody } from '@/lib/validation'

const sendResponseSchema = z.object({
  email_id: z.string().uuid('email_id doit être un UUID'),
  response_text: z.string().min(1, 'Le texte de réponse est requis').max(10000),
  syndic_id: z.string().uuid('syndic_id doit être un UUID'),
})

// ── Rafraîchit un access_token Gmail expiré ───────────────────────────────────
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  return res.json()
}

// ── Construit un message RFC 2822 en base64url ────────────────────────────────
function buildRawMessage(opts: {
  from: string
  to: string
  subject: string
  body: string
  inReplyTo?: string
  references?: string
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject.startsWith('Re: ') ? opts.subject : `Re: ${opts.subject}`}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
  ]

  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`)
    lines.push(`References: ${opts.references || opts.inReplyTo}`)
  }

  lines.push('', opts.body)

  const raw = lines.join('\r\n')
  // Base64url encode (no padding)
  return Buffer.from(raw, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// POST /api/email-agent/send-response — envoyer une réponse validée via Gmail API
export async function POST(request: NextRequest) {
  const ip = getClientIP(request)
  if (!(await checkRateLimit(`email_send_${ip}`, 10, 60_000))) return rateLimitResponse()

  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Authentification syndic requise' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
  }

  const validation = validateBody(sendResponseSchema, body)
  if (!validation.success) {
    return NextResponse.json({ error: 'Données invalides', details: validation.error }, { status: 400 })
  }
  const { email_id, response_text, syndic_id } = validation.data

  // Vérifier que le syndic_id correspond au cabinet de l'utilisateur
  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (!cabinetId || (cabinetId !== syndic_id && user.id !== syndic_id)) {
    return NextResponse.json({ error: 'Accès non autorisé à ce cabinet' }, { status: 403 })
  }

  try {
    // 1. Fetch l'email analysé
    const { data: email, error: emailError } = await supabaseAdmin
      .from('syndic_emails_analysed')
      .select('id, gmail_message_id, gmail_thread_id, from_email, subject, statut, syndic_id')
      .eq('id', email_id)
      .eq('syndic_id', syndic_id)
      .single()

    if (emailError || !email) {
      return NextResponse.json({ error: 'Email non trouvé' }, { status: 404 })
    }

    if (email.statut === 'repondu') {
      return NextResponse.json({ error: 'Cet email a déjà reçu une réponse' }, { status: 409 })
    }

    // 2. Fetch le token OAuth Gmail
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from('syndic_oauth_tokens')
      .select('access_token, refresh_token, token_expiry, email_compte')
      .eq('syndic_id', syndic_id)
      .eq('provider', 'gmail')
      .single()

    if (tokenError || !tokenRow?.access_token) {
      return NextResponse.json({ error: 'Compte Gmail non connecté. Connectez votre Gmail dans les paramètres.' }, { status: 400 })
    }

    // 3. Refresh token si expiré (marge de 5 min)
    let accessToken = tokenRow.access_token
    const isExpired = new Date(tokenRow.token_expiry) < new Date(Date.now() + 5 * 60 * 1000)
    if (isExpired && tokenRow.refresh_token) {
      const refreshed = await refreshAccessToken(tokenRow.refresh_token)
      if (refreshed?.access_token) {
        accessToken = refreshed.access_token
        const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
        await supabaseAdmin
          .from('syndic_oauth_tokens')
          .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
          .eq('syndic_id', syndic_id)
      } else {
        return NextResponse.json({ error: 'Token Gmail expiré et impossible à rafraîchir. Reconnectez votre compte Gmail.' }, { status: 401 })
      }
    }

    // 4. Construire le message RFC 2822
    const messageId = email.gmail_message_id ? `<${email.gmail_message_id}>` : undefined
    const rawMessage = buildRawMessage({
      from: tokenRow.email_compte,
      to: email.from_email,
      subject: email.subject || '(Sans objet)',
      body: response_text,
      inReplyTo: messageId,
      references: messageId,
    })

    // 5. Envoyer via Gmail API
    const sendPayload: { raw: string; threadId?: string } = { raw: rawMessage }
    if (email.gmail_thread_id) {
      sendPayload.threadId = email.gmail_thread_id
    }

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPayload),
    })

    if (!sendRes.ok) {
      const errData = await sendRes.json().catch(() => ({}))
      logger.error('[email-agent/send-response] Gmail send error', {
        status: sendRes.status,
        error: errData?.error?.message || 'Unknown',
        email_id,
      })
      return NextResponse.json({
        error: `Erreur Gmail: ${errData?.error?.message || 'Impossible d\'envoyer l\'email'}`,
      }, { status: 502 })
    }

    // 6. Mettre à jour le statut dans Supabase
    await supabaseAdmin
      .from('syndic_emails_analysed')
      .update({
        statut: 'repondu',
        response_sent: response_text,
        response_sent_at: new Date().toISOString(),
        response_approved_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', email_id)

    logger.info('[email-agent/send-response] Response sent successfully', {
      email_id,
      syndic_id,
      to: email.from_email,
    })

    return NextResponse.json({ success: true, message: 'Réponse envoyée avec succès' })
  } catch (error) {
    logger.error('[email-agent/send-response] Error:', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}
