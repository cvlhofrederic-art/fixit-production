import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { getAuthUser, getUserRole, isSyndicRole, resolveCabinetId } from '@/lib/auth-helpers'
import { checkRateLimit, getClientIP, rateLimitResponse } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { validateBody, syndicSendEmailSchema } from '@/lib/validation'
import {
  sendEmail,
  sendBatchEmails,
  templateUnpaidReminder,
  templateAGInvitation,
  templateInterventionNotif,
  templateTeamInvite,
  templateGenericNotif,
  type EmailPayload,
} from '@/lib/email'

// ── Types de templates supportés ────────────────────────────────────────────
type TemplateType = 'unpaid_reminder' | 'ag_invitation' | 'intervention' | 'team_invite' | 'generic'

// ── POST /api/syndic/send-email ─────────────────────────────────────────────
// Envoyer un ou plusieurs emails via Resend
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || !isSyndicRole(user)) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Seuls syndic, syndic_admin, syndic_gestionnaire peuvent envoyer des emails
  const userRole = getUserRole(user)
  if (!['syndic', 'syndic_admin', 'syndic_gestionnaire', 'syndic_secretaire'].includes(userRole)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const ip = getClientIP(request)
  if (!(await checkRateLimit(`send_email_${ip}`, 15, 60_000))) return rateLimitResponse()

  const cabinetId = await resolveCabinetId(user, supabaseAdmin)
  const rawBody = await request.json()
  const v = validateBody(syndicSendEmailSchema, rawBody)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  const { template, recipients, params, locale = 'fr' } = v.data as {
    template: TemplateType
    recipients: { email: string; name: string }[] | { email: string; name: string }
    params: Record<string, any>
    locale?: string
  }

  // Récupérer le nom du cabinet pour les templates
  const { data: cabinetProfile } = await supabaseAdmin.auth.admin.getUserById(
    typeof cabinetId === 'string' ? cabinetId : user.id
  )
  const cabinetName = cabinetProfile?.user?.user_metadata?.cabinet_name
    || cabinetProfile?.user?.user_metadata?.full_name
    || 'Cabinet'

  const recipientList = Array.isArray(recipients) ? recipients : [recipients]

  if (recipientList.length === 0) {
    return NextResponse.json({ error: 'Au moins un destinataire requis' }, { status: 400 })
  }

  // Limite batch à 200 pour éviter les abus
  if (recipientList.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 destinataires par requête' }, { status: 400 })
  }

  try {
    // ── Construire les emails selon le template ──────────────────────
    const emails: EmailPayload[] = recipientList.map(r => {
      let emailContent: { subject: string; html: string }

      switch (template) {
        case 'unpaid_reminder':
          emailContent = templateUnpaidReminder({
            ownerName: r.name,
            amount: params.amount || 0,
            dueDate: params.dueDate || '',
            buildingName: params.buildingName || '',
            unit: params.unit || '',
            cabinetName,
            paymentLink: params.paymentLink,
            locale,
          })
          break

        case 'ag_invitation':
          emailContent = templateAGInvitation({
            ownerName: r.name,
            buildingName: params.buildingName || '',
            date: params.date || '',
            time: params.time || '',
            location: params.location || '',
            cabinetName,
            agendaItems: params.agendaItems,
            proxyLink: params.proxyLink,
            locale,
          })
          break

        case 'intervention':
          emailContent = templateInterventionNotif({
            recipientName: r.name,
            buildingName: params.buildingName || '',
            type: params.type || '',
            date: params.date || '',
            artisanName: params.artisanName,
            description: params.description || '',
            cabinetName,
            locale,
          })
          break

        case 'team_invite':
          emailContent = templateTeamInvite({
            memberName: r.name,
            roleName: params.roleName || '',
            cabinetName,
            inviteUrl: params.inviteUrl || '',
            locale,
          })
          break

        case 'generic':
        default:
          emailContent = templateGenericNotif({
            recipientName: r.name,
            title: params.title || '',
            body: params.body || '',
            ctaLabel: params.ctaLabel,
            ctaUrl: params.ctaUrl,
            cabinetName,
            locale,
          })
          break
      }

      return {
        to: r.email,
        subject: emailContent.subject,
        html: emailContent.html,
        tags: [
          { name: 'template', value: template },
          { name: 'cabinet_id', value: cabinetId || '' },
        ],
      }
    })

    // ── Envoi unique ou batch ────────────────────────────────────────
    if (emails.length === 1) {
      const result = await sendEmail(emails[0])
      if (!result.success) {
        return NextResponse.json({
          error: result.error || 'Échec envoi email',
          sent: 0,
          failed: 1,
        }, { status: 500 })
      }
      return NextResponse.json({
        success: true,
        sent: 1,
        failed: 0,
        message: locale === 'pt' ? 'Email enviado com sucesso' : 'Email envoyé avec succès',
      })
    }

    // Batch
    const batchResult = await sendBatchEmails(emails)
    return NextResponse.json({
      success: batchResult.failed === 0,
      sent: batchResult.sent,
      failed: batchResult.failed,
      errors: batchResult.errors.length > 0 ? batchResult.errors : undefined,
      message: locale === 'pt'
        ? `${batchResult.sent} email(s) enviado(s), ${batchResult.failed} falha(s)`
        : `${batchResult.sent} email(s) envoyé(s), ${batchResult.failed} échec(s)`,
    })
  } catch (err: unknown) {
    logger.error('[SEND-EMAIL] Error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Erreur serveur lors de l\'envoi' }, { status: 500 })
  }
}
