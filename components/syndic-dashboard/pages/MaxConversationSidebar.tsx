'use client'

import { useMemo, useState } from 'react'
import type { Conversation } from '@/lib/syndic/agent-types'

interface Immeuble {
  id?: string
  nom: string
}

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  immeubles?: Immeuble[]
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
    ? { today: 'Hoje', yesterday: 'Ontem', week: 'Esta semana', older: 'Anterior' }
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

export default function MaxConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  immeubles,
  locale,
}: Props) {
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [collapsed, setCollapsed] = useState(false)

  const immeubleById = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of immeubles ?? []) if (i.id) m.set(i.id, i.nom)
    return m
  }, [immeubles])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.last_message_preview ?? '').toLowerCase().includes(q)
    )
  }, [conversations, search])

  const groups = groupByDate(filtered, locale)

  const labels = {
    header: locale === 'pt' ? 'Conversas' : 'Conversations',
    newConv: locale === 'pt' ? 'Nova conversa' : 'Nouvelle conversation',
    search: locale === 'pt' ? 'Procurar conversas…' : 'Rechercher…',
    empty: locale === 'pt' ? 'Nenhuma conversa ainda' : 'Aucune conversation',
    delete: locale === 'pt' ? 'Apagar' : 'Supprimer',
    expand: locale === 'pt' ? 'Expandir lista' : 'Déplier la liste',
    collapse: locale === 'pt' ? 'Recolher lista' : 'Replier la liste',
  }

  if (collapsed) {
    return (
      <aside
        className="sd-mx-sidebar sd-mx-sidebar--collapsed"
        aria-label={labels.header}
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="sd-mx-sidebar-toggle"
          aria-label={labels.expand}
          title={labels.expand}
        >
          ☰
        </button>
        <button
          type="button"
          onClick={onNew}
          className="sd-mx-sidebar-new sd-mx-sidebar-new--icon"
          aria-label={labels.newConv}
          title={labels.newConv}
        >
          +
        </button>
      </aside>
    )
  }

  return (
    <aside className="sd-mx-sidebar" aria-label={labels.header}>
      {/* ── Header ── */}
      <div className="sd-mx-sidebar-head">
        <span className="sd-mx-sidebar-eyebrow">{labels.header}</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="sd-mx-sidebar-toggle"
          aria-label={labels.collapse}
          title={labels.collapse}
        >
          ⟨
        </button>
      </div>

      {/* ── New conversation button ── */}
      <div className="sd-mx-sidebar-cta">
        <button type="button" onClick={onNew} className="sd-mx-sidebar-new">
          + {labels.newConv}
        </button>
      </div>

      {/* ── Search ── */}
      <div className="sd-mx-sidebar-search-wrap">
        <span className="sd-mx-sidebar-search-icon" aria-hidden>🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={labels.search}
          className="sd-mx-sidebar-search"
          aria-label={labels.search}
        />
      </div>

      {/* ── Conversation list ── */}
      <div className="sd-mx-sidebar-list">
        {filtered.length === 0 && (
          <div className="sd-mx-sidebar-empty">{labels.empty}</div>
        )}
        {groups.map(([groupLabel, items]) => (
          <div key={groupLabel} className="sd-mx-sidebar-group">
            <div className="sd-mx-sidebar-group-label">{groupLabel}</div>
            {items.map(c => {
              const immeubleName = c.immeuble_id ? immeubleById.get(c.immeuble_id) : null
              const isActive = activeId === c.id
              const isEditing = editing === c.id
              return (
                <div
                  key={c.id}
                  className={`sd-mx-sidebar-item ${isActive ? 'is-active' : ''}`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => {
                        const trimmed = editValue.trim()
                        if (trimmed && trimmed !== c.title) onRename(c.id, trimmed)
                        setEditing(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditing(null)
                      }}
                      className="sd-mx-sidebar-rename"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      onDoubleClick={() => { setEditing(c.id); setEditValue(c.title) }}
                      className="sd-mx-sidebar-item-btn"
                    >
                      <span className="sd-mx-sidebar-item-icon" aria-hidden>💬</span>
                      <span className="sd-mx-sidebar-item-body">
                        <span className="sd-mx-sidebar-item-title">{c.title}</span>
                        {immeubleName && (
                          <span className="sd-mx-sidebar-item-sub">
                            <span aria-hidden>🏢</span> {immeubleName}
                          </span>
                        )}
                      </span>
                    </button>
                  )}
                  {isActive && !isEditing && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      className="sd-mx-sidebar-item-delete"
                      aria-label={labels.delete}
                      title={labels.delete}
                    >
                      🗑
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </aside>
  )
}
