import { describe, it, expect, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAlfredoStatus } from '@/components/syndic-dashboard/agents-ia/alfredo/useAlfredoStatus'

describe('useAlfredoStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renvoie loading=true puis le statut quand /status répond', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          connected: true,
          email_compte: 'syndic@cabinet.fr',
          drafts_pending: 3,
          emails_analysed: 42,
        }),
      }),
    )

    const { result } = renderHook(() => useAlfredoStatus())
    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(true)
    expect(result.current.status?.drafts_pending).toBe(3)
  })

  it('renvoie connected=false quand /status renvoie 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }),
    )

    const { result } = renderHook(() => useAlfredoStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(false)
  })

  it('renvoie connected=false si fetch rejette (erreur réseau)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const { result } = renderHook(() => useAlfredoStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status?.connected).toBe(false)
    expect(result.current.error).toBe('network down')
  })

  it('refetch() déclenche un nouvel appel à /status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ connected: false, email_compte: null, drafts_pending: 0, emails_analysed: 0 }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useAlfredoStatus())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await result.current.refetch()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
