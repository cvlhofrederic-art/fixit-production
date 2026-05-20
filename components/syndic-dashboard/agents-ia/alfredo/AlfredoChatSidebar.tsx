'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  locale: 'fr' | 'pt'
  children: ReactNode
  onToggle?: (expanded: boolean) => void
}

export function AlfredoChatSidebar({ locale, children, onToggle }: Props) {
  const [expanded, setExpanded] = useState(false)

  const labels = locale === 'pt'
    ? { open: 'Conversar com Alfredo', close: 'Fechar conversa' }
    : { open: 'Discuter avec Alfredo', close: 'Fermer la discussion' }

  const toggle = () => {
    const next = !expanded
    setExpanded(next)
    onToggle?.(next)
  }

  if (!expanded) {
    return (
      <aside
        style={{
          width: 56,
          borderLeft: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
          background: 'var(--sd-bg-2, #f7f4ec)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '12px 0',
        }}
      >
        <button
          type="button"
          onClick={toggle}
          aria-label={labels.open}
          title={labels.open}
          style={{
            background: 'var(--sd-gold, #d4af37)',
            color: 'var(--sd-navy, #0d1b2e)',
            border: 0,
            borderRadius: 999,
            width: 40,
            height: 40,
            fontSize: 20,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          💬
        </button>
      </aside>
    )
  }

  return (
    <aside
      style={{
        width: 400,
        borderLeft: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
        background: 'var(--sd-bg, white)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottom: '1px solid var(--sd-border, rgba(0,0,0,0.08))',
        }}
      >
        <strong style={{ fontSize: 14 }}>{labels.open}</strong>
        <button
          type="button"
          onClick={toggle}
          aria-label={labels.close}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', fontSize: 18 }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>{children}</div>
    </aside>
  )
}
