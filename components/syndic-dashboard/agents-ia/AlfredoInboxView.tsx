'use client'

import { useState } from 'react'
import { useAlfredoDrafts } from './hooks/useAlfredoDrafts'
import AlfredoDraftEditor from './AlfredoDraftEditor'

interface Props {
  locale: 'fr' | 'pt'
}

export default function AlfredoInboxView({ locale }: Props) {
  const { drafts, loading, updateDraft } = useAlfredoDrafts('pending_review')
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = drafts.find(d => d.id === activeId) ?? null

  const labels = locale === 'pt'
    ? { title: 'Inbox proativa', empty: 'Sem rascunhos pendentes', from: 'De', loading: 'A carregar...', selectOne: 'Selecione um email à esquerda' }
    : { title: 'Inbox proactive', empty: 'Aucun brouillon en attente', from: 'De', loading: 'Chargement...', selectOne: 'Sélectionnez un email à gauche' }

  const handleSend = async (id: string, edited: { subject: string; body_text: string }) => {
    const original = drafts.find(d => d.id === id)
    const isEdited = original && (
      original.draft_subject !== edited.subject ||
      original.draft_body_text !== edited.body_text
    )
    await updateDraft(id, {
      draft_status: isEdited ? 'edited_sent' : 'sent',
      draft_subject: edited.subject,
      draft_body_text: edited.body_text,
    })
    // Note : l'envoi réel via Gmail API se déclenche côté serveur en suivi du PATCH approved/sent.
    // L'implémentation de send-response existante (Plan B Task 11) peut être étendue ici en Plan D.
    setActiveId(null)
  }

  const handleSkip = async (id: string) => {
    await updateDraft(id, { draft_status: 'skipped' })
    setActiveId(null)
  }

  if (loading) {
    return <div style={{ padding: 24 }}>{labels.loading}</div>
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{
        width: 320, borderRight: '1px solid var(--sd-border)',
        overflowY: 'auto', background: 'var(--sd-bg-2)',
      }}>
        <div style={{
          padding: 12, borderBottom: '1px solid var(--sd-border)',
          fontSize: 14, fontWeight: 600,
        }}>
          {labels.title} ({drafts.length})
        </div>
        {drafts.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: 'rgba(0,0,0,0.5)' }}>
            {labels.empty}
          </div>
        ) : (
          drafts.map(d => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              style={{
                display: 'block', width: '100%', padding: '10px 12px',
                textAlign: 'left', cursor: 'pointer',
                background: activeId === d.id ? 'var(--sd-gold-dim)' : 'transparent',
                border: 0,
                borderBottom: '1px solid var(--sd-border)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.from_email}</div>
              <div style={{
                fontSize: 13, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {d.subject}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', marginTop: 2 }}>
                {new Date(d.received_at).toLocaleDateString(locale)}
              </div>
            </button>
          ))
        )}
      </aside>

      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--sd-bg)' }}>
        {active ? (
          <div style={{ padding: 24 }}>
            <div style={{
              padding: 16, marginBottom: 16,
              background: 'var(--sd-bg-2)', borderRadius: 12,
            }}>
              <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.6)' }}>
                {labels.from}: <strong>{active.from_email}</strong>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
                {active.subject}
              </div>
              <div style={{
                fontSize: 13, marginTop: 10,
                color: 'rgba(0,0,0,0.7)', whiteSpace: 'pre-wrap',
              }}>
                {active.body_preview}
              </div>
            </div>
            <AlfredoDraftEditor
              draft={active}
              locale={locale}
              onSend={handleSend}
              onSkip={handleSkip}
            />
          </div>
        ) : (
          <div style={{ padding: 24, color: 'rgba(0,0,0,0.5)' }}>
            {labels.selectOne}
          </div>
        )}
      </main>
    </div>
  )
}
