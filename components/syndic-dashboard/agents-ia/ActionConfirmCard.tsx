'use client'

import type { ToolCall, ToolDescriptor, Locale } from '@/lib/syndic/agent-types'

interface Props {
  toolCall: ToolCall
  descriptor: ToolDescriptor
  locale: Locale
  onConfirm: () => void
  onCancel: () => void
}

export default function ActionConfirmCard({
  toolCall,
  descriptor,
  locale,
  onConfirm,
  onCancel,
}: Props) {
  const label = locale === 'pt' ? descriptor.label.pt : descriptor.label.fr
  const description =
    locale === 'pt' ? descriptor.description.pt : descriptor.description.fr
  const confirmLabel = locale === 'pt' ? 'Confirmar' : 'Confirmer'
  const cancelLabel = locale === 'pt' ? 'Cancelar' : 'Annuler'

  return (
    <div
      role="dialog"
      aria-labelledby="action-confirm-title"
      style={{
        margin: '12px 24px',
        padding: 16,
        borderRadius: 12,
        background: 'var(--sd-gold-dim)',
        border: '1px solid var(--sd-gold)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--sd-gold)',
          letterSpacing: '1px',
          textTransform: 'uppercase',
        }}
      >
        {locale === 'pt' ? 'Ação proposta' : 'Action proposée'}
      </div>
      <div
        id="action-confirm-title"
        style={{ marginTop: 4, fontSize: 15, fontWeight: 600 }}
      >
        {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'rgba(0,0,0,0.7)' }}>
        {description}
      </div>
      <pre
        style={{
          marginTop: 8,
          padding: 10,
          background: 'rgba(0,0,0,0.04)',
          borderRadius: 6,
          fontSize: 11,
          overflow: 'auto',
          maxHeight: 200,
        }}
      >
        {JSON.stringify(toolCall.arguments, null, 2)}
      </pre>
      <div
        style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '1px solid var(--sd-border)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '8px 16px',
            background: 'var(--sd-gold)',
            color: 'var(--sd-navy)',
            border: 0,
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
