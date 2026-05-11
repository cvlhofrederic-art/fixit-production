import { describe, it, expect, vi } from 'vitest'
import { processIncomingEmail } from '@/lib/syndic/alfredo-pipeline'

describe('processIncomingEmail', () => {
  it('orchestre classify → load_context → draft → insert', async () => {
    const classifyMock = vi.fn().mockResolvedValue({
      urgence: 'normale', type_demande: 'sinistre', resume_court: 'Fuite eau',
    })
    const loadContextMock = vi.fn().mockResolvedValue({
      client_token: 'ct_abc',
      copro_status: 'identified',
      history_summary: { total_emails: 5, last_topics: [], sentiment_drift: 'neutre', last_resolved_topics: [] },
      recent_interactions: [],
      open_items: { missions: [], devis_en_cours: [], sinistres: [], signalements: [] },
      missing_info_hints: [],
      rbac_omitted_fields: [],
    })
    const draftMock = vi.fn().mockResolvedValue({
      subject_suggested: 'Re: Fuite',
      body_text: 'Madame, ...',
      body_html: '<p>Madame, ...</p>',
      confidence: 0.85,
      missing_info: [],
      suggested_next_actions: [],
    })
    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'email-id' }, error: null })

    const result = await processIncomingEmail({
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      locale: 'fr',
      email: { from: 'a@b.fr', subject: 'Fuite', body_text: 'fuite eau...', gmail_message_id: 'gm', received_at: '2026-05-13T10:00:00Z' },
      classifyFn: classifyMock,
      loadContextFn: loadContextMock,
      draftFn: draftMock,
      insertFn: insertMock,
    })

    expect(result.status).toBe('drafted')
    expect(result.email_id).toBe('email-id')
    expect(classifyMock).toHaveBeenCalled()
    expect(loadContextMock).toHaveBeenCalledWith(expect.objectContaining({ emailAddress: 'a@b.fr' }))
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
      draft_status: 'pending_review',
      draft_subject: 'Re: Fuite',
    }))
  })

  it('skip draft si classifier retourne spam', async () => {
    const insertMock = vi.fn().mockResolvedValue({ data: { id: 'e' }, error: null })
    const result = await processIncomingEmail({
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      locale: 'fr',
      email: { from: 'spam@x.com', subject: 'Win', body_text: '...', gmail_message_id: 'gm', received_at: '2026-05-13T10:00:00Z' },
      classifyFn: vi.fn().mockResolvedValue({ urgence: 'normale', type_demande: 'spam', resume_court: '' }),
      loadContextFn: vi.fn(),
      draftFn: vi.fn(),
      insertFn: insertMock,
    })
    expect(result.status).toBe('skipped_spam')
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ draft_status: 'none' }))
  })

  it('retourne error si insertFn échoue', async () => {
    const result = await processIncomingEmail({
      syndicId: 's1',
      syndicRole: 'syndic_admin',
      locale: 'fr',
      email: { from: 'a@b.fr', subject: 'X', body_text: '...', gmail_message_id: 'gm', received_at: '2026-05-13T10:00:00Z' },
      classifyFn: vi.fn().mockResolvedValue({ urgence: 'normale', type_demande: 'sinistre', resume_court: '' }),
      loadContextFn: vi.fn().mockResolvedValue({
        client_token: 'ct', copro_status: 'unknown',
        history_summary: { total_emails: 0, last_topics: [], sentiment_drift: 'neutre', last_resolved_topics: [] },
        recent_interactions: [],
        open_items: { missions: [], devis_en_cours: [], sinistres: [], signalements: [] },
        missing_info_hints: [], rbac_omitted_fields: [],
      }),
      draftFn: vi.fn().mockResolvedValue({
        subject_suggested: 'Re', body_text: '', body_html: '', confidence: 0,
        missing_info: [], suggested_next_actions: [],
      }),
      insertFn: vi.fn().mockResolvedValue({ data: null, error: { message: 'db failed' } }),
    })
    expect(result.status).toBe('error')
  })
})
