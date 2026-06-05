/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useConversations } from '@/components/syndic-dashboard/agents-ia/hooks/useConversations'

describe('useConversations', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ conversations: [{ id: 'c1', syndic_id: 's1', agent_id: 'fixy', locale: 'fr', title: 'Test', immeuble_id: null, message_count: 0, last_message_preview: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), archived_at: null }] }),
    } as Response)
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  it('fetch initial puis expose la liste', async () => {
    const { result } = renderHook(() => useConversations('fixy'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.conversations).toHaveLength(1)
    expect(result.current.conversations[0].title).toBe('Test')
  })

  it('createConversation appelle POST puis prepend à la liste', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true, json: async () => ({ conversations: [] }),
    } as Response).mockResolvedValueOnce({
      ok: true, json: async () => ({ conversation: { id: 'c2', syndic_id: 's1', agent_id: 'fixy', locale: 'fr', title: 'Nouvelle', immeuble_id: null, message_count: 0, last_message_preview: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), archived_at: null } }),
    } as Response)

    const { result } = renderHook(() => useConversations('fixy'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.createConversation({ agent_id: 'fixy', locale: 'fr' })
    })
    expect(result.current.conversations[0].title).toBe('Nouvelle')
    expect(fetchSpy).toHaveBeenCalledWith('/api/syndic/conversations', expect.objectContaining({ method: 'POST' }))
  })

  it('deleteConversation retire de la liste', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true, json: async () => ({ conversations: [{ id: 'c1', syndic_id: 's1', agent_id: 'fixy', locale: 'fr', title: 'A', immeuble_id: null, message_count: 0, last_message_preview: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), archived_at: null }] }),
    } as Response).mockResolvedValueOnce({
      ok: true, json: async () => ({ ok: true }),
    } as Response)

    const { result } = renderHook(() => useConversations('fixy'))
    await waitFor(() => expect(result.current.conversations).toHaveLength(1))

    await act(async () => {
      await result.current.deleteConversation('c1')
    })
    expect(result.current.conversations).toHaveLength(0)
  })
})
