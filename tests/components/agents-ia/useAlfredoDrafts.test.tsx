import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAlfredoDrafts } from '@/components/syndic-dashboard/agents-ia/hooks/useAlfredoDrafts'

describe('useAlfredoDrafts', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ drafts: [{ id: 'd1', from_email: 'a@b.fr', subject: 'X', body_preview: '', received_at: new Date().toISOString(), draft_subject: 'Re: X', draft_body_text: 'body', draft_body_html: '<p>body</p>', draft_status: 'pending_review', draft_meta: null, draft_generated_at: new Date().toISOString() }] }),
    } as Response)
  })

  afterEach(() => { fetchSpy.mockRestore() })

  it('fetch initial drafts pending', async () => {
    const { result } = renderHook(() => useAlfredoDrafts())
    await waitFor(() => expect(result.current.drafts).toHaveLength(1))
    expect(result.current.drafts[0].id).toBe('d1')
  })
})
