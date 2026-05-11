// components/syndic-dashboard/agents-ia/AgentChatPage.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'
import type { AgentConfig, Message, ToolCall } from '@/lib/syndic/agent-types'
import { resolveAgentLocale } from '@/lib/syndic/agent-locale-resolver'
import { useConversations } from './hooks/useConversations'
import { useAgentStream } from './hooks/useAgentStream'
import { useActionConfirmation } from './hooks/useActionConfirmation'
import ConversationSidebar from './ConversationSidebar'
import AgentChatHeader from './AgentChatHeader'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ActionConfirmCard from './ActionConfirmCard'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

interface Props {
  agentConfig: AgentConfig
  user: UserWithProfile
}

export default function AgentChatPage({ agentConfig, user }: Props) {
  const uiLocale = useLocale()
  const {
    conversations,
    createConversation,
    updateConversation,
    deleteConversation,
    loading,
  } = useConversations(agentConfig.id)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesRef = useRef<Message[]>([])
  const [voiceEnabled, setVoiceEnabled] = useState(false)

  // Ref synchronisé pour éviter la stale closure dans handleSend
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const stream = useAgentStream(agentConfig)
  const {
    pendingAction,
    request: requestConfirm,
    confirm: confirmAction,
    cancel: cancelAction,
  } = useActionConfirmation()

  // Hydrate la conversation active
  useEffect(() => {
    if (!activeId) {
      setMessages([])
      return
    }
    let aborted = false
    void (async () => {
      const res = await fetch(`/api/syndic/conversations/${activeId}/messages`)
      if (!res.ok || aborted) return
      const json = (await res.json()) as { messages: Message[] }
      if (!aborted) setMessages(json.messages)
    })()
    return () => {
      aborted = true
    }
  }, [activeId])

  // Auto-sélection de la conversation la plus récente après chargement
  useEffect(() => {
    if (!loading && !activeId && conversations.length > 0) {
      setActiveId(conversations[0].id)
    }
  }, [loading, conversations, activeId])

  const activeConv = useMemo(
    () => conversations.find(c => c.id === activeId) ?? null,
    [conversations, activeId],
  )

  const resolvedLocale = activeConv?.locale ?? resolveAgentLocale(user, undefined, uiLocale)

  const handleNew = useCallback(async () => {
    const locale = resolveAgentLocale(user, undefined, uiLocale)
    const newConv = await createConversation({ agent_id: agentConfig.id, locale })
    setActiveId(newConv.id)
    setMessages([])
  }, [agentConfig.id, createConversation, uiLocale, user])

  const handleSend = useCallback(
    async (text: string) => {
      let conv = activeConv
      if (!conv) {
        const locale = resolveAgentLocale(user, undefined, uiLocale)
        conv = await createConversation({
          agent_id: agentConfig.id,
          locale,
          title: text.slice(0, 60),
        })
        setActiveId(conv.id)
      }

      // Message user en optimiste local
      const userMsgLocal: Message = {
        id: `tmp-${Date.now()}`,
        conversation_id: conv.id,
        role: 'user',
        content: text,
        tool_calls: null,
        metadata: null,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, userMsgLocal])

      // Persistance user message
      await fetch(`/api/syndic/conversations/${conv.id}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text }),
      })

      // Appel agent (messagesRef.current évite la stale closure lors d'envois rapides successifs)
      try {
        const result = await stream.send({
          conversationId: conv.id,
          message: text,
          history: messagesRef.current,
          locale: conv.locale,
        })

        // Si tool call destructif, demande confirmation
        let toolCalls: ToolCall[] | null = null
        if (result.tool_calls && Array.isArray(result.tool_calls) && result.tool_calls.length > 0) {
          const tc = result.tool_calls[0] as ToolCall
          const descriptor = agentConfig.toolDescriptors.find(t => t.name === tc.tool_name)
          if (descriptor?.requiresConfirmation) {
            const confirmed = await requestConfirm(tc)
            tc.status = confirmed ? 'confirmed' : 'cancelled'
          } else {
            tc.status = 'executed'
          }
          toolCalls = [tc]
        }

        const assistantMsg: Message = {
          id: `tmp-${Date.now() + 1}`,
          conversation_id: conv.id,
          role: 'assistant',
          content: result.content,
          tool_calls: toolCalls,
          metadata: null,
          created_at: new Date().toISOString(),
        }
        setMessages(prev => [...prev, assistantMsg])

        // Note : la persistance du message assistant est à la charge de l'agent endpoint (Plan A.next).
        // Le client ne peut insérer que role:'user' — voir app/api/syndic/conversations/[id]/messages/route.ts

        // Auto-rename si 1er échange (utilise messagesRef pour éviter stale closure)
        if (messagesRef.current.length === 0 && conv.title === 'Nouvelle conversation') {
          const newTitle = text.slice(0, 60)
          await updateConversation(conv.id, { title: newTitle })
        }
      } catch (err) {
        console.error('agent send failed', err)
      }
    },
    [
      activeConv,
      agentConfig,
      createConversation,
      requestConfirm,
      stream,
      uiLocale,
      updateConversation,
      user,
    ],
  )

  const handleSendToAgent = useCallback(
    (targetAgent: string, originContent: string) => {
      // Cross-agent referral : exposé pour future intégration (Plan A.7 / Plan C)
      console.info('[cross-agent referral]', targetAgent, originContent.slice(0, 50))
    },
    [],
  )

  const activeDescriptor = pendingAction
    ? agentConfig.toolDescriptors.find(t => t.name === pendingAction.tool_name) ?? null
    : null

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        minHeight: 'calc(100vh - 80px)',
        background: 'var(--sd-bg)',
      }}
    >
      <ConversationSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNew={handleNew}
        onDelete={async id => {
          await deleteConversation(id)
          if (activeId === id) setActiveId(null)
        }}
        onRename={async (id, title) => {
          await updateConversation(id, { title })
        }}
        locale={resolvedLocale}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <AgentChatHeader
          agentConfig={agentConfig}
          locale={resolvedLocale}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(v => !v)}
        />
        <MessageList
          messages={messages}
          streamingPartial={stream.pending ? stream.partial : undefined}
          agentAvatarEmoji={agentConfig.avatarEmoji}
          agentAccentColor={agentConfig.accentColor}
          onSendToAgent={handleSendToAgent}
          crossAgentReferrals={agentConfig.crossAgentReferrals}
          locale={resolvedLocale}
        />
        {pendingAction && activeDescriptor && (
          <ActionConfirmCard
            toolCall={pendingAction}
            descriptor={activeDescriptor}
            locale={resolvedLocale}
            onConfirm={confirmAction}
            onCancel={cancelAction}
          />
        )}
        <MessageInput
          onSend={handleSend}
          voiceEnabled={voiceEnabled && agentConfig.voice}
          locale={resolvedLocale}
          disabled={stream.pending}
        />
      </div>
    </div>
  )
}
