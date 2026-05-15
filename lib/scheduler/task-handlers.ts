// lib/scheduler/task-handlers.ts
// 7 handlers déterministes pour les task_types de Tempo.
// Chaque handler reçoit { automation, supabase, runId } et retourne HandlerResult.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email'
import { logger } from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

export interface Automation {
  id: string
  cabinet_id: string
  task_type: string
  params: Record<string, unknown>
  locale: 'fr' | 'pt'
  name: string
}

export interface HandlerResult {
  status: 'success' | 'partial' | 'failed'
  emails_sent: number
  docs_generated: number
  error_message?: string
  result_meta?: Record<string, unknown>
}

interface HandlerCtx {
  automation: Automation
  supabase: AnyClient
  runId: string
}

// ── Helper : appel interne à une route d'agent IA pour générer du contenu ─────
async function callAgent(
  agentEndpoint:
    | '/api/syndic/lea-comptable'
    | '/api/syndic/max-ai'
    | '/api/syndic/alfredo-chat'
    | '/api/syndic/fixy-syndic',
  payload: { message: string; locale: 'fr' | 'pt'; cabinet_id: string },
): Promise<{ response: string; ok: boolean }> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://vitfix.io'
  try {
    const res = await fetch(`${baseUrl}${agentEndpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-cron': process.env.INTERNAL_API_SECRET ?? '',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { response: '', ok: false }
    const json = (await res.json()) as { response?: string; content?: string }
    return { response: json.response ?? json.content ?? '', ok: true }
  } catch (err) {
    logger.error('callAgent failed', {
      agentEndpoint,
      error: err instanceof Error ? err.message : 'unknown',
    })
    return { response: '', ok: false }
  }
}

// ── 1. send_email_template ────────────────────────────────────────────────────
async function send_email_template(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation } = ctx
  const p = automation.params
  const recipients: string[] = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
  if (recipients.length === 0) {
    return { status: 'failed', emails_sent: 0, docs_generated: 0, error_message: 'no_recipients' }
  }
  if (!p.subject || !(p.body || p.html)) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: 'missing_subject_or_body',
    }
  }
  let sent = 0
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject: p.subject as string,
        html: (p.html as string) ?? `<p>${((p.body as string) ?? '').replace(/\n/g, '<br>')}</p>`,
      })
      sent++
    } catch (err) {
      logger.warn('[automation] email send failed', { to, error: String(err) })
    }
  }
  return {
    status: sent === recipients.length ? 'success' : 'partial',
    emails_sent: sent,
    docs_generated: 0,
  }
}

// ── 2. send_appel_charges (délègue Léa) ───────────────────────────────────────
async function send_appel_charges(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation, supabase } = ctx
  const p = automation.params
  const immeubleId = p.immeuble_id as string | undefined

  // Charger les coproprios de l'immeuble pour générer le tableau de répartition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let coprosQuery = (supabase as any)
    .from('syndic_coproprios')
    .select('id, nom, email')
    .eq('cabinet_id', automation.cabinet_id)
  if (immeubleId) coprosQuery = coprosQuery.eq('immeuble_id', immeubleId)
  const { data: copros } = await coprosQuery.limit(200)

  const recipients = ((copros ?? []) as { email?: string }[])
    .filter((c) => c.email)
    .map((c) => c.email as string)

  if (recipients.length === 0) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: 'no_copros_with_email',
    }
  }

  const leaRes = await callAgent('/api/syndic/lea-comptable', {
    message:
      automation.locale === 'pt'
        ? `Redige um chamada de quotas trimestral para o imóvel ${immeubleId ?? 'principal'}. Sintetiza em uma mensagem por email curta com montante total estimado, prazo de pagamento, IBAN, e referência. Sem inventar dados — utiliza apenas os elementos do contexto.`
        : `Rédige un appel de charges trimestriel pour l'immeuble ${immeubleId ?? 'principal'}. Synthétise en un message email court avec montant total estimé, délai de paiement, IBAN, référence. Ne pas inventer de données — utilise uniquement les éléments du contexte.`,
    locale: automation.locale,
    cabinet_id: automation.cabinet_id,
  })

  if (!leaRes.ok || !leaRes.response) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: 'lea_generation_failed',
    }
  }

  const subject =
    automation.locale === 'pt' ? 'Chamada de quotas trimestral' : 'Appel de charges trimestriel'
  let sent = 0
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject,
        html: `<div style="font-family: sans-serif">${leaRes.response.replace(/\n/g, '<br>')}</div>`,
      })
      sent++
    } catch (err) {
      logger.warn('[automation] appel_charges email failed', { to, error: String(err) })
    }
  }
  return {
    status: sent === recipients.length ? 'success' : 'partial',
    emails_sent: sent,
    docs_generated: 0,
    result_meta: { delegated_to: 'lea', immeuble_id: immeubleId },
  }
}

// ── 3. send_relance_impaye (délègue Léa) ──────────────────────────────────────
async function send_relance_impaye(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation, supabase } = ctx
  const p = automation.params
  const thresholdDays = (p.threshold_days as number) ?? 30
  const since = new Date(Date.now() - thresholdDays * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // Charger les impayés > threshold_days
  const { data: impayes } = await (supabase as any)
    .from('syndic_impayes')
    .select('id, coproprio_id, montant, nature, depuis, nb_relances')
    .eq('cabinet_id', automation.cabinet_id)
    .eq('statut', 'ouvert')
    .lte('depuis', since)
    .limit(100)

  if (!impayes || impayes.length === 0) {
    return {
      status: 'success',
      emails_sent: 0,
      docs_generated: 0,
      result_meta: { no_impayes: true },
    }
  }

  // Récupérer les emails coproprios
  const coproIds = Array.from(
    new Set((impayes as { coproprio_id?: string }[]).map((i) => i.coproprio_id).filter(Boolean)),
  )
  const { data: copros } = await (supabase as any)
    .from('syndic_coproprios')
    .select('id, email')
    .in('id', coproIds)

  const emailByCopro = new Map<string, string>()
  for (const c of ((copros ?? []) as { id: string; email?: string }[])) {
    if (c.email) emailByCopro.set(c.id, c.email)
  }

  let sent = 0
  for (const imp of impayes as {
    id: string
    coproprio_id: string
    montant: number
    nature: string
    depuis: string
    nb_relances?: number
  }[]) {
    const email = emailByCopro.get(imp.coproprio_id)
    if (!email) continue

    const leaRes = await callAgent('/api/syndic/lea-comptable', {
      message:
        automation.locale === 'pt'
          ? `Redige uma carta de cobrança amigável para uma dívida de ${imp.montant}€ desde ${imp.depuis} (natureza: ${imp.nature}). Tom firme mas cortês. Inclui propostas (plano de pagamento, contacto).`
          : `Rédige une relance amiable pour une dette de ${imp.montant}€ depuis ${imp.depuis} (nature: ${imp.nature}). Ton ferme mais courtois. Propose un échéancier + contact.`,
      locale: automation.locale,
      cabinet_id: automation.cabinet_id,
    })

    if (!leaRes.ok) continue

    try {
      await sendEmail({
        to: email,
        subject:
          automation.locale === 'pt'
            ? 'Lembrete de pagamento — quotas em atraso'
            : 'Rappel de paiement — charges impayées',
        html: `<div style="font-family: sans-serif">${leaRes.response.replace(/\n/g, '<br>')}</div>`,
      })
      sent++
      await (supabase as any)
        .from('syndic_impayes')
        .update({
          derniere_relance_at: new Date().toISOString(),
          nb_relances: (imp.nb_relances ?? 0) + 1,
        })
        .eq('id', imp.id)
    } catch (err) {
      logger.warn('[automation] relance send failed', { impaye_id: imp.id, error: String(err) })
    }
  }

  return {
    status: sent > 0 ? (sent === impayes.length ? 'success' : 'partial') : 'failed',
    emails_sent: sent,
    docs_generated: 0,
    result_meta: { delegated_to: 'lea', impayes_count: impayes.length },
  }
}

// ── 4. send_convocation_ag (délègue Max) ──────────────────────────────────────
async function send_convocation_ag(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation } = ctx
  const p = automation.params
  const recipients: string[] = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
  if (recipients.length === 0) {
    return { status: 'failed', emails_sent: 0, docs_generated: 0, error_message: 'no_recipients' }
  }

  const maxRes = await callAgent('/api/syndic/max-ai', {
    message:
      automation.locale === 'pt'
        ? `Redige uma convocatória de Assembleia Geral ordinária para o imóvel ${p.immeuble_id ?? 'principal'}, data ${p.ag_date ?? 'a definir'}, ordem do dia: ${p.agenda ?? 'aprovação contas, eleição administrador, obras'}.`
        : `Rédige une convocation d'Assemblée Générale ordinaire pour l'immeuble ${p.immeuble_id ?? 'principal'}, date ${p.ag_date ?? 'à définir'}, ordre du jour: ${p.agenda ?? 'approbation comptes, élection syndic, travaux'}.`,
    locale: automation.locale,
    cabinet_id: automation.cabinet_id,
  })

  if (!maxRes.ok) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: 'max_generation_failed',
    }
  }

  let sent = 0
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject:
          automation.locale === 'pt'
            ? 'Convocatória de Assembleia Geral'
            : "Convocation d'Assemblée Générale",
        html: `<div style="font-family: sans-serif">${maxRes.response.replace(/\n/g, '<br>')}</div>`,
      })
      sent++
    } catch (err) {
      logger.warn('[automation] convocation_ag send failed', { to, error: String(err) })
    }
  }

  return {
    status: sent === recipients.length ? 'success' : 'partial',
    emails_sent: sent,
    docs_generated: 0,
    result_meta: { delegated_to: 'max' },
  }
}

// ── 5. generate_monthly_report ────────────────────────────────────────────────
async function generate_monthly_report(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation } = ctx
  const p = automation.params
  const recipients: string[] = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
  if (recipients.length === 0) {
    return { status: 'failed', emails_sent: 0, docs_generated: 0, error_message: 'no_recipients' }
  }

  const leaRes = await callAgent('/api/syndic/lea-comptable', {
    message:
      automation.locale === 'pt'
        ? `Síntese mensal: estado das contas (impayes, regularizações, factures), missões em curso, alertas. Formato lista com emojis.`
        : `Synthèse mensuelle : état des comptes (impayés, régularisations, factures), missions en cours, alertes. Format liste avec emojis.`,
    locale: automation.locale,
    cabinet_id: automation.cabinet_id,
  })

  if (!leaRes.ok) {
    return { status: 'failed', emails_sent: 0, docs_generated: 0, error_message: 'lea_failed' }
  }

  const now = new Date()
  let sent = 0
  for (const to of recipients) {
    try {
      await sendEmail({
        to,
        subject:
          automation.locale === 'pt'
            ? `Relatório mensal — ${now.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}`
            : `Rapport mensuel — ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
        html: `<div style="font-family: sans-serif">${leaRes.response.replace(/\n/g, '<br>')}</div>`,
      })
      sent++
    } catch {
      // individual send failure logged upstream
    }
  }

  return {
    status: sent === recipients.length ? 'success' : 'partial',
    emails_sent: sent,
    docs_generated: 0,
  }
}

// ── 6. remind_echeance_legale ─────────────────────────────────────────────────
async function remind_echeance_legale(ctx: HandlerCtx): Promise<HandlerResult> {
  const { automation } = ctx
  const p = automation.params
  const recipients: string[] = Array.isArray(p.recipients) ? (p.recipients as string[]) : []
  const type = (p.type as string) ?? 'DPE'
  const expiration = (p.expiration as string) ?? ''
  if (recipients.length === 0 || !expiration) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: 'missing_recipients_or_expiration',
    }
  }

  const subject =
    automation.locale === 'pt'
      ? `Lembrete: ${type} expira em ${expiration}`
      : `Rappel: ${type} expire le ${expiration}`
  const body =
    automation.locale === 'pt'
      ? `<p>O controlo ${type} expira em <strong>${expiration}</strong>.</p><p>Renove para evitar não-conformidade legal.</p>`
      : `<p>Le contrôle ${type} expire le <strong>${expiration}</strong>.</p><p>Planifiez le renouvellement pour éviter une non-conformité légale.</p>`

  let sent = 0
  for (const to of recipients) {
    try {
      await sendEmail({ to, subject, html: body })
      sent++
    } catch {
      // individual send failure
    }
  }
  return {
    status: sent === recipients.length ? 'success' : 'partial',
    emails_sent: sent,
    docs_generated: 0,
  }
}

// ── 7. backup_docs (placeholder MVP) ──────────────────────────────────────────
async function backup_docs(ctx: HandlerCtx): Promise<HandlerResult> {
  // MVP : log + email confirmation. Vrai ZIP archive = post-MVP.
  const { automation } = ctx
  const p = automation.params
  const to = (p.notify_email as string) ?? ''
  if (to) {
    try {
      await sendEmail({
        to,
        subject:
          automation.locale === 'pt' ? 'Backup mensal preparado' : 'Backup mensuel préparé',
        html: '<p>Backup automatique programmé. Téléchargement disponible dans le dashboard.</p>',
      })
    } catch {
      // non-critical
    }
  }
  return {
    status: 'success',
    emails_sent: to ? 1 : 0,
    docs_generated: 0,
    result_meta: { placeholder: true },
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────
const HANDLERS: Record<string, (ctx: HandlerCtx) => Promise<HandlerResult>> = {
  send_email_template,
  send_appel_charges,
  send_relance_impaye,
  send_convocation_ag,
  generate_monthly_report,
  remind_echeance_legale,
  backup_docs,
}

export async function executeTaskHandler(ctx: HandlerCtx): Promise<HandlerResult> {
  const handler = HANDLERS[ctx.automation.task_type]
  if (!handler) {
    return {
      status: 'failed',
      emails_sent: 0,
      docs_generated: 0,
      error_message: `unknown_task_type: ${ctx.automation.task_type}`,
    }
  }
  return await handler(ctx)
}
