import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAgentStream } from '@/components/syndic-dashboard/agents-ia/hooks/useAgentStream'
import type { AgentConfig } from '@/lib/syndic/agent-types'

const mockConfig: AgentConfig = {
  id: 'fixy',
  displayName: { fr: 'Fixy', pt: 'Fixy' },
  tagline: { fr: '', pt: '' },
  avatarEmoji: '🤖',
  accentColor: 'gold',
  endpoint: '/api/test',
  streaming: false,
  voice: false,
  suggestedPrompts: { fr: [], pt: [] },
  toolDescriptors: [],
  allowedRoles: ['syndic'],
  crossAgentReferrals: [],
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAgentStream', () => {
  it('send appelle endpoint et retourne contenu', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ content: 'Hello!' }),
    } as Response)

    const { result } = renderHook(() => useAgentStream(mockConfig))
    let response: { content: string } | undefined
    await act(async () => {
      response = await result.current.send({
        conversationId: 'c1', message: 'Hi', history: [], locale: 'fr',
      })
    })
    expect(response?.content).toBe('Hello!')
  })

  it('send échoue avec erreur si status non OK', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false, status: 500 } as Response)
    const { result } = renderHook(() => useAgentStream(mockConfig))
    await expect(
      result.current.send({ conversationId: 'c1', message: 'Hi', history: [], locale: 'fr' })
    ).rejects.toThrow('agent_500')
  })

  it('cancel abort la requête en cours', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() =>
      new Promise(() => {}) // never resolves
    )
    const { result } = renderHook(() => useAgentStream(mockConfig))
    act(() => {
      result.current.send({ conversationId: 'c1', message: 'Hi', history: [], locale: 'fr' }).catch(() => {})
    })
    act(() => result.current.cancel())
    expect(result.current.pending).toBe(false)
  })
})
