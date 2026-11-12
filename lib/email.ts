import { Resend } from 'resend'
import { z } from 'zod'
import { NOREPLY_EMAIL } from '@/lib/constants'
import { logger } from '@/lib/logger'

// ── Lazy singleton Resend client (avoid crash if RESEND_API_KEY not set at build time) ──
let _resend: Resend | null = null
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder')
  }
  return _resend
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface EmailAttachment {
  filename: string
  content: string // base64-encoded
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  tags?: { name: string; value: string }[]
  attachments?: EmailAttachment[]
  /** En-têtes ajoutés au message (ex. List-Unsubscribe, RFC 8058) ; absents : rien n'est transmis. */
  headers?: Record<string, string>
  /** Version texte du même contenu (délivrabilité) ; absente : rien n'est transmis. */
  text?: string
}

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
}

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || `VITFIX <${NOREPLY_EMAIL}>`

/** En-têtes et version texte, seulement quand l'appelant les fournit : les messages d'avant restent identiques. */
function enTetesEtTexte(payload: EmailPayload): { headers?: Record<string, string>; text?: string } {
  return {
    ...(payload.headers === undefined ? {} : { headers: { ...payload.headers } }),
    ...(payload.text === undefined ? {} : { text: payload.text }),
  }
}

/** Un message du lot de Resend (le lot n'accepte pas de pièces jointes : elles ne sont pas transmises). */
function messageDeLot(e: EmailPayload) {
  return {
    from: e.from || DEFAULT_FROM,
    to: Array.isArray(e.to) ? e.to : [e.to],
    subject: e.subject,
    html: e.html,
    replyTo: e.replyTo,
    tags: e.tags,
    ...enTetesEtTexte(e),
  }
}

// ── Send single email ────────────────────────────────────────────────────────
export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — email not sent')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { data, error } = await getResend().emails.send({
      from: payload.from || DEFAULT_FROM,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      replyTo: payload.replyTo,
      tags: payload.tags,
      ...enTetesEtTexte(payload),
      ...(payload.attachments && payload.attachments.length > 0 ? {
        attachments: payload.attachments.map(a => ({ filename: a.filename, content: a.content })),
      } : {}),
    })

    if (error) {
      console.error('[email] Resend error:', error)
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (err: any) {
    console.error('[email] Send failed:', err?.message || err)
    return { success: false, error: err?.message || 'Unknown error' }
  }
}

// ── Send batch emails (max 100 per call) ─────────────────────────────────────
export async function sendBatchEmails(emails: EmailPayload[]): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!process.env.RESEND_API_KEY) {
    return { sent: 0, failed: emails.length, errors: ['RESEND_API_KEY not configured'] }
  }

  const results = { sent: 0, failed: 0, errors: [] as string[] }

  // Resend batch API supports up to 100 emails
  const chunks = []
  for (let i = 0; i < emails.length; i += 100) {
    chunks.push(emails.slice(i, i + 100))
  }

  for (const chunk of chunks) {
    try {
      const { data, error } = await getResend().batch.send(chunk.map(messageDeLot))

      if (error) {
        results.failed += chunk.length
        results.errors.push(error.message)
      } else {
        results.sent += data?.data?.length || chunk.length
      }
    } catch (err: any) {
      results.failed += chunk.length
      results.errors.push(err?.message || 'Batch send failed')
    }
  }

  return results
}

// ── Envoi d'UN lot détaillé (diffusion AJ Signalement, SPEC diffusion § 5.1, § 5.5) ──
// Différences avec sendBatchEmails (inchangé) : un seul appel (100 messages au plus, une clé d'idempotence pour le
// lot), mode de validation choisi (« permissive » par défaut : un message refusé n'empêche pas les autres), délai
// borné, et un résultat fait seulement d'indices et de codes. Le texte des erreurs de Resend n'est jamais rendu ni
// journalisé : il peut citer une adresse.

/** Délai d'attente de la réponse de Resend pour un lot (le SDK n'en a aucun). */
export const DELAI_LOT_EMAIL_MS = 15_000

/** Taille maximale d'un lot chez Resend (resend.com/docs/api-reference/emails/send-batch-emails). */
const TAILLE_LOT_EMAIL_MAX = 100

/**
 * Code d'un échec global du lot :
 * - `reseau` : issue inconnue (aucune réponse, délai dépassé, exception, statut 5xx, réponse 2xx illisible ou
 *   incohérente) ; le rejeu avec la même clé est sûr (Resend rend la réponse d'origine sans renvoyer) ;
 * - `limite` : limite de débit (`rate_limit_exceeded`, 429) ;
 * - `quota` : quota journalier ou mensuel atteint (`daily_quota_exceeded`, `monthly_quota_exceeded`) ;
 * - `rejeu_refuse` : clé déjà employée avec un autre contenu (`invalid_idempotent_request`, 409) ;
 * - `rejeu_concurrent` : la même clé est en cours de traitement (`concurrent_idempotent_requests`, 409) ;
 * - `refus` : tout autre refus du lot (4xx), ou refus local avant tout appel.
 */
export type CodeEchecLotEmail = 'reseau' | 'limite' | 'quota' | 'rejeu_refuse' | 'rejeu_concurrent' | 'refus'

export interface OptionsLotEmailDetaille {
  /** Clé d'idempotence du lot (en-tête Idempotency-Key) : 1 à 256 caractères ASCII visibles ; valable 24 h chez Resend. */
  idempotencyKey: string
  /** En-tête x-batch-validation ; « permissive » par défaut. */
  validation?: 'permissive' | 'strict'
  /** Délai d'attente en millisecondes ; absent ou invalide : DELAI_LOT_EMAIL_MS. */
  delaiMs?: number
}

export type ResultatLotEmailDetaille =
  /** Lot traité : indices (dans `messages`, croissants) des messages acceptés et de ceux refusés à l'unité. */
  | { ok: true; acceptes: number[]; refuses: number[] }
  | {
      ok: false
      code: CodeEchecLotEmail
      /** Statut HTTP de la réponse ; null sans réponse ou pour un refus local. */
      statutHttp: number | null
      /**
       * Un code, jamais un texte : nom d'erreur de Resend (« rate_limit_exceeded »…, « inconnu » s'il n'a pas la forme
       * d'un code) ou motif local : « delai_depasse », « exception », « reponse_inattendue », « lot_trop_grand »,
       * « cle_idempotence_invalide », « cle_api_absente ».
       */
      motif: string
    }

type EchecLotEmailDetaille = Extract<ResultatLotEmailDetaille, { ok: false }>

/** Clé d'idempotence acceptée : ASCII visible (valeur d'en-tête HTTP sûre), 1 à 256 caractères. */
const CLE_IDEMPOTENCE = /^[\x21-\x7E]{1,256}$/

/** Forme d'un code d'erreur de Resend ; tout autre nom (texte libre, adresse…) devient « inconnu ». */
const NOM_ERREUR_RESEND = /^[a-z_]{1,64}$/

/** Corps d'une réponse 2xx du lot ; les `message` des refus à l'unité ne sont pas lus. */
const reponseLotSchema = z.object({
  data: z.array(z.object({ id: z.string() })),
  errors: z.array(z.object({ index: z.number().int() })).optional(),
})

const echecLot = (code: CodeEchecLotEmail, statutHttp: number | null, motif: string): EchecLotEmailDetaille =>
  ({ ok: false, code, statutHttp, motif })

/** Code d'un échec global depuis l'erreur rendue par le SDK (nom et statut seulement ; le message est ignoré). */
function echecDepuisErreurResend(erreur: { name?: unknown; statusCode?: unknown }): EchecLotEmailDetaille {
  const statut = typeof erreur.statusCode === 'number' ? erreur.statusCode : null
  const nom = typeof erreur.name === 'string' && NOM_ERREUR_RESEND.test(erreur.name) ? erreur.name : 'inconnu'
  if (nom === 'rate_limit_exceeded') return echecLot('limite', statut, nom)
  if (nom === 'daily_quota_exceeded' || nom === 'monthly_quota_exceeded') return echecLot('quota', statut, nom)
  if (nom === 'invalid_idempotent_request') return echecLot('rejeu_refuse', statut, nom)
  if (nom === 'concurrent_idempotent_requests') return echecLot('rejeu_concurrent', statut, nom)
  // Sans réponse (le SDK rend alors statusCode null) ou erreur du service : Resend a pu traiter le lot.
  if (statut === null || statut >= 500) return echecLot('reseau', statut, nom)
  if (statut === 429) return echecLot('limite', statut, nom)
  return echecLot('refus', statut, nom)
}

/** Indices acceptés et refusés d'une réponse 2xx ; null si elle est illisible ou incohérente avec le lot. */
function indicesDuLot(data: unknown, taille: number): { acceptes: number[]; refuses: number[] } | null {
  const lu = reponseLotSchema.safeParse(data)
  if (!lu.success) return null
  const refuses = new Set<number>()
  for (const { index } of lu.data.errors ?? []) {
    if (index < 0 || index >= taille || refuses.has(index)) return null
    refuses.add(index)
  }
  if (lu.data.data.length !== taille - refuses.size) return null
  const acceptes: number[] = []
  for (let i = 0; i < taille; i += 1) if (!refuses.has(i)) acceptes.push(i)
  return { acceptes, refuses: [...refuses].sort((a, b) => a - b) }
}

/** Appel du lot ; ne lève jamais (une exception devient `reseau`). */
async function appelerLotDetaille(
  messages: readonly EmailPayload[],
  idempotencyKey: string,
  validation: 'permissive' | 'strict',
): Promise<ResultatLotEmailDetaille> {
  try {
    const { data, error } = await getResend().batch.send(messages.map(messageDeLot), { batchValidation: validation, idempotencyKey })
    if (error) return echecDepuisErreurResend(error)
    const indices = indicesDuLot(data, messages.length)
    return indices ? { ok: true, ...indices } : echecLot('reseau', null, 'reponse_inattendue')
  } catch (err) {
    // Seul le type de l'exception est journalisé : son texte peut contenir une adresse ou un en-tête du message.
    logger.warn('[email] lot détaillé : exception pendant l’envoi, issue inconnue', {
      messages: messages.length,
      exception: err instanceof Error ? err.name : typeof err,
    })
    return echecLot('reseau', null, 'exception')
  }
}

/**
 * Envoie UN lot (1 à 100 messages) en une requête, sans nouvelle tentative, et rend ce que Resend en a fait.
 * Ne lève jamais. Le délai dépassé rend `reseau` (motif « delai_depasse ») : Resend a pu recevoir le lot, que le rejeu
 * avec la même clé ne renverra pas.
 */
export async function sendBatchEmailsDetaille(
  messages: readonly EmailPayload[],
  options: OptionsLotEmailDetaille,
): Promise<ResultatLotEmailDetaille> {
  if (messages.length === 0) return { ok: true, acceptes: [], refuses: [] }
  if (messages.length > TAILLE_LOT_EMAIL_MAX) return echecLot('refus', null, 'lot_trop_grand')
  if (!CLE_IDEMPOTENCE.test(options.idempotencyKey)) return echecLot('refus', null, 'cle_idempotence_invalide')
  if (!process.env.RESEND_API_KEY) return echecLot('refus', null, 'cle_api_absente')

  const delaiMs = options.delaiMs !== undefined && Number.isFinite(options.delaiMs) && options.delaiMs > 0
    ? options.delaiMs
    : DELAI_LOT_EMAIL_MS
  // Promise.race : le SDK n'a aucun délai et ses options typées n'acceptent pas de signal d'annulation.
  let minuteur: ReturnType<typeof setTimeout> | undefined
  const delaiDepasse = new Promise<ResultatLotEmailDetaille>((resoudre) => {
    minuteur = setTimeout(() => resoudre(echecLot('reseau', null, 'delai_depasse')), delaiMs)
  })
  try {
    return await Promise.race([appelerLotDetaille(messages, options.idempotencyKey, options.validation ?? 'permissive'), delaiDepasse])
  } finally {
    clearTimeout(minuteur)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Base layout ──────────────────────────────────────────────────────────────
function baseLayout(content: string, locale: string = 'fr'): string {
  const footerText = locale === 'pt'
    ? 'Este email foi enviado automaticamente pela plataforma VITFIX.'
    : 'Cet email a été envoyé automatiquement par la plateforme VITFIX.'
  const unsubText = locale === 'pt' ? 'Gerir preferências' : 'Gérer les préférences'

  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F4EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:#0D1B2E;padding:24px 32px;text-align:center;">
          <span style="color:#C9A84C;font-size:24px;font-weight:700;letter-spacing:1px;">VITFIX</span>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#F7F4EE;padding:20px 32px;border-top:1px solid #E4DDD0;">
          <p style="margin:0;font-size:12px;color:#8A9BB0;text-align:center;">
            ${footerText}<br/>
            <a href="https://vitfix.io" style="color:#C9A84C;text-decoration:none;">${unsubText}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── 1. Rappel d'impayés ──────────────────────────────────────────────────────
export function templateUnpaidReminder(params: {
  ownerName: string
  amount: number
  dueDate: string
  buildingName: string
  unit: string
  cabinetName: string
  paymentLink?: string
  locale?: string
}): { subject: string; html: string } {
  const { ownerName, amount, dueDate, buildingName, unit, cabinetName, paymentLink, locale = 'fr' } = params
  const isPt = locale === 'pt'

  const subject = isPt
    ? `[${cabinetName}] Lembrete: Pagamento em atraso — ${buildingName}`
    : `[${cabinetName}] Rappel : Charges impayées — ${buildingName}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ${isPt ? '⚠️ Lembrete de pagamento' : '⚠️ Rappel de paiement'}
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt ? 'Caro(a)' : 'Cher(e)'} <strong>${ownerName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? `Informamos que tem um pagamento pendente relativo ao condomínio <strong>${buildingName}</strong>, fração <strong>${unit}</strong>.`
        : `Nous vous informons qu'un règlement est en attente pour la copropriété <strong>${buildingName}</strong>, lot <strong>${unit}</strong>.`}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FEF5E4;border-radius:12px;padding:20px;margin:0 0 20px;">
      <tr><td>
        <p style="margin:0;font-size:13px;color:#D4830A;font-weight:600;">${isPt ? 'MONTANTE EM DÍVIDA' : 'MONTANT DÛ'}</p>
        <p style="margin:8px 0 0;font-size:28px;font-weight:700;color:#0D1B2E;">${amount.toFixed(2)} €</p>
        <p style="margin:4px 0 0;font-size:13px;color:#8A9BB0;">${isPt ? 'Data limite' : 'Échéance'} : ${dueDate}</p>
      </td></tr>
    </table>
    ${paymentLink ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${paymentLink}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        ${isPt ? '💳 Pagar agora' : '💳 Régler maintenant'}
      </a>
    </div>` : ''}
    <p style="color:#8A9BB0;font-size:13px;line-height:1.5;margin:16px 0 0;">
      ${isPt
        ? 'Se já efetuou o pagamento, queira desconsiderar este email.'
        : 'Si vous avez déjà effectué ce règlement, veuillez ne pas tenir compte de ce rappel.'}
    </p>
    <p style="color:#4A5E78;font-size:14px;margin:20px 0 0;">
      ${isPt ? 'Com os melhores cumprimentos,' : 'Cordialement,'}<br/>
      <strong>${cabinetName}</strong>
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ── 2. Convocation AG ────────────────────────────────────────────────────────
export function templateAGInvitation(params: {
  ownerName: string
  buildingName: string
  date: string
  time: string
  location: string
  cabinetName: string
  agendaItems?: string[]
  proxyLink?: string
  locale?: string
}): { subject: string; html: string } {
  const { ownerName, buildingName, date, time, location, cabinetName, agendaItems, proxyLink, locale = 'fr' } = params
  const isPt = locale === 'pt'

  const subject = isPt
    ? `[${cabinetName}] Convocatória: Assembleia Geral — ${buildingName}`
    : `[${cabinetName}] Convocation : Assemblée Générale — ${buildingName}`

  const agendaHtml = agendaItems?.length
    ? `<div style="background:#F7F4EE;border-radius:12px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#0D1B2E;">${isPt ? '📋 ORDEM DO DIA' : '📋 ORDRE DU JOUR'}</p>
        <ol style="margin:0;padding-left:20px;color:#4A5E78;font-size:14px;line-height:1.8;">
          ${agendaItems.map(item => `<li>${item}</li>`).join('')}
        </ol>
       </div>`
    : ''

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ${isPt ? '🏛️ Convocatória para Assembleia Geral' : '🏛️ Convocation à l\'Assemblée Générale'}
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt ? 'Caro(a)' : 'Cher(e)'} <strong>${ownerName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? `Temos o prazer de o(a) convidar para a Assembleia Geral do condomínio <strong>${buildingName}</strong>.`
        : `Nous avons le plaisir de vous convier à l'Assemblée Générale de la copropriété <strong>${buildingName}</strong>.`}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#E6F4F2;border-radius:12px;padding:20px;margin:0 0 16px;">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#1A7A6E;">📅 <strong>${date}</strong> ${isPt ? 'às' : 'à'} <strong>${time}</strong></p>
        <p style="margin:8px 0 0;font-size:14px;color:#1A7A6E;">📍 <strong>${location}</strong></p>
      </td></tr>
    </table>
    ${agendaHtml}
    ${proxyLink ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${proxyLink}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        ${isPt ? '📝 Enviar procuração' : '📝 Donner procuration'}
      </a>
    </div>` : ''}
    <p style="color:#4A5E78;font-size:14px;margin:20px 0 0;">
      ${isPt ? 'Com os melhores cumprimentos,' : 'Cordialement,'}<br/>
      <strong>${cabinetName}</strong>
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ── 3. Notification intervention ─────────────────────────────────────────────
export function templateInterventionNotif(params: {
  recipientName: string
  buildingName: string
  type: string
  date: string
  artisanName?: string
  description: string
  cabinetName: string
  locale?: string
}): { subject: string; html: string } {
  const { recipientName, buildingName, type, date, artisanName, description, cabinetName, locale = 'fr' } = params
  const isPt = locale === 'pt'

  const subject = isPt
    ? `[${cabinetName}] Intervenção programada — ${buildingName}`
    : `[${cabinetName}] Intervention programmée — ${buildingName}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ${isPt ? '🔧 Intervenção programada' : '🔧 Intervention programmée'}
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt ? 'Caro(a)' : 'Cher(e)'} <strong>${recipientName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? `Uma intervenção foi programada no condomínio <strong>${buildingName}</strong>.`
        : `Une intervention a été programmée dans la copropriété <strong>${buildingName}</strong>.`}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F4EE;border-radius:12px;padding:20px;margin:0 0 20px;">
      <tr><td>
        <p style="margin:0;font-size:14px;color:#0D1B2E;"><strong>${isPt ? 'Tipo' : 'Type'} :</strong> ${type}</p>
        <p style="margin:6px 0 0;font-size:14px;color:#0D1B2E;"><strong>${isPt ? 'Data' : 'Date'} :</strong> ${date}</p>
        ${artisanName ? `<p style="margin:6px 0 0;font-size:14px;color:#0D1B2E;"><strong>${isPt ? 'Artesão' : 'Artisan'} :</strong> ${artisanName}</p>` : ''}
        <p style="margin:10px 0 0;font-size:13px;color:#4A5E78;">${description}</p>
      </td></tr>
    </table>
    <p style="color:#4A5E78;font-size:14px;margin:20px 0 0;">
      ${isPt ? 'Com os melhores cumprimentos,' : 'Cordialement,'}<br/>
      <strong>${cabinetName}</strong>
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ── 4. Invitation membre d'équipe ────────────────────────────────────────────
export function templateTeamInvite(params: {
  memberName: string
  roleName: string
  cabinetName: string
  inviteUrl: string
  locale?: string
}): { subject: string; html: string } {
  const { memberName, roleName, cabinetName, inviteUrl, locale = 'fr' } = params
  const isPt = locale === 'pt'

  const subject = isPt
    ? `${cabinetName} convida-o(a) para a equipa VITFIX`
    : `${cabinetName} vous invite à rejoindre l'équipe VITFIX`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ${isPt ? '👋 Convite para a equipa' : '👋 Invitation à rejoindre l\'équipe'}
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt ? 'Olá' : 'Bonjour'} <strong>${memberName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? `O gabinete <strong>${cabinetName}</strong> convida-o(a) a juntar-se à sua equipa como <strong>${roleName}</strong> na plataforma VITFIX.`
        : `Le cabinet <strong>${cabinetName}</strong> vous invite à rejoindre son équipe en tant que <strong>${roleName}</strong> sur la plateforme VITFIX.`}
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${inviteUrl}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:600;font-size:16px;">
        ${isPt ? '✅ Aceitar o convite' : '✅ Accepter l\'invitation'}
      </a>
    </div>
    <p style="color:#8A9BB0;font-size:12px;text-align:center;margin:0;">
      ${isPt ? 'Este link é válido por 7 dias.' : 'Ce lien est valable 7 jours.'}
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ── 4b. Invitation membre équipe PRO (société BTP) ──────────────────────────
export function templateProTeamInvite(params: {
  memberName: string
  roleName: string
  companyName: string
  inviteUrl: string
  locale?: string
}): { subject: string; html: string } {
  const { memberName, roleName, companyName, inviteUrl, locale = 'fr' } = params
  const isPt = locale === 'pt'

  const subject = isPt
    ? `${companyName} convida-o(a) para a equipa VITFIX`
    : `${companyName} vous invite à rejoindre l'équipe VITFIX`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">
      ${isPt ? '👷 Convite para a equipa' : '👷 Invitation à rejoindre l\'équipe'}
    </h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt ? 'Olá' : 'Bonjour'} <strong>${memberName}</strong>,
    </p>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? `A empresa <strong>${companyName}</strong> convida-o(a) a juntar-se à sua equipa como <strong>${roleName}</strong> na plataforma VITFIX.`
        : `L'entreprise <strong>${companyName}</strong> vous invite à rejoindre son équipe en tant que <strong>${roleName}</strong> sur la plateforme VITFIX.`}
    </p>
    <p style="color:#4A5E78;font-size:14px;line-height:1.6;margin:0 0 16px;">
      ${isPt
        ? 'Ao aceitar, terá acesso ao painel profissional com os módulos atribuídos ao seu perfil.'
        : 'En acceptant, vous aurez accès au tableau de bord professionnel avec les modules attribués à votre profil.'}
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${inviteUrl}" style="display:inline-block;background:#FFC107;color:#1a1a1a;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;">
        ${isPt ? '✅ Aceitar o convite' : '✅ Accepter l\'invitation'}
      </a>
    </div>
    <p style="color:#8A9BB0;font-size:12px;text-align:center;margin:0;">
      ${isPt ? 'Este link é válido por 7 dias.' : 'Ce lien est valable 7 jours.'}
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ── 5. Notification générique ────────────────────────────────────────────────
export function templateGenericNotif(params: {
  recipientName: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  cabinetName: string
  locale?: string
}): { subject: string; html: string } {
  const { recipientName, title, body, ctaLabel, ctaUrl, cabinetName, locale = 'fr' } = params

  const subject = `[${cabinetName}] ${title}`

  const content = `
    <h2 style="color:#0D1B2E;margin:0 0 16px;font-size:20px;">${title}</h2>
    <p style="color:#4A5E78;font-size:15px;line-height:1.6;margin:0 0 16px;">
      ${locale === 'pt' ? 'Caro(a)' : 'Cher(e)'} <strong>${recipientName}</strong>,
    </p>
    <div style="color:#4A5E78;font-size:15px;line-height:1.7;margin:0 0 20px;">${body}</div>
    ${ctaLabel && ctaUrl ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${ctaUrl}" style="display:inline-block;background:#0D1B2E;color:#FFFFFF;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">
        ${ctaLabel}
      </a>
    </div>` : ''}
    <p style="color:#4A5E78;font-size:14px;margin:20px 0 0;">
      ${locale === 'pt' ? 'Com os melhores cumprimentos,' : 'Cordialement,'}<br/>
      <strong>${cabinetName}</strong>
    </p>`

  return { subject, html: baseLayout(content, locale) }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING TRANSACTIONAL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export function templateBookingCreated(p: { artisanName: string; clientName: string; serviceName: string; bookingDate: string; bookingTime?: string; address?: string; locale?: string }) {
  const isPt = (p.locale || 'fr') === 'pt'
  const subject = isPt ? `Nova marcação de ${p.clientName}` : `Nouvelle réservation de ${p.clientName}`
  const content = `
    <h2 style="color:#0D1B2E;font-size:20px;margin:0 0 16px;">${isPt ? 'Nova marcação recebida' : 'Nouvelle réservation reçue'}</h2>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Olá' : 'Bonjour'} <strong>${p.artisanName}</strong>,</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Recebeu um novo pedido de marcação.' : 'Vous avez reçu une nouvelle demande de réservation.'}</p>
    <div style="background:#F7F4EE;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Cliente' : 'Client'} :</strong> ${p.clientName}</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Serviço' : 'Service'} :</strong> ${p.serviceName}</p>
      <p style="margin:0;font-size:14px;"><strong>${isPt ? 'Data' : 'Date'} :</strong> ${p.bookingDate}${p.bookingTime ? ` ${isPt ? 'às' : 'à'} ${p.bookingTime}` : ''}</p>
    </div>
    <a href="https://vitfix.io/pro/dashboard" style="display:inline-block;background:#FFC107;color:#0D1B2E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${isPt ? 'Ver no meu dashboard' : 'Voir dans mon dashboard'}</a>`
  return { subject, html: baseLayout(content, p.locale || 'fr') }
}

export function templateBookingConfirmed(p: { clientName: string; artisanName: string; companyName: string; serviceName: string; bookingDate: string; bookingTime?: string; locale?: string }) {
  const isPt = (p.locale || 'fr') === 'pt'
  const subject = isPt ? `Marcação confirmada — ${p.companyName}` : `Réservation confirmée — ${p.companyName}`
  const content = `
    <h2 style="color:#0D1B2E;font-size:20px;margin:0 0 16px;">${isPt ? '✅ Marcação confirmada' : '✅ Réservation confirmée'}</h2>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Olá' : 'Bonjour'} <strong>${p.clientName}</strong>,</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'A sua marcação foi confirmada.' : 'Votre réservation a été confirmée.'}</p>
    <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Profissional' : 'Artisan'} :</strong> ${p.artisanName} (${p.companyName})</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Serviço' : 'Service'} :</strong> ${p.serviceName}</p>
      <p style="margin:0;font-size:14px;"><strong>${isPt ? 'Data' : 'Date'} :</strong> ${p.bookingDate}${p.bookingTime ? ` ${isPt ? 'às' : 'à'} ${p.bookingTime}` : ''}</p>
    </div>
    <a href="https://vitfix.io/client/dashboard" style="display:inline-block;background:#FFC107;color:#0D1B2E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">${isPt ? 'Ver detalhes' : 'Voir les détails'}</a>`
  return { subject, html: baseLayout(content, p.locale || 'fr') }
}

export function templateBookingReminder(p: { clientName: string; artisanName: string; companyName: string; serviceName: string; bookingDate: string; bookingTime?: string; address?: string; locale?: string }) {
  const isPt = (p.locale || 'fr') === 'pt'
  const subject = isPt ? `Lembrete: marcação amanhã com ${p.companyName}` : `Rappel : intervention demain avec ${p.companyName}`
  const content = `
    <h2 style="color:#0D1B2E;font-size:20px;margin:0 0 16px;">${isPt ? '🔔 Lembrete para amanhã' : '🔔 Rappel pour demain'}</h2>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Olá' : 'Bonjour'} <strong>${p.clientName}</strong>,</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'A sua intervenção está agendada para amanhã.' : 'Votre intervention est prévue demain.'}</p>
    <div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Profissional' : 'Artisan'} :</strong> ${p.artisanName} (${p.companyName})</p>
      <p style="margin:0 0 8px;font-size:14px;"><strong>${isPt ? 'Serviço' : 'Service'} :</strong> ${p.serviceName}</p>
      <p style="margin:0;font-size:14px;"><strong>${isPt ? 'Data' : 'Date'} :</strong> ${p.bookingDate}${p.bookingTime ? ` ${isPt ? 'às' : 'à'} ${p.bookingTime}` : ''}</p>
    </div>`
  return { subject, html: baseLayout(content, p.locale || 'fr') }
}

export function templateBookingCompleted(p: { clientName: string; artisanName: string; companyName: string; serviceName: string; locale?: string }) {
  const isPt = (p.locale || 'fr') === 'pt'
  const subject = isPt ? 'Intervenção concluída — deixe a sua opinião' : 'Intervention terminée — donnez votre avis'
  const content = `
    <h2 style="color:#0D1B2E;font-size:20px;margin:0 0 16px;">${isPt ? '✅ Intervenção concluída' : '✅ Intervention terminée'}</h2>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Olá' : 'Bonjour'} <strong>${p.clientName}</strong>,</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? `A intervenção de <strong>${p.artisanName}</strong> (${p.companyName}) para <strong>${p.serviceName}</strong> foi concluída.` : `L'intervention de <strong>${p.artisanName}</strong> (${p.companyName}) pour <strong>${p.serviceName}</strong> est terminée.`}</p>
    <a href="https://vitfix.io/client/dashboard" style="display:inline-block;background:#FFC107;color:#0D1B2E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:12px;">${isPt ? '⭐ Avaliar o profissional' : '⭐ Évaluer l\'artisan'}</a>`
  return { subject, html: baseLayout(content, p.locale || 'fr') }
}

export function templateDevisReminder(p: { clientName: string; artisanName: string; companyName: string; docNumber: string; totalStr: string; locale?: string }) {
  const isPt = (p.locale || 'fr') === 'pt'
  const subject = isPt ? `Lembrete: orçamento N.${p.docNumber} aguarda a sua assinatura` : `Rappel : devis N.${p.docNumber} en attente de signature`
  const content = `
    <h2 style="color:#0D1B2E;font-size:20px;margin:0 0 16px;">${isPt ? '📋 Orçamento em espera' : '📋 Devis en attente'}</h2>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Olá' : 'Bonjour'} <strong>${p.clientName}</strong>,</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? `O orçamento N.${p.docNumber} de <strong>${p.artisanName}</strong> (${p.companyName}) no valor de <strong>${p.totalStr}</strong> aguarda a sua assinatura.` : `Le devis N.${p.docNumber} de <strong>${p.artisanName}</strong> (${p.companyName}) d'un montant de <strong>${p.totalStr}</strong> est en attente de votre signature.`}</p>
    <p style="color:#4A5E78;font-size:14px;">${isPt ? 'Assine diretamente no seu dashboard para confirmar a intervenção.' : 'Signez directement depuis votre dashboard pour confirmer l\'intervention.'}</p>
    <a href="https://vitfix.io/client/dashboard" style="display:inline-block;background:#FFC107;color:#0D1B2E;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin-top:12px;">${isPt ? '✍️ Assinar o orçamento' : '✍️ Signer le devis'}</a>`
  return { subject, html: baseLayout(content, p.locale || 'fr') }
}
