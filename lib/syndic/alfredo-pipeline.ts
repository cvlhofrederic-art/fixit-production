import type { SyndicRole, Locale } from './agent-types'
import type { ClientContext } from './alfredo-load-client-context'

interface IncomingEmail {
  from: string
  subject: string
  body_text: string
  body_html?: string
  gmail_message_id: string
  received_at: string
}

interface ClassifyResult {
  urgence: string
  type_demande: string
  resume_court: string
  immeuble_detecte?: string
  locataire_detecte?: string
}

interface DraftResult {
  subject_suggested: string
  body_text: string
  body_html: string
  confidence: number
  missing_info: string[]
  suggested_next_actions: Array<{ tool: string; args: Record<string, unknown> }>
}

export interface ProcessEmailParams {
  syndicId: string
  syndicRole: SyndicRole
  locale: Locale
  email: IncomingEmail
  classifyFn: (email: IncomingEmail, locale: Locale) => Promise<ClassifyResult>
  loadContextFn: (params: { syndicId: string; syndicRole: SyndicRole; emailAddress: string; locale: Locale }) => Promise<ClientContext>
  draftFn: (input: { email: IncomingEmail; client_context: ClientContext; classify: ClassifyResult; locale: Locale }) => Promise<DraftResult>
  insertFn: (row: Record<string, unknown>) => Promise<{ data: { id: string } | null; error: unknown }>
}

export interface ProcessEmailResult {
  status: 'drafted' | 'skipped_spam' | 'error'
  email_id?: string
  draft_confidence?: number
  error?: string
}

export async function processIncomingEmail(params: ProcessEmailParams): Promise<ProcessEmailResult> {
  const { syndicId, syndicRole, locale, email } = params

  try {
    const classify = await params.classifyFn(email, locale)

    if (classify.type_demande === 'spam') {
      const { data } = await params.insertFn({
        syndic_id: syndicId,
        from_email: email.from,
        subject: email.subject,
        body_preview: email.body_text.slice(0, 1000),
        gmail_message_id: email.gmail_message_id,
        received_at: email.received_at,
        type_demande: 'spam',
        urgence: classify.urgence,
        resume_court: classify.resume_court,
        draft_status: 'none',
      })
      return { status: 'skipped_spam', email_id: data?.id }
    }

    const clientContext = await params.loadContextFn({
      syndicId,
      syndicRole,
      emailAddress: email.from,
      locale,
    })

    const draft = await params.draftFn({
      email,
      client_context: clientContext,
      classify,
      locale,
    })

    const { data, error } = await params.insertFn({
      syndic_id: syndicId,
      from_email: email.from,
      subject: email.subject,
      body_preview: email.body_text.slice(0, 1000),
      gmail_message_id: email.gmail_message_id,
      received_at: email.received_at,
      type_demande: classify.type_demande,
      urgence: classify.urgence,
      resume_court: classify.resume_court,
      immeuble_detecte: classify.immeuble_detecte ?? null,
      locataire_detecte: classify.locataire_detecte ?? null,
      draft_subject: draft.subject_suggested,
      draft_body_text: draft.body_text,
      draft_body_html: draft.body_html,
      draft_status: 'pending_review',
      draft_generated_at: new Date().toISOString(),
      draft_meta: {
        confidence: draft.confidence,
        missing_info: draft.missing_info,
        suggested_next_actions: draft.suggested_next_actions,
        client_token: clientContext.client_token,
        rbac_omitted_fields: clientContext.rbac_omitted_fields,
      },
    })

    if (error) return { status: 'error', error: String(error) }

    return {
      status: 'drafted',
      email_id: data?.id,
      draft_confidence: draft.confidence,
    }
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'unknown' }
  }
}
