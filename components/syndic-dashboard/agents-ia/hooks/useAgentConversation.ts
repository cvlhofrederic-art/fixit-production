// Hook partagé pour les pages agents IA Léa-style (Léa, Alfredo, Fixy, Tempo).
// Gère : liste de conversations, création/sélection/suppression/renommage,
// hydratation des messages quand on bascule sur une conversation, et helpers
// de persistance (user + assistant) sur /api/syndic/conversations/{id}/messages.
//
// L'UI rend ConversationSidebar (gauche) + chat custom (droite). Le chat custom
// continue à appeler son endpoint agent dédié, le hook s'occupe juste de la
// persistance DB en parallèle de l'affichage optimiste local.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useConversations } from './useConversations'
import type { AgentId, Locale, Message } from '@/lib/syndic/agent-types'

export type PersistedMsg = { role: 'user' | 'assistant'; content: string }

export function useAgentConversation(agentId: AgentId, locale: Locale) {
  const {
    conversations,
    createConversation,
    updateConversation,
    deleteConversation,
    loading,
  } = useConversations(agentId)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<PersistedMsg[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const skipHydrationRef = useRef(false)

  // Hydrate messages quand on bascule sur une conversation
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    if (skipHydrationRef.current) {
      skipHydrationRef.current = false
      return
    }
    let aborted = false
    setMessagesLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/syndic/conversations/${activeId}/messages`)
        if (!res.ok || aborted) return
        const json = (await res.json()) as { messages: Message[] }
        if (aborted) return
        const filtered = json.messages
          .filter((m): m is Message & { role: 'user' | 'assistant' } => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.content }))
        setMessages(filtered)
      } catch {
        // silent — garde l'état précédent
      } finally {
        if (!aborted) setMessagesLoading(false)
      }
    })()
    return () => {
      aborted = true
    }
  }, [activeId])

  const ensureConversation = useCallback(
    async (firstUserMessage: string): Promise<string> => {
      if (activeId) return activeId
      const conv = await createConversation({
        agent_id: agentId,
        locale,
        title: firstUserMessage.slice(0, 60),
      })
      skipHydrationRef.current = true
      setActiveId(conv.id)
      return conv.id
    },
    [activeId, agentId, createConversation, locale],
  )

  const persistMessage = useCallback(
    async (convId: string, role: 'user' | 'assistant', content: string) => {
      try {
        await fetch(`/api/syndic/conversations/${convId}/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ role, content }),
        })
      } catch {
        // best-effort persistence — l'affichage optimiste local reste
      }
    },
    [],
  )

  const handleNew = useCallback(() => {
    setActiveId(null)
    setMessages([])
  }, [])

  const handleSelect = useCallback((id: string) => {
    setActiveId(id)
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteConversation(id)
      if (activeId === id) {
        setActiveId(null)
        setMessages([])
      }
    },
    [activeId, deleteConversation],
  )

  const handleRename = useCallback(
    async (id: string, newTitle: string) => {
      await updateConversation(id, { title: newTitle })
    },
    [updateConversation],
  )

  return {
    conversations,
    activeId,
    messages,
    setMessages,
    loading,
    messagesLoading,
    ensureConversation,
    persistMessage,
    handleNew,
    handleSelect,
    handleDelete,
    handleRename,
  }
}
