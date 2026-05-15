'use client'

import { useState } from 'react'
import AgentChatPage from '../AgentChatPage'
import AutomationsListView from '../AutomationsListView'
import { AGENT_CONFIGS } from '../configs'
import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

type Mode = 'list' | 'chat'

export default function TempoAgentPage({ user }: { user: UserWithProfile }) {
  const [mode, setMode] = useState<Mode>('list')
  const uiLocale = useLocale()
  const locale = (uiLocale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'

  const labels =
    locale === 'pt' ? { list: 'Lista', chat: 'Conversa' } : { list: 'Liste', chat: 'Discussion' }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 'calc(100vh - 80px)' }}
    >
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 12,
          borderBottom: '1px solid var(--sd-border)',
          background: 'var(--sd-bg-2)',
        }}
      >
        <button
          onClick={() => setMode('list')}
          aria-pressed={mode === 'list'}
          style={tabStyle(mode === 'list')}
        >
          🔄 {labels.list}
        </button>
        <button
          onClick={() => setMode('chat')}
          aria-pressed={mode === 'chat'}
          style={tabStyle(mode === 'chat')}
        >
          💬 {labels.chat}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'list' ? (
          <AutomationsListView locale={locale} />
        ) : (
          <AgentChatPage agentConfig={AGENT_CONFIGS.tempo} user={user} />
        )}
      </div>
    </div>
  )
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    background: active ? 'var(--sd-gold)' : 'transparent',
    color: active ? 'var(--sd-navy)' : 'inherit',
    border: '1px solid var(--sd-border)',
    cursor: 'pointer',
    fontWeight: 600,
  }
}
