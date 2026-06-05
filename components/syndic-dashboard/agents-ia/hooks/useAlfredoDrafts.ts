import { useCallback, useEffect, useState } from 'react'

export interface AlfredoDraft {
  id: string
  from_email: string
  subject: string
  body_preview: string
  received_at: string
  urgence?: string
  type_demande?: string
  draft_subject: string | null
  draft_body_text: string | null
  draft_body_html: string | null
  draft_status: 'pending_review' | 'approved' | 'sent' | 'edited_sent' | 'skipped' | 'expired'
  draft_meta: Record<string, unknown> | null
  draft_generated_at: string | null
}

export function useAlfredoDrafts(status: AlfredoDraft['draft_status'] = 'pending_review') {
  const [drafts, setDrafts] = useState<AlfredoDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/email-agent/drafts?status=${status}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { drafts: AlfredoDraft[] }
      setDrafts(json.drafts)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { refetch() }, [refetch])

  const updateDraft = useCallback(async (
    id: string,
    patch: Partial<Pick<AlfredoDraft, 'draft_status' | 'draft_subject' | 'draft_body_text' | 'draft_body_html'>>
  ) => {
    const res = await fetch(`/api/email-agent/drafts/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update_failed')
    const json = await res.json() as { draft: AlfredoDraft }
    setDrafts(prev => prev.map(d => d.id === id ? json.draft : d))
    return json.draft
  }, [])

  return { drafts, loading, error, refetch, updateDraft }
}
