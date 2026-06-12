import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId, refreshGmailAccessToken } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentPollGetSchema } from '@/lib/validation'
import { getDecryptedToken, setEncryptedToken } from '@/lib/oauth/tokens'
import type { TablesInsert } from '@/lib/database-types'
import { processIncomingEmail } from '@/lib/syndic/alfredo-pipeline'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'
import { classifyEmailWithGroq } from '@/lib/syndic/alfredo-classify'
import { generateDraftReply } from '@/lib/syndic/alfredo-draft'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'

export const maxDuration = 60

const INTERNAL_TRIGGER_HEADER = 'x-internal-trigger'

// ── Auth interne serveur-à-serveur (webhook Gmail → poll ciblé) ───────────────
// Compare le header x-internal-trigger à INTERNAL_POLL_TOKEN en temps constant
// (timingSafeEqual via nodejs_compat, même pattern que webhooks/resend).
// Token absent/vide côté serveur = refus systématique — jamais d'égalité
// vide==vide. Le check de longueur préalable est requis par timingSafeEqual
// (ne fuit que la longueur, pas le contenu).
function isValidInternalTrigger(provided: string | null): boolean {
  const expected = process.env.INTERNAL_POLL_TOKEN
  if (!provided || !expected) return false
  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false
  return timingSafeEqual(providedBuf, expectedBuf)
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Gmail API payload with deeply nested dynamic structure
function extractBody(payload: Record<string, any>): string {
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

// ── Route principale : appelée par Vercel Cron ou manuellement ────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(err => { logger.warn('[email-agent/poll] Failed to parse request body:', err); return {}; })
    const { syndic_id, first_run = false } = body

    // Si syndic_id fourni → traiter seulement ce syndic
    // Sinon (appel cron) → traiter tous les syndics connectés
    let syndicIds: string[] = []

    if (syndic_id) {
      const internalTrigger = request.headers.get(INTERNAL_TRIGGER_HEADER)
      if (internalTrigger !== null) {
        // Appel interne serveur-à-serveur (webhook Gmail) — pas de cookies.
        // Header présent mais invalide/vide → 401, on ne retombe JAMAIS sur
        // l'auth cookie (pas de fallback silencieux pour un appel machine).
        if (!isValidInternalTrigger(internalTrigger)) {
          logger.warn('[email-agent/poll] x-internal-trigger invalide ou INTERNAL_POLL_TOKEN non configuré')
          return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
        }
        // Token valide → scopé au seul syndic_id transmis par le webhook
        syndicIds = [syndic_id]
      } else {
        // Si syndic_id fourni → vérifier auth utilisateur (cookies)
        const user = await getAuthUser(request)
        if (!user) {
          return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
        }
        // Vérifier que l'utilisateur est bien le syndic ou membre de son cabinet
        if (!isSyndicRole(user) && getUserRole(user) !== 'super_admin') {
          return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
        }
        const userCabinetId = await resolveCabinetId(user, supabaseAdmin)
        if (userCabinetId !== syndic_id && getUserRole(user) !== 'super_admin') {
          return NextResponse.json({ error: 'Accès non autorisé pour ce syndic' }, { status: 403 })
        }
        syndicIds = [syndic_id]
      }
    } else {
      // Appel cron → vérifier clé cron (guard contre CRON_SECRET undefined)
      const cronKey = request.headers.get('x-cron-key')
      const cronSecret = process.env.CRON_SECRET
      if (!cronSecret || cronKey !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const { data: tokens, error: tokensError } = await supabaseAdmin
        .from('syndic_oauth_tokens')
        .select('syndic_id')
      if (tokensError) {
        // TSQ-10 : un échec du SELECT tokens doit être loggé et remonter en
        // erreur — jamais répondre succès sur une liste vide par accident.
        logger.error('[email-agent/poll] Lecture syndic_oauth_tokens échouée:', tokensError)
        return NextResponse.json({ error: 'Une erreur interne est survenue' }, { status: 500 })
      }
      syndicIds = (tokens || []).map((t) => t.syndic_id)
    }

    const results: Record<string, unknown>[] = []

    for (const sid of syndicIds) {
      try {
        // 1. Récupérer les tokens OAuth du syndic — chiffrement applicatif
        // UNIQUEMENT (colonnes access_token_enc/refresh_token_enc, version 2).
        // Plus de fallback sur les colonnes claires legacy (dépréciées).
        // Une erreur DB fait throw getDecryptedToken → catch per-syndic
        // ci-dessous : l'échec est loggé et compté, pas avalé (TSQ-10).
        const decrypted = await getDecryptedToken(supabaseAdmin, sid)
        if (!decrypted?.access_token || !decrypted.refresh_token) {
          // Aucun token exploitable (jamais connecté, ligne legacy v1/null,
          // ou payload indéchiffrable) → re-connexion OAuth requise.
          logger.warn(`[email-agent/poll] Aucun token OAuth déchiffrable pour ${sid} — re-connexion Gmail requise`)
          results.push({ syndic_id: sid, error: 'Token Gmail absent — reconnexion requise' })
          continue
        }
        let accessToken = decrypted.access_token
        const refreshToken = decrypted.refresh_token
        const expiresAt = decrypted.expires_at

        // 2. Rafraîchir le token si expiré (avec 5min de marge)
        const isExpired = expiresAt ? new Date(expiresAt) < new Date(Date.now() + 5 * 60 * 1000) : true
        if (isExpired && refreshToken) {
          const refreshed = await refreshGmailAccessToken(refreshToken)
          if (refreshed) {
            accessToken = refreshed.access_token
            const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
            // Persistance chiffrée uniquement (plus de dual-write plain) —
            // un échec n'interrompt pas le poll : le token frais reste valide
            // en mémoire pour ce run, le prochain run rafraîchira de nouveau.
            try {
              await setEncryptedToken(supabaseAdmin, {
                syndic_id: sid,
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_at: newExpiry,
              })
            } catch (encErr) {
              logger.error(`[email-agent/poll] setEncryptedToken failed for ${sid}:`, encErr)
            }
          } else {
            // Refresh échoué → token révoqué, nettoyer
            const { error: deleteError } = await supabaseAdmin
              .from('syndic_oauth_tokens')
              .delete()
              .eq('syndic_id', sid)
            if (deleteError) {
              logger.error(`[email-agent/poll] Suppression token révoqué échouée pour ${sid}:`, deleteError)
            }
            results.push({ syndic_id: sid, error: 'Token Gmail révoqué — reconnexion requise' })
            continue
          }
        }

        // 3. Récupérer les emails Gmail
        const messages = await fetchGmailMessages(accessToken, 20, first_run)
        let newCount = 0
        let skippedKnown = 0

        // ALF-2 — Idempotence : la requête Gmail (`is:unread`) ne retire jamais
        // le label UNREAD (pas de scope gmail.modify garanti). Sans garde, chaque
        // exécution (cron quotidien + push temps réel) relancerait classifyFn +
        // draftFn (2 appels Groq) sur les MÊMES emails, et l'upsert
        // (onConflict syndic_id,gmail_message_id) écraserait draft_status →
        // 'pending_review', écrasant des brouillons déjà revus. On charge donc en
        // UNE requête les gmail_message_id déjà présents en base pour ce syndic
        // et on saute les messages connus, QUEL QUE SOIT leur statut.
        let knownIds = new Set<string>()
        if (messages.length > 0) {
          const { data: knownRows, error: knownErr } = await supabaseAdmin
            .from('syndic_emails_analysed')
            .select('gmail_message_id')
            .eq('syndic_id', sid)
            .in('gmail_message_id', messages.map((m: { id: string }) => m.id))
          if (knownErr) {
            // Impossible de distinguer connu/nouveau → on ne traite RIEN :
            // retraiter écraserait des brouillons revus. Les messages restent
            // unread, le prochain poll les reprendra.
            logger.error(`[email-agent/poll] Dedup query failed for ${sid}:`, knownErr)
            results.push({ syndic_id: sid, error: 'Erreur de déduplication' })
            continue
          }
          knownIds = new Set(
            (knownRows || []).map((r: { gmail_message_id: string }) => r.gmail_message_id),
          )
        }

        for (const msg of messages) {
          if (knownIds.has(msg.id)) {
            skippedKnown++
            continue
          }
          const headers = extractHeaders(msg.payload?.headers || [])
          const bodyText = extractBody(msg.payload)
          const receivedAt = new Date(parseInt(msg.internalDate)).toISOString()

          // 4. Pipeline Alfredo : classify + context + auto-draft + upsert
          const pipelineResult = await processIncomingEmail({
            syndicId: sid,
            syndicRole: 'syndic',
            locale: 'fr',
            email: {
              from: headers.from,
              subject: headers.subject || '(sans objet)',
              body_text: bodyText,
              gmail_message_id: msg.id,
              received_at: receivedAt,
            },
            classifyFn: classifyEmailWithGroq,
            loadContextFn: (p) => loadClientContext(supabaseAdmin, p),
            draftFn: async (input) => {
              const { sanitized, tokenMap } = sanitizeContextForLLM(input.client_context)
              const raw = await generateDraftReply(
                { ...input, client_context: sanitized as typeof input.client_context },
                input.locale,
              )
              return {
                ...raw,
                subject_suggested:
                  resolveSanitizedToken(raw.subject_suggested, tokenMap) ?? raw.subject_suggested,
                body_text:
                  resolveSanitizedToken(raw.body_text, tokenMap) ?? raw.body_text,
                body_html:
                  resolveSanitizedToken(raw.body_html, tokenMap) ?? raw.body_html,
              }
            },
            insertFn: async (row) => {
              // Le contrat insertFn du pipeline expose Record<string, unknown> ;
              // la ligne est construite par processIncomingEmail avec les champs
              // requis (syndic_id, gmail_message_id…) → rétrécissement vers
              // l'Insert typé de la table (pas un contournement `as any`).
              const insertRow: TablesInsert<'syndic_emails_analysed'> = {
                ...(row as TablesInsert<'syndic_emails_analysed'>),
                gmail_thread_id: (msg.threadId as string | undefined) ?? null,
              }
              const res = await supabaseAdmin
                .from('syndic_emails_analysed')
                .upsert(insertRow, { onConflict: 'syndic_id,gmail_message_id' })
                .select('id')
                .single()
              return { data: res.data ? { id: res.data.id } : null, error: res.error }
            },
          })

          if (pipelineResult.status === 'error') {
            logger.error(`[email-agent/poll] Pipeline error for msg ${msg.id}:`, pipelineResult.error)
          } else {
            newCount++
          }
        }

        if (skippedKnown > 0) {
          logger.info(`[email-agent/poll] ${skippedKnown} message(s) déjà en base skippé(s) pour ${sid}`)
        }

        results.push({
          syndic_id: sid,
          emails_processed: messages.length,
          new_emails: newCount,
          skipped_known: skippedKnown,
        })

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
  if (!isSyndicRole(user) && getUserRole(user) !== 'super_admin') {
    return NextResponse.json({ error: 'Accès réservé aux syndics' }, { status: 403 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const v = validateBody(emailAgentPollGetSchema, params)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })

  const { syndic_id, limit, urgence, statut } = v.data

  if (!syndic_id) return NextResponse.json({ error: 'syndic_id requis' }, { status: 400 })

  // Vérifier que l'utilisateur a accès à ce syndic
  const userCabinetId = await resolveCabinetId(user, supabaseAdmin)
  if (userCabinetId !== syndic_id && getUserRole(user) !== 'super_admin') {
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
