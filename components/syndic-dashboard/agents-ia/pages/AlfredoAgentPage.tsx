'use client'

import { useState } from 'react'
import AgentChatPage from '../AgentChatPage'
import AlfredoInboxView from '../AlfredoInboxView'
import { AGENT_CONFIGS } from '../configs'
import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

type Mode = 'inbox' | 'chat'

export default function AlfredoAgentPage({ user }: { user: UserWithProfile }) {
  const [mode, setMode] = useState<Mode>('inbox')
  const uiLocale = useLocale()
  const locale = (uiLocale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'

  const labels = locale === 'pt'
    ? { inbox: 'Inbox', chat: 'Conversa' }
    : { inbox: 'Inbox', chat: 'Discussion' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 80px)' }}>
      <div style={{
        display: 'flex', gap: 4, padding: 12,
        borderBottom: '1px solid var(--sd-border)',
        background: 'var(--sd-bg-2)',
      }}>
        <button
          onClick={() => setMode('inbox')}
          aria-pressed={mode === 'inbox'}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: mode === 'inbox' ? 'var(--sd-gold)' : 'transparent',
            color: mode === 'inbox' ? 'var(--sd-navy)' : 'inherit',
            border: '1px solid var(--sd-border)',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          📬 {labels.inbox}
        </button>
        <button
          onClick={() => setMode('chat')}
          aria-pressed={mode === 'chat'}
          style={{
            padding: '8px 16px', borderRadius: 8,
            background: mode === 'chat' ? 'var(--sd-gold)' : 'transparent',
            color: mode === 'chat' ? 'var(--sd-navy)' : 'inherit',
            border: '1px solid var(--sd-border)',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          💬 {labels.chat}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'inbox'
          ? <AlfredoInboxView locale={locale} />
          : <AgentChatPage agentConfig={AGENT_CONFIGS.alfredo} user={user} />}
      </div>
    </div>
  )
}
