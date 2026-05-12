// components/syndic-dashboard/agents-ia/MessageList.tsx
'use client'

import { useEffect, useRef } from 'react'
import { safeMarkdownToHTML } from '@/lib/sanitize'
import type { Message, AgentId } from '@/lib/syndic/agent-types'

interface Props {
  messages: Message[]
  streamingPartial?: string
  agentAvatarEmoji: string
  agentAccentColor: string
  onSendToAgent?: (target: AgentId, originMessageContent: string) => void
  crossAgentReferrals?: AgentId[]
  locale: 'fr' | 'pt'
}

const AGENT_LABELS: Record<AgentId, { fr: string; pt: string }> = {
  fixy: { fr: 'Fixy', pt: 'Fixy' },
  max: { fr: 'Max', pt: 'Max' },
  lea: { fr: 'Léa', pt: 'Léa' },
  alfredo: { fr: 'Alfredo', pt: 'Alfredo' },
}

export default function MessageList({
  messages,
  streamingPartial,
  agentAvatarEmoji,
  agentAccentColor,
  onSendToAgent,
  crossAgentReferrals = [],
  locale,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages.length, streamingPartial])

  return (
    <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      {messages.map(m => (
        <div
          key={m.id}
          data-role={m.role}
          style={{
            marginBottom: 20,
            display: 'flex',
            gap: 12,
            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background:
                m.role === 'user' ? 'var(--sd-navy)' : `var(--sd-${agentAccentColor})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {m.role === 'user' ? '👤' : agentAvatarEmoji}
          </div>
          <div style={{ maxWidth: '75%' }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: m.role === 'user' ? 'var(--sd-navy)' : 'var(--sd-bg-2)',
                color: m.role === 'user' ? '#fff' : 'inherit',
                fontSize: 14,
                lineHeight: 1.55,
              }}
              // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- contenu sanitizé via safeMarkdownToHTML (lib/sanitize.ts) avant injection
              dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(m.content) }}
            />
            {m.role === 'assistant' && crossAgentReferrals.length > 0 && onSendToAgent && (
              <div
                style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}
              >
                {crossAgentReferrals.map(target => (
                  <button
                    key={target}
                    onClick={() => onSendToAgent(target, m.content)}
                    style={{
                      fontSize: 11,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: 'var(--sd-bg-3)',
                      border: '1px solid var(--sd-border)',
                      cursor: 'pointer',
                    }}
                  >
                    → {AGENT_LABELS[target][locale]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      {streamingPartial && (
        <div
          data-role="assistant-stream"
          style={{ marginBottom: 20, display: 'flex', gap: 12 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `var(--sd-${agentAccentColor})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 16,
              flexShrink: 0,
            }}
          >
            {agentAvatarEmoji}
          </div>
          <div
            style={{
              maxWidth: '75%',
              padding: '12px 16px',
              borderRadius: 12,
              background: 'var(--sd-bg-2)',
              fontSize: 14,
              lineHeight: 1.55,
            }}
            // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml -- contenu sanitizé via safeMarkdownToHTML (lib/sanitize.ts) avant injection
            dangerouslySetInnerHTML={{ __html: safeMarkdownToHTML(streamingPartial) }}
          />
        </div>
      )}
    </div>
  )
}
