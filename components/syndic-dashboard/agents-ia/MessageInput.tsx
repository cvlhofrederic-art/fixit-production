'use client'

import { useEffect, useRef, useState } from 'react'
import { useVoiceInput } from './hooks/useVoiceInput'
import type { Locale } from '@/lib/syndic/agent-types'

interface Props {
  onSend: (text: string) => void
  voiceEnabled: boolean
  locale: Locale
  disabled?: boolean
  placeholder?: { fr: string; pt: string }
}

export default function MessageInput({
  onSend,
  voiceEnabled,
  locale,
  disabled,
  placeholder,
}: Props) {
  const [text, setText] = useState('')
  const [voicePendingSend, setVoicePendingSend] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { supported, listening, start, stop } = useVoiceInput({
    locale,
    onTranscript: (transcript, isFinal) => {
      if (isFinal) setText(prev => (prev + ' ' + transcript).trim())
    },
  })

  const submit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleStop = () => {
    stop()
    setVoicePendingSend(true)
  }

  // Auto-submit après arrêt de la dictée (parité avec AiChatBot artisan)
  useEffect(() => {
    if (!voicePendingSend || listening) return
    setVoicePendingSend(false)
    const timer = setTimeout(() => {
      setText(prev => {
        const trimmed = prev.trim()
        if (trimmed && !disabled) {
          onSend(trimmed)
          return ''
        }
        return prev
      })
    }, 400)
    return () => clearTimeout(timer)
  }, [voicePendingSend, listening, disabled, onSend])

  const placeholderText = placeholder
    ? locale === 'pt' ? placeholder.pt : placeholder.fr
    : locale === 'pt' ? 'Escreva ou fale...' : 'Tape ou parle...'

  return (
    <div
      style={{
        borderTop: '1px solid var(--sd-border)',
        padding: 16,
        background: 'var(--sd-bg)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholderText}
          disabled={disabled}
          aria-label={placeholderText}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 200,
            padding: 10,
            borderRadius: 8,
            border: '1px solid var(--sd-border)',
            fontSize: 14,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
        {voiceEnabled && supported && (
          <button
            onClick={() => (listening ? handleStop() : start())}
            aria-label={listening ? (locale === 'pt' ? 'Parar voz' : 'Stopper voix') : (locale === 'pt' ? 'Iniciar voz' : 'Démarrer voix')}
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: listening ? '#e74c3c' : 'var(--sd-bg-2)',
              border: '1px solid var(--sd-border)',
              cursor: 'pointer',
              fontSize: 18,
            }}
          >
            {listening ? '⏹' : '🎤'}
          </button>
        )}
        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          aria-label={locale === 'pt' ? 'Enviar' : 'Envoyer'}
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            background: 'var(--sd-gold)',
            color: 'var(--sd-navy)',
            border: 0,
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            fontSize: 18,
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          →
        </button>
      </div>
    </div>
  )
}
