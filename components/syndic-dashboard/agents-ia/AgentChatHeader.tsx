'use client'

import type { AgentConfig, Locale } from '@/lib/syndic/agent-types'

interface Props {
  agentConfig: AgentConfig
  locale: Locale
  voiceEnabled: boolean
  onToggleVoice: () => void
}

export default function AgentChatHeader({
  agentConfig,
  locale,
  voiceEnabled,
  onToggleVoice,
}: Props) {
  const name = locale === 'pt' ? agentConfig.displayName.pt : agentConfig.displayName.fr
  const tagline = locale === 'pt' ? agentConfig.tagline.pt : agentConfig.tagline.fr

  return (
    <div
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--sd-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--sd-bg)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: `var(--sd-${agentConfig.accentColor})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 22,
        }}
      >
        {agentConfig.avatarEmoji}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)' }}>{tagline}</div>
      </div>
      {agentConfig.voice && (
        <button
          onClick={onToggleVoice}
          aria-label={locale === 'pt' ? 'Alternar voz' : 'Activer voix'}
          aria-pressed={voiceEnabled}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: voiceEnabled ? 'var(--sd-gold-dim)' : 'var(--sd-bg-2)',
            border: '1px solid var(--sd-border)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          🔊 {locale === 'pt' ? 'Voz' : 'Voix'}
        </button>
      )}
    </div>
  )
}
