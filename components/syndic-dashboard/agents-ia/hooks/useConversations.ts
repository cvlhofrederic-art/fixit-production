import { useCallback, useEffect, useState } from 'react'
import type { AgentId, Conversation, Locale } from '@/lib/syndic/agent-types'

interface CreateParams {
  agent_id: AgentId
  locale: Locale
  title?: string
  immeuble_id?: string
}

export function useConversations(agentId: AgentId) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/syndic/conversations?agent_id=${agentId}`)
      if (!res.ok) throw new Error(`status_${res.status}`)
      const json = await res.json() as { conversations: Conversation[] }
      setConversations(json.conversations)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown_error')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => { refetch() }, [refetch])

  const createConversation = useCallback(async (params: CreateParams): Promise<Conversation> => {
    const res = await fetch('/api/syndic/conversations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    })
    if (!res.ok) throw new Error('create_failed')
    const json = await res.json() as { conversation: Conversation }
    setConversations(prev => [json.conversation, ...prev])
    return json.conversation
  }, [])

  const updateConversation = useCallback(async (id: string, patch: { title?: string }) => {
    const res = await fetch(`/api/syndic/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error('update_failed')
    const json = await res.json() as { conversation: Conversation }
    setConversations(prev => prev.map(c => c.id === id ? json.conversation : c))
    return json.conversation
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/syndic/conversations/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('delete_failed')
    setConversations(prev => prev.filter(c => c.id !== id))
  }, [])

  return {
    conversations,
    loading,
    error,
    refetch,
    createConversation,
    updateConversation,
    deleteConversation,
  }
}
