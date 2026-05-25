// lib/syndic/alfredo-chat-tools.ts
//
// Les 4 tools Alfredo prennent `cabinetId: string` (et NON `user`).
// Raison : un team_member (syndic_comptable, syndic_tech…) doit accéder à
// l'inbox du cabinet, pas à son user.id propre. Le caller (alfredo-chat
// route) résout `cabinetId` via `resolveCabinetId(user, supabaseAdmin)` et
// passe `supabaseAdmin` (service_role) au client — la RLS de
// `syndic_emails_analysed` est strictement `syndic_id = auth.uid()`, donc
// le bypass est nécessaire tant que la RLS n'est pas étendue (Phase 5).
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateDraftReply } from '@/lib/syndic/alfredo-draft'
import { loadClientContext } from '@/lib/syndic/alfredo-load-client-context'
import type { Locale, SyndicRole } from '@/lib/syndic/agent-types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>

// ── 1. search_emails ──────────────────────────────────────────────────────────

export interface SearchEmailsArgs {
  query?: string
  from_email?: string
  since?: string       // ISO date
  until?: string       // ISO date
  type_demande?: string
  urgence?: string
  draft_status?: string
  limit?: number
}

export interface SearchEmailsResult {
  total: number
  emails: Array<{
    id: string
    from_email: string
    subject: string
    body_preview: string
    received_at: string
    urgence?: string
    type_demande?: string
    statut?: string
    draft_status?: string
  }>
}

export async function searchEmails(
  client: AnyClient,
  cabinetId: string,
  args: SearchEmailsArgs,
): Promise<SearchEmailsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = client
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, urgence, type_demande, statut, draft_status', { count: 'exact' })
    .eq('syndic_id', cabinetId)
    .order('received_at', { ascending: false })
    .limit(Math.min(args.limit ?? 20, 50))

  if (args.from_email) q = q.eq('from_email', args.from_email)
  if (args.since) q = q.gte('received_at', args.since)
  if (args.until) q = q.lte('received_at', args.until)
  if (args.type_demande) q = q.eq('type_demande', args.type_demande)
  if (args.urgence) q = q.eq('urgence', args.urgence)
  if (args.draft_status) q = q.eq('draft_status', args.draft_status)
  if (args.query) {
    const term = `%${args.query}%`
    q = q.or(`subject.ilike.${term},body_preview.ilike.${term}`)
  }

  const { data, count } = await q
  return {
    total: count ?? 0,
    emails: ((data ?? []) as Array<{
      id: string
      from_email: string
      subject: string
      body_preview: string
      received_at: string
      urgence?: string
      type_demande?: string
      statut?: string
      draft_status?: string
    }>).map((e) => ({
      id: e.id,
      from_email: e.from_email,
      subject: e.subject,
      body_preview: e.body_preview,
      received_at: e.received_at,
      urgence: e.urgence,
      type_demande: e.type_demande,
      statut: e.statut,
      draft_status: e.draft_status,
    })),
  }
}

// ── 2. regenerate_draft ───────────────────────────────────────────────────────

export interface RegenerateDraftArgs {
  email_id: string
  instructions?: string
  tone?: 'formel' | 'cordial' | 'ferme'
  locale: Locale
  syndicRole: SyndicRole
}

export async function regenerateDraft(
  client: AnyClient,
  cabinetId: string,
  args: RegenerateDraftArgs,
): Promise<{ ok: boolean; email_id: string; new_subject?: string; new_body?: string; error?: string }> {
  const { data: email, error } = await client
    .from('syndic_emails_analysed')
    .select('id, from_email, subject, body_preview, received_at, urgence, type_demande')
    .eq('id', args.email_id)
    .eq('syndic_id', cabinetId)
    .single()

  if (error || !email) return { ok: false, email_id: args.email_id, error: 'email_not_found' }

  const typedEmail = email as {
    id: string
    from_email: string
    subject?: string
    body_preview?: string
    received_at: string
    urgence?: string
    type_demande?: string
  }

  const clientCtx = await loadClientContext(client, {
    syndicId: cabinetId,
    syndicRole: args.syndicRole,
    emailAddress: typedEmail.from_email,
    locale: args.locale,
  })

  const baseEmailInput = {
    from: typedEmail.from_email,
    subject: typedEmail.subject ?? '',
    body_text: typedEmail.body_preview ?? '',
    received_at: typedEmail.received_at,
    urgence: typedEmail.urgence,
    type_demande: typedEmail.type_demande,
  }

  // Prepend instructions to subject so the draft prompt sees them
  const emailInput = args.instructions
    ? { ...baseEmailInput, subject: `[INSTRUCTIONS UTILISATEUR : ${args.instructions}] ${baseEmailInput.subject}` }
    : baseEmailInput

  const draft = await generateDraftReply(
    { email: emailInput, client_context: clientCtx, tone: args.tone },
    args.locale,
  )

  await client
    .from('syndic_emails_analysed')
    .update({
      draft_subject: draft.subject_suggested,
      draft_body_text: draft.body_text,
      draft_body_html: draft.body_html,
      draft_status: 'pending_review',
      draft_generated_at: new Date().toISOString(),
      draft_meta: {
        confidence: draft.confidence,
        missing_info: draft.missing_info,
        suggested_next_actions: draft.suggested_next_actions,
        regenerated: true,
        instructions: args.instructions,
      },
    })
    .eq('id', args.email_id)
    .eq('syndic_id', cabinetId)

  return {
    ok: true,
    email_id: args.email_id,
    new_subject: draft.subject_suggested,
    new_body: draft.body_text,
  }
}

// ── 3. bulk_action ────────────────────────────────────────────────────────────

export interface BulkActionArgs {
  filter: SearchEmailsArgs
  action: 'archive' | 'mark_spam' | 'flag_priority' | 'draft_reply'
  syndicRole?: SyndicRole
  locale?: Locale
}

export interface BulkActionResult {
  matched: number
  succeeded: number
  failed: number
  errors: string[]
}

export async function bulkAction(
  client: AnyClient,
  cabinetId: string,
  args: BulkActionArgs,
): Promise<BulkActionResult> {
  const search = await searchEmails(client, cabinetId, { ...args.filter, limit: 100 })
  const emails = search.emails
  let succeeded = 0
  let failed = 0
  const errors: string[] = []

  for (const email of emails) {
    try {
      if (args.action === 'archive') {
        await client
          .from('syndic_emails_analysed')
          .update({ statut: 'archive' })
          .eq('id', email.id)
          .eq('syndic_id', cabinetId)
      } else if (args.action === 'mark_spam') {
        await client
          .from('syndic_emails_analysed')
          .update({ statut: 'archive', type_demande: 'spam' })
          .eq('id', email.id)
          .eq('syndic_id', cabinetId)
      } else if (args.action === 'flag_priority') {
        await client
          .from('syndic_emails_analysed')
          .update({ urgence: 'haute' })
          .eq('id', email.id)
          .eq('syndic_id', cabinetId)
      } else if (args.action === 'draft_reply') {
        if (!args.syndicRole || !args.locale) {
          throw new Error('syndicRole and locale required for draft_reply bulk action')
        }
        await regenerateDraft(client, cabinetId, {
          email_id: email.id,
          locale: args.locale,
          syndicRole: args.syndicRole,
        })
      }
      succeeded++
    } catch (err) {
      failed++
      errors.push(`${email.id}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  return { matched: emails.length, succeeded, failed, errors: errors.slice(0, 10) }
}

// ── 4. summarize_inbox ────────────────────────────────────────────────────────

export interface SummarizeInboxArgs {
  period?: 'today' | 'week' | 'month'
}

export interface InboxSummary {
  period: string
  total_received: number
  by_status: Record<string, number>
  by_urgence: Record<string, number>
  by_type: Record<string, number>
  drafts_pending: number
  drafts_sent: number
  top_senders: Array<{ from_email: string; count: number }>
}

export async function summarizeInbox(
  client: AnyClient,
  cabinetId: string,
  args: SummarizeInboxArgs,
): Promise<InboxSummary> {
  const periodMap: Record<string, number> = { today: 1, week: 7, month: 30 }
  const days = periodMap[args.period ?? 'today'] ?? 1
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const { data: emails } = await client
    .from('syndic_emails_analysed')
    .select('id, from_email, statut, urgence, type_demande, draft_status')
    .eq('syndic_id', cabinetId)
    .gte('received_at', sinceDate)

  const list = (emails ?? []) as Array<{
    from_email: string
    statut?: string
    urgence?: string
    type_demande?: string
    draft_status?: string
  }>

  const byStatus: Record<string, number> = {}
  const byUrgence: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const senders: Record<string, number> = {}

  for (const e of list) {
    if (e.statut) byStatus[e.statut] = (byStatus[e.statut] ?? 0) + 1
    if (e.urgence) byUrgence[e.urgence] = (byUrgence[e.urgence] ?? 0) + 1
    if (e.type_demande) byType[e.type_demande] = (byType[e.type_demande] ?? 0) + 1
    if (e.from_email) senders[e.from_email] = (senders[e.from_email] ?? 0) + 1
  }

  const topSenders = Object.entries(senders)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([from_email, count]) => ({ from_email, count }))

  return {
    period: args.period ?? 'today',
    total_received: list.length,
    by_status: byStatus,
    by_urgence: byUrgence,
    by_type: byType,
    drafts_pending: list.filter((e) => e.draft_status === 'pending_review').length,
    drafts_sent: list.filter(
      (e) => e.draft_status === 'sent' || e.draft_status === 'edited_sent',
    ).length,
    top_senders: topSenders,
  }
}
