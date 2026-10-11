import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { validateBody, emailAgentPollGetSchema } from '@/lib/validation'
import { getDecryptedToken, setEncryptedToken } from '@/lib/oauth/tokens'
import { processIncomingEmail } from '@/lib/syndic/alfredo-pipeline'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'
import { classifyEmailWithGroq } from '@/lib/syndic/alfredo-classify'
import { generateDraftReply } from '@/lib/syndic/alfredo-draft'
import { sanitizeContextForLLM, resolveSanitizedToken } from '@/lib/ai/sanitize-context'
import {
  ErreurFournisseur,
  fournisseurDeLigne,
  type FournisseurBoite,
  type MessageNormalise,
} from '@/lib/email-agent/fournisseurs'

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

// ── Jetons OAuth du cabinet ──────────────────────────────────────────────────

interface JetonsCabinet {
  provider: string | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: string | null
}

/**
 * Colonnes en clair = source de vérité (provider compris) : l'écriture chiffrée passe par
 * un RPC qui échoue en production. Repli sur les colonnes chiffrées pour une ligne Gmail
 * sans jetons en clair (lignes antérieures au double enregistrement).
 */
async function lireJetonsCabinet(sid: string): Promise<JetonsCabinet> {
  const { data: ligne } = await supabaseAdmin
    .from('syndic_oauth_tokens')
    .select('provider, access_token, refresh_token, token_expiry')
    .eq('syndic_id', sid)
    .single()
  const jetons: JetonsCabinet = {
    provider: ligne?.provider || null,
    accessToken: ligne?.access_token || null,
    refreshToken: ligne?.refresh_token || null,
    expiresAt: ligne?.token_expiry || null,
  }
  if ((!jetons.accessToken || !jetons.refreshToken) && (!jetons.provider || jetons.provider === 'gmail')) {
    const chiffres = await getDecryptedToken(supabaseAdmin, sid).catch(() => null)
    if (chiffres) {
      jetons.accessToken = chiffres.access_token
      jetons.refreshToken = chiffres.refresh_token
      jetons.expiresAt = chiffres.expires_at
    }
  }
  return jetons
}

/**
 * Jeton d'accès utilisable : rafraîchi par le fournisseur s'il expire dans moins de 5 min.
 * Microsoft renvoie un nouveau refresh_token à chaque rafraîchissement : il est rangé.
 * Lève ErreurFournisseur si le rafraîchissement est refusé.
 */
async function jetonAccesValide(
  sid: string,
  fournisseur: FournisseurBoite,
  jetons: { accessToken: string; refreshToken: string; expiresAt: string | null },
): Promise<string> {
  const expire = jetons.expiresAt ? new Date(jetons.expiresAt) < new Date(Date.now() + 5 * 60 * 1000) : true
  if (!expire) return jetons.accessToken

  const nouveaux = await fournisseur.rafraichir(jetons.refreshToken)
  // Double écriture : chiffrée (non bloquante) + colonnes en clair.
  try {
    await setEncryptedToken(supabaseAdmin, {
      syndic_id: sid,
      access_token: nouveaux.accessToken,
      refresh_token: nouveaux.refreshToken || jetons.refreshToken,
      expires_at: nouveaux.expiresAt,
    })
  } catch (encErr) {
    logger.error(`[email-agent/poll] setEncryptedToken failed for ${sid}:`, encErr)
  }
  const maj: Record<string, unknown> = {
    access_token: nouveaux.accessToken,
    token_expiry: nouveaux.expiresAt,
    updated_at: new Date().toISOString(),
  }
  if (nouveaux.refreshToken) maj.refresh_token = nouveaux.refreshToken
  const { error: majErr } = await supabaseAdmin
    .from('syndic_oauth_tokens')
    .update(maj)
    .eq('syndic_id', sid)
  if (majErr) {
    logger.error(`[email-agent/poll] enregistrement du jeton rafraîchi impossible pour ${sid}`, { erreur: majErr.message })
  }
  return nouveaux.accessToken
}

/** E-mails analysés en parallèle (2 appels IA chacun : classification + brouillon). */
const PIPELINE_PARALLELE = 4
/** Au-delà, les lots suivants attendent la relève suivante (réponse avant les 100 s de Cloudflare). */
const BUDGET_PIPELINE_MS = 45_000

/**
 * Pipeline Alfredo pour un e-mail : classification, contexte client, brouillon (jamais
 * envoyé) et enregistrement (upsert syndic_id + gmail_message_id). Vrai si l'e-mail est
 * enregistré (brouillon préparé ou spam classé).
 */
async function analyserMessage(sid: string, msg: MessageNormalise): Promise<boolean> {
  const pipelineResult = await processIncomingEmail({
    syndicId: sid,
    syndicRole: 'syndic',
    locale: 'fr',
    email: {
      from: msg.from,
      subject: msg.subject || '(sans objet)',
      body_text: msg.bodyText,
      gmail_message_id: msg.id,
      received_at: msg.receivedAt,
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
      const res = await supabaseAdmin
        .from('syndic_emails_analysed')
        .upsert(
          { ...row, gmail_thread_id: msg.threadId },
          { onConflict: 'syndic_id,gmail_message_id' },
        )
        .select('id')
        .single()
      return { data: res.data ? { id: res.data.id } : null, error: res.error }
    },
  })

  if (pipelineResult.status === 'error') {
    logger.error(`[email-agent/poll] Pipeline error for msg ${msg.id}:`, pipelineResult.error)
    return false
  }
  return true
}

/** Détail journalisable d'une erreur de fournisseur (code + réponse, jamais de jeton). */
function detailErreur(err: unknown): Record<string, unknown> {
  if (err instanceof ErreurFournisseur) return { code: err.code, ...err.details }
  return { erreur: err instanceof Error ? err.message : String(err) }
}

// ── Route principale : appelée par le cron, le webhook Gmail ou le tableau de bord ──
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
        // Appel interne serveur-à-serveur (webhook Gmail, retour OAuth) — pas de cookies.
        // Header présent mais invalide/vide → 401, on ne retombe JAMAIS sur
        // l'auth cookie (pas de fallback silencieux pour un appel machine).
        if (!isValidInternalTrigger(internalTrigger)) {
          logger.warn('[email-agent/poll] x-internal-trigger invalide ou INTERNAL_POLL_TOKEN non configuré')
          return NextResponse.json({ error: 'Authentification requise' }, { status: 401 })
        }
        // Token valide → scopé au seul syndic_id transmis
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

      const { data: tokens } = await supabaseAdmin
        .from('syndic_oauth_tokens')
        .select('syndic_id')
      syndicIds = (tokens || []).map((t: { syndic_id: string }) => t.syndic_id)
    }

    const results: Record<string, unknown>[] = []

    for (const sid of syndicIds) {
      try {
        // 1. Jetons OAuth et fournisseur de la boîte du cabinet
        const jetons = await lireJetonsCabinet(sid)
        if (!jetons.accessToken || !jetons.refreshToken) continue

        const fournisseur = fournisseurDeLigne(jetons.provider)
        if (!fournisseur) {
          logger.error(`[email-agent/poll] fournisseur de boîte inconnu pour ${sid}`, { provider: jetons.provider })
          results.push({ syndic_id: sid, provider: jetons.provider, error: 'Fournisseur de boîte non pris en charge' })
          continue
        }

        // 2. Rafraîchir le jeton si expiré (5 min de marge). En cas d'échec, la ligne
        // n'est PAS supprimée : une suppression déconnectait la boîte sans prévenir
        // (en pleine démonstration) ; le cabinet reçoit une erreur et reconnecte.
        let accessToken: string
        try {
          accessToken = await jetonAccesValide(sid, fournisseur, {
            accessToken: jetons.accessToken,
            refreshToken: jetons.refreshToken,
            expiresAt: jetons.expiresAt,
          })
        } catch (refreshErr) {
          logger.error(`[email-agent/poll] rafraîchissement du jeton ${fournisseur.id} refusé pour ${sid}`, detailErreur(refreshErr))
          results.push({
            syndic_id: sid,
            provider: fournisseur.id,
            code: 'refresh_failed',
            error: 'Connexion à la boîte e-mail expirée : reconnectez la boîte',
          })
          continue
        }

        // 3. Relève de la boîte de réception (lus ou non, 20 au plus)
        let messages: MessageNormalise[]
        try {
          messages = await fournisseur.recupererMessages(accessToken, { premiereReleve: Boolean(first_run) })
        } catch (lectureErr) {
          logger.error(`[email-agent/poll] relève ${fournisseur.id} impossible pour ${sid}`, detailErreur(lectureErr))
          results.push({
            syndic_id: sid,
            provider: fournisseur.id,
            code: lectureErr instanceof ErreurFournisseur ? lectureErr.code : 'lecture_impossible',
            error: 'Lecture de la boîte e-mail impossible',
          })
          continue
        }

        // ALF-2 — Idempotence : la relève lit la boîte de réception, e-mails lus OU NON
        // (un gestionnaire lit son courrier : « non lus » ne montrerait rien), et rien ne
        // marque un e-mail comme traité chez le fournisseur (accès en lecture seule).
        // Sans garde, chaque exécution (cron + push temps réel + « Analyser maintenant »)
        // relancerait classifyFn + draftFn (2 appels IA) sur les MÊMES e-mails, et
        // l'upsert (onConflict syndic_id,gmail_message_id) écraserait draft_status →
        // 'pending_review', écrasant des brouillons déjà revus. On charge donc en UNE
        // requête les identifiants déjà présents en base pour ce syndic (colonne
        // gmail_message_id, quel que soit le fournisseur) et on saute les messages
        // connus, QUEL QUE SOIT leur statut.
        let knownIds = new Set<string>()
        if (messages.length > 0) {
          const { data: knownRows, error: knownErr } = await supabaseAdmin
            .from('syndic_emails_analysed')
            .select('gmail_message_id')
            .eq('syndic_id', sid)
            .in('gmail_message_id', messages.map(m => m.id))
          if (knownErr) {
            // Impossible de distinguer connu/nouveau → on ne traite RIEN :
            // retraiter écraserait des brouillons revus. Le prochain poll les reprendra.
            logger.error(`[email-agent/poll] Dedup query failed for ${sid}:`, knownErr)
            results.push({ syndic_id: sid, error: 'Erreur de déduplication' })
            continue
          }
          knownIds = new Set(
            (knownRows || []).map((r: { gmail_message_id: string }) => r.gmail_message_id),
          )
        }

        const nouveaux = messages.filter(m => !knownIds.has(m.id))
        const skippedKnown = messages.length - nouveaux.length

        // 4. Pipeline Alfredo (classify + context + auto-draft + upsert), par lots
        // parallèles et dans un budget de temps : une première relève (jusqu'à 20 e-mails,
        // 2 appels IA chacun) répond avant le délai de la passerelle Cloudflare (100 s). Les
        // e-mails non traités dans le budget le seront à la relève suivante (dédup).
        const debutPipeline = Date.now()
        let newCount = 0
        let reportes = 0
        for (let i = 0; i < nouveaux.length; i += PIPELINE_PARALLELE) {
          if (Date.now() - debutPipeline > BUDGET_PIPELINE_MS) {
            reportes = nouveaux.length - i
            logger.warn(`[email-agent/poll] budget de temps atteint pour ${sid} : ${reportes} e-mail(s) reporté(s) à la relève suivante`)
            break
          }
          const lot = nouveaux.slice(i, i + PIPELINE_PARALLELE)
          const reussites = await Promise.all(lot.map(msg => analyserMessage(sid, msg)))
          newCount += reussites.filter(Boolean).length
        }

        if (skippedKnown > 0) {
          logger.info(`[email-agent/poll] ${skippedKnown} message(s) déjà en base skippé(s) pour ${sid}`)
        }

        results.push({
          syndic_id: sid,
          provider: fournisseur.id,
          emails_processed: messages.length,
          new_emails: newCount,
          skipped_known: skippedKnown,
          deferred: reportes,
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
