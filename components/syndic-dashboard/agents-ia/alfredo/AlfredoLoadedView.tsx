'use client'

import type { User } from '@supabase/supabase-js'
import AlfredoInboxView from '../AlfredoInboxView'
import AgentChatPage from '../AgentChatPage'
import { AGENT_CONFIGS } from '../configs'
import { AlfredoStatusBadge } from './AlfredoStatusBadge'
import { AlfredoChatSidebar } from './AlfredoChatSidebar'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

interface Props {
  user: UserWithProfile
  locale: 'fr' | 'pt'
  connected: boolean
  draftsPending: number
  emailsAnalysed: number
}

export function AlfredoLoadedView({ user, locale, connected, draftsPending, emailsAnalysed }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
          background: 'var(--sd-bg-2, #f7f4ec)',
        }}
      >
        <strong style={{ fontSize: 15 }}>📧 Alfredo</strong>
        <AlfredoStatusBadge
          connected={connected}
          draftsPending={draftsPending}
          emailsAnalysed={emailsAnalysed}
          locale={locale}
        />
      </header>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <AlfredoInboxView locale={locale} />
        </div>
        <AlfredoChatSidebar locale={locale}>
          <AgentChatPage agentConfig={AGENT_CONFIGS.alfredo} user={user} />
        </AlfredoChatSidebar>
      </div>
    </div>
  )
}
