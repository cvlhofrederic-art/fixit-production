'use client'

import { useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'
import { useAlfredoStatus } from '../alfredo/useAlfredoStatus'
import { AlfredoEmptyState } from '../alfredo/AlfredoEmptyState'
import { AlfredoLoadedView } from '../alfredo/AlfredoLoadedView'

interface UserWithProfile extends User {
  profile?: { country?: string }
}

export default function AlfredoAgentPage({ user }: { user: UserWithProfile }) {
  const uiLocale = useLocale()
  const locale = (uiLocale === 'pt' ? 'pt' : 'fr') as 'fr' | 'pt'
  const { status, loading } = useAlfredoStatus()

  if (loading || !status) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'rgba(0,0,0,0.5)' }}>
        {locale === 'pt' ? 'A carregar Alfredo…' : 'Chargement d’Alfredo…'}
      </div>
    )
  }

  const handleConnectGmail = () => {
    window.location.href = '/api/email-agent/connect'
  }

  const handlePickPrompt = (_prompt: string) => {
    // Lot 5 : pas d'action ; les prompts deviendront cliquables en Lot 5+ quand on aura
    // un store global pour pré-remplir l'input chat. Ici on no-op pour ne pas casser l'UX.
  }

  if (!status.connected) {
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--sd-bg, white)' }}>
        <AlfredoEmptyState
          connected={false}
          draftsPending={0}
          emailsAnalysed={0}
          locale={locale}
          onPickPrompt={handlePickPrompt}
          onConnectGmail={handleConnectGmail}
        />
      </div>
    )
  }

  if (status.drafts_pending === 0 && status.emails_analysed === 0) {
    return (
      <div style={{ minHeight: 'calc(100vh - 80px)', background: 'var(--sd-bg, white)' }}>
        <AlfredoEmptyState
          connected={true}
          draftsPending={0}
          emailsAnalysed={0}
          locale={locale}
          onPickPrompt={handlePickPrompt}
          onConnectGmail={handleConnectGmail}
        />
      </div>
    )
  }

  return (
    <div style={{ height: 'calc(100vh - 80px)' }}>
      <AlfredoLoadedView
        user={user}
        locale={locale}
        connected={status.connected}
        draftsPending={status.drafts_pending}
        emailsAnalysed={status.emails_analysed}
      />
    </div>
  )
}
