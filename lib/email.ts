import { Resend } from 'resend'
import { NOREPLY_EMAIL } from '@/lib/constants'

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
}

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
}

// ── Config ───────────────────────────────────────────────────────────────────
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || `VITFIX <${NOREPLY_EMAIL}>`

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
      const { data, error } = await getResend().batch.send(
        chunk.map(e => ({
          from: e.from || DEFAULT_FROM,
          to: Array.isArray(e.to) ? e.to : [e.to],
          subject: e.subject,
          html: e.html,
          replyTo: e.replyTo,
          tags: e.tags,
        }))
      )

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
