import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { callGroqWithRetry } from '@/lib/groq'
import { getAuthUser, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import type { EmailClassification } from '../classify/route'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentPollGetSchema } from '@/lib/validation'

export const maxDuration = 60

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || ''

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

// ── Lit les emails Gmail via l'API ────────────────────────────────────────────
async function fetchGmailMessages(accessToken: string, maxResults = 20, firstRun = false) {
  // On récupère les emails non lus des 7 derniers jours (ou 30 si premier run)
  const daysBack = firstRun ? 30 : 7
  const after = Math.floor((Date.now() - daysBack * 86400 * 1000) / 1000)
  const query = `is:unread after:${after}`

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!listRes.ok) {
    const err = await listRes.text()
    logger.error('Gmail list error:', listRes.status, err)
    return []
  }

  const listData = await listRes.json()
  const messages = listData.messages || []

  // Récupérer le détail de chaque message (en parallèle, max 10 à la fois)
  const details = await Promise.all(
    messages.slice(0, 20).map(async (msg: { id: string; threadId: string }) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      if (!msgRes.ok) return null
      return msgRes.json()
    })
  )

  return details.filter(Boolean)
}

// ── Extrait les headers d'un message Gmail ────────────────────────────────────
function extractHeaders(headers: { name: string; value: string }[]) {
  const get = (name: string) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || ''
  return {
    from: get('From'),
    to: get('To'),
    subject: get('Subject'),
    date: get('Date'),
  }
}

// ── Extrait le corps texte d'un message Gmail ─────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gmail API payload with dynamic nested structure
function extractBody(payload: any): string {
  if (!payload) return ''

  // Message simple
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8').substring(0, 1000)
  }

  // Message multipart — chercher text/plain en priorité
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8').substring(0, 1000)
      }
    }
    // Fallback sur text/html
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        const html = Buffer.from(part.body.data, 'base64url').toString('utf-8')
        // Nettoyer le HTML basiquement
        return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 1000)
      }
    }
  }

  return ''
}

// ── Classification IA via Groq (avec retry 429 + fallback) ──────────────────
async function classifyEmail(from: string, subject: string, body: string): Promise<EmailClassification> {
  const SYSTEM_PROMPT = `Tu es Max, assistant IA expert en gestion de copropriété pour Vitfix Pro.
Analyse cet email reçu par un syndic et retourne UNIQUEMENT un objet JSON valide, sans markdown.

Format JSON strict :
{
  "urgence": "haute" | "moyenne" | "basse",
  "type": "signalement_panne" | "demande_devis" | "reclamation" | "ag" | "facturation" | "resiliation" | "information" | "autre",
  "resume": "Résumé clair en 1 phrase (15 mots max)",
  "immeuble_detecte": "Nom immeuble si mentionné ou null",
  "locataire_detecte": "Prénom Nom expéditeur/résident concerné ou null",
  "actions_suggerees": ["Action 1", "Action 2"],
  "reponse_suggeree": "Brouillon réponse professionnelle 2-3 phrases ou null"
}

Urgence haute : fuite, inondation, incendie, panne ascenseur bloqué, coupure gaz/électricité, odeur gaz, sécurité.
Urgence moyenne : réclamation, panne non bloquante, devis urgent, problème en cours.
Urgence basse : information, AG planifiée, document admin, devis futur.`

  if (!process.env.GROQ_API_KEY) return getFallback(subject, body)

  try {
    const data = await callGroqWithRetry({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `De : ${from}\nObjet : ${subject}\nCorps :\n${body.substring(0, 600)}` },
      ],
      temperature: 0.1,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }, { fallbackModel: 'llama-3.1-8b-instant' })

    const rawContent = data.choices?.[0]?.message?.content || '{}'
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawContent)
    } catch (parseErr) {
      logger.error('[email-agent] JSON.parse failed on AI response:', rawContent.substring(0, 200), parseErr)
      return getFallback(subject, body)
    }

    return {
      urgence: (['haute', 'moyenne', 'basse'] as const).includes(parsed.urgence as 'haute' | 'moyenne' | 'basse') ? (parsed.urgence as 'haute' | 'moyenne' | 'basse') : 'basse',
      type: (['signalement_panne', 'demande_devis', 'reclamation', 'ag', 'facturation', 'resiliation', 'information', 'autre'] as const).includes(parsed.type as 'autre') ? (parsed.type as 'autre') : 'autre',
      resume: (parsed.resume as string) || subject.substring(0, 80),
      immeuble_detecte: (parsed.immeuble_detecte as string) || null,
      locataire_detecte: (parsed.locataire_detecte as string) || null,
      actions_suggerees: Array.isArray(parsed.actions_suggerees) ? (parsed.actions_suggerees as string[]).slice(0, 3) : ['Répondre à l\'expéditeur'],
      reponse_suggeree: (parsed.reponse_suggeree as string) || null,
    }
  } catch (classifyErr) {
    logger.error('[email-agent] classifyEmail error for subject:', subject.substring(0, 60), classifyErr)
    return getFallback(subject, body)
  }
}

function getFallback(subject: string, body: string): EmailClassification {
  const text = (subject + ' ' + body).toLowerCase()
  const isUrgent = ['fuite', 'inondation', 'incendie', 'panne', 'bloqué', 'coupure', 'gaz', 'urgent'].some(k => text.includes(k))
  const isMoyen = ['réclamation', 'plainte', 'problème', 'devis'].some(k => text.includes(k))
  return {
    urgence: isUrgent ? 'haute' : isMoyen ? 'moyenne' : 'basse',
    type: ['fuite', 'panne', 'dégât'].some(k => text.includes(k)) ? 'signalement_panne' :
          ['ag', 'assemblée', 'convocation'].some(k => text.includes(k)) ? 'ag' :
          ['facture', 'paiement'].some(k => text.includes(k)) ? 'facturation' : 'autre',
    resume: subject.substring(0, 80),
    immeuble_detecte: null,
    locataire_detecte: null,
    actions_suggerees: ['Répondre à l\'expéditeur', 'Archiver'],
    reponse_suggeree: null,
  }
}

// ── Route principale : appelée par Vercel Cron ou manuellement ────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(err => { logger.warn('[email-agent/poll] Failed to parse request body:', err); return {}; })
    const { syndic_id, first_run = false } = body

    // Si syndic_id fourni → traiter seulement ce syndic
    // Sinon (appel cron) → traiter tous les syndics connectés
    let syndicIds: string[] = []

    if (syndic_id) {
      // Si syndic_id fourni → vérifier auth utilisateur
      const user = await getAuthUser(request)
      if (!user) {
        return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
      }
      // Vérifier que l'utilisateur est bien le syndic ou membre de son cabinet
      if (!isSyndicRole(user) && user.user_metadata?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
      }
      const userCabinetId = await resolveCabinetId(user, supabaseAdmin)
      if (userCabinetId !== syndic_id && user.user_metadata?.role !== 'super_admin') {
        return NextResponse.json({ error: 'Accès non autorisé pour ce syndic' }, { status: 403 })
      }
      syndicIds = [syndic_id]
    } else {
      // Appel cron → vérifier clé cron (guard contre CRON_SECRET undefined)
      const cronKey = request.headers.get('x-cron-key')
      const cronSecret = process.env.CRON_SECRET
      if (!cronSecret || cronKey !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: tokens } = await supabaseAdmin
        .from('syndic_oauth_tokens')
        .select('syndic_id')
      syndicIds = (tokens || []).map((t: any) => t.syndic_id)
    }

    const results: any[] = []

    for (const sid of syndicIds) {
      try {
        // 1. Récupérer les tokens OAuth du syndic
        const { data: tokenRow } = await supabaseAdmin
          .from('syndic_oauth_tokens')
          .select('*')
          .eq('syndic_id', sid)
          .single()

        if (!tokenRow) continue

        let accessToken = tokenRow.access_token

        // 2. Rafraîchir le token si expiré (avec 5min de marge)
        const isExpired = new Date(tokenRow.token_expiry) < new Date(Date.now() + 5 * 60 * 1000)
        if (isExpired && tokenRow.refresh_token) {
          const refreshed = await refreshAccessToken(tokenRow.refresh_token)
          if (refreshed) {
            accessToken = refreshed.access_token
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
            await supabaseAdmin
              .from('syndic_oauth_tokens')
              .update({ access_token: accessToken, token_expiry: newExpiry, updated_at: new Date().toISOString() })
              .eq('syndic_id', sid)
          } else {
            // Refresh échoué → token révoqué, nettoyer
            await supabaseAdmin.from('syndic_oauth_tokens').delete().eq('syndic_id', sid)
            continue
          }
        }

        // 3. Récupérer les emails Gmail
        const messages = await fetchGmailMessages(accessToken, 20, first_run)
        let newCount = 0

        for (const msg of messages) {
          // Vérifier si déjà analysé
          const { data: existing } = await supabaseAdmin
            .from('syndic_emails_analysed')
            .select('id')
            .eq('syndic_id', sid)
            .eq('gmail_message_id', msg.id)
            .single()

          if (existing) continue // Déjà traité

          const headers = extractHeaders(msg.payload?.headers || [])
          const bodyText = extractBody(msg.payload)
          const receivedAt = new Date(parseInt(msg.internalDate)).toISOString()

          // 4. Classifier via Groq IA
          const classification = await classifyEmail(headers.from, headers.subject, bodyText)

          // 5. Stocker dans Supabase
          await supabaseAdmin.from('syndic_emails_analysed').insert({
            syndic_id: sid,
            gmail_message_id: msg.id,
            gmail_thread_id: msg.threadId,
            from_email: headers.from,
            from_name: headers.from.replace(/<.*>/, '').trim(),
            to_email: headers.to,
            subject: headers.subject || '(sans objet)',
            body_preview: bodyText.substring(0, 500),
            received_at: receivedAt,
            urgence: classification.urgence,
            type_demande: classification.type,
            resume_ia: classification.resume,
            immeuble_detecte: classification.immeuble_detecte,
            locataire_detecte: classification.locataire_detecte,
            actions_suggerees: JSON.stringify(classification.actions_suggerees),
            reponse_suggeree: classification.reponse_suggeree,
            statut: 'nouveau',
          })

          newCount++
        }

        results.push({ syndic_id: sid, emails_processed: messages.length, new_emails: newCount })

      } catch (syndicErr: unknown) {
        logger.error(`[email-agent/poll] Error for syndic ${sid}:`, syndicErr)
        results.push({ syndic_id: sid, error: 'Erreur de traitement' })
      }
    }

    return NextResponse.json({ success: true, results, polled_at: new Date().toISOString() })

  } catch (err: unknown) {
    logger.error('[email-agent/poll] Error:', err)
    return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
  }
}

// ── GET : récupérer les emails analysés d'un syndic (authentifié) ────────────
export async function GET(request: NextRequest) {
  // ── Auth obligatoire ──────────────────────────────────────────────────────
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
  }
  if (!isSyndicRole(user) && user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const v = validateBody(emailAgentPollGetSchema, params)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { syndic_id, limit, urgence, statut } = v.data

  if (!syndic_id) return NextResponse.json({ error: 'syndic_id requis' }, { status: 400 })

  // Vérifier que l'utilisateur a accès à ce syndic
  const userCabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (userCabinetId !== syndic_id && user.user_metadata?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Accès non autorisé pour ce syndic' }, { status: 403 })
  }

  let query = supabaseAdmin
    .from('syndic_emails_analysed')
    .select('*')
    .eq('syndic_id', syndic_id)
    .order('received_at', { ascending: false })
    .limit(limit)

  if (urgence) query = query.eq('urgence', urgence)
  if (statut) query = query.eq('statut', statut)

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })

  return NextResponse.json({ emails: data || [] })
}
