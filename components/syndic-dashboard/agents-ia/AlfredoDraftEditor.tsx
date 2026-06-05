'use client'

import { useState } from 'react'
import type { AlfredoDraft } from './hooks/useAlfredoDrafts'

interface Props {
  draft: AlfredoDraft
  locale: 'fr' | 'pt'
  onSend: (id: string, edited: { subject: string; body_text: string }) => Promise<void>
  onSkip: (id: string) => Promise<void>
}

export default function AlfredoDraftEditor({ draft, locale, onSend, onSkip }: Props) {
  const [subject, setSubject] = useState(draft.draft_subject ?? '')
  const [bodyText, setBodyText] = useState(draft.draft_body_text ?? '')
  const [sending, setSending] = useState(false)

  const labels = locale === 'pt'
    ? { send: 'Enviar', skip: 'Ignorar', subject: 'Assunto', body: 'Mensagem', confidence: 'Confiança' }
    : { send: 'Envoyer', skip: 'Ignorer', subject: 'Objet', body: 'Message', confidence: 'Confiance' }

  const handleSend = async () => {
    setSending(true)
    try {
      await onSend(draft.id, { subject, body_text: bodyText })
    } finally {
      setSending(false)
    }
  }

  const confidence = (draft.draft_meta as { confidence?: number } | null)?.confidence ?? 0

  return (
    <div style={{ padding: 20, background: 'var(--sd-bg)', borderRadius: 12 }}>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {labels.subject}
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          aria-label={labels.subject}
          style={{
            width: '100%', padding: 8,
            border: '1px solid var(--sd-border)', borderRadius: 6, fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
          {labels.body}
        </label>
        <textarea
          value={bodyText}
          onChange={e => setBodyText(e.target.value)}
          rows={12}
          aria-label={labels.body}
          style={{
            width: '100%', padding: 10,
            border: '1px solid var(--sd-border)', borderRadius: 6,
            fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
          }}
        />
      </div>

      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', marginBottom: 12 }}>
        {labels.confidence}: {(confidence * 100).toFixed(0)}%
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={() => onSkip(draft.id)}
          style={{
            padding: '8px 16px', background: 'transparent',
            border: '1px solid var(--sd-border)', borderRadius: 8, cursor: 'pointer',
          }}
        >
          {labels.skip}
        </button>
        <button
          onClick={handleSend}
          disabled={sending || !subject || !bodyText}
          style={{
            padding: '8px 16px', background: 'var(--sd-gold)',
            color: 'var(--sd-navy)', border: 0, borderRadius: 8,
            fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending || !subject || !bodyText ? 0.5 : 1,
          }}
        >
          {sending ? '...' : labels.send}
        </button>
      </div>
    </div>
  )
}
