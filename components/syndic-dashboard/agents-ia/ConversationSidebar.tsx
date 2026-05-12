// components/syndic-dashboard/agents-ia/ConversationSidebar.tsx
'use client'

import { useState } from 'react'
import type { Conversation } from '@/lib/syndic/agent-types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  locale: 'fr' | 'pt'
}

function groupByDate(conversations: Conversation[], locale: 'fr' | 'pt') {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const labels = locale === 'pt'
    ? { today: 'Hoje', yesterday: 'Ontem', week: 'Esta semana', older: 'Mais antigo' }
    : { today: "Aujourd'hui", yesterday: 'Hier', week: 'Cette semaine', older: 'Plus ancien' }

  const buckets: Record<string, Conversation[]> = {
    [labels.today]: [],
    [labels.yesterday]: [],
    [labels.week]: [],
    [labels.older]: [],
  }

  for (const c of conversations) {
    const d = new Date(c.updated_at)
    if (d >= today) buckets[labels.today].push(c)
    else if (d >= yesterday) buckets[labels.yesterday].push(c)
    else if (d >= weekAgo) buckets[labels.week].push(c)
    else buckets[labels.older].push(c)
  }

  return Object.entries(buckets).filter(([, items]) => items.length > 0)
}

export default function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  locale,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const groups = groupByDate(conversations, locale)
  const newLabel = locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation'

  return (
    <aside
      aria-label={locale === 'pt' ? 'Lista de conversas' : 'Liste des conversations'}
      style={{
        width: 260,
        borderRight: '1px solid var(--sd-border)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--sd-bg-2)',
      }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid var(--sd-border)' }}>
        <button
          onClick={onNew}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--sd-gold)',
            color: 'var(--sd-navy)',
            border: 0,
            borderRadius: 8,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + {newLabel}
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {groups.map(([label, items]) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: '4px 8px',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                color: 'rgba(0,0,0,0.4)',
              }}
            >
              {label}
            </div>
            {items.map(c => (
              <div key={c.id} style={{ position: 'relative', marginBottom: 2 }}>
                {editing === c.id ? (
                  <input
                    autoFocus
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={() => {
                      if (editValue.trim()) onRename(c.id, editValue.trim())
                      setEditing(null)
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                    style={{
                      width: '100%',
                      padding: 8,
                      borderRadius: 6,
                      border: '1px solid var(--sd-border)',
                    }}
                  />
                ) : (
                  <button
                    onClick={() => onSelect(c.id)}
                    onDoubleClick={() => {
                      setEditing(c.id)
                      setEditValue(c.title)
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      background: activeId === c.id ? 'var(--sd-gold-dim)' : 'transparent',
                      border: 0,
                      borderRadius: 6,
                      fontSize: 13,
                      color: activeId === c.id ? 'var(--sd-navy)' : 'rgba(0,0,0,0.7)',
                    }}
                  >
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.title}
                    </div>
                    {c.last_message_preview && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'rgba(0,0,0,0.5)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.last_message_preview}
                      </div>
                    )}
                  </button>
                )}
                {activeId === c.id && editing !== c.id && (
                  <button
                    onClick={() => onDelete(c.id)}
                    aria-label={locale === 'pt' ? 'Apagar' : 'Supprimer'}
                    style={{
                      position: 'absolute',
                      right: 4,
                      top: 4,
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: 12,
                      color: 'rgba(0,0,0,0.4)',
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
