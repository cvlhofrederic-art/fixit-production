import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAlfredoStatus } from '@/components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus'

describe('useAlfredoStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renvoie loading=true puis le statut quand /status répond', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        connected: true,
        email_compte: 'syndic@cabinet.fr',
        drafts_pending: 3,
        emails_analysed: 42,
      }),
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useAlfredoStatus())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(true)
    expect(result.current.status?.drafts_pending).toBe(3)
  })

  it('renvoie connected=false quand /status renvoie 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    const { result } = renderHook(() => useAlfredoStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(false)
  })
})
