'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ══════════════════════════════════════════════════════════════
// ServiceEtapesEditor — Gestion des étapes template d'un motif
// Drag & drop, édition inline, auto-save
// ══════════════════════════════════════════════════════════════

interface Etape {
  id: string
  service_id: string
  ordre: number
  designation: string
  created_at: string
}

interface Props {
  serviceId: string | null // null = nouveau motif pas encore sauvé
}

export default function ServiceEtapesEditor({ serviceId }: Props) {
  const [etapes, setEtapes] = useState<Etape[]>([])
  const [loading, setLoading] = useState(false)
  const [newText, setNewText] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const newInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // ── Charger les étapes ──
  const loadEtapes = useCallback(async () => {
    if (!serviceId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/service-etapes?service_id=${serviceId}`)
      const json = await res.json()
      if (json.etapes) setEtapes(json.etapes)
    } catch (e) {
      console.error('[etapes] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [serviceId])

  useEffect(() => { loadEtapes() }, [loadEtapes])

  // ── Ajouter une étape ──
  const handleAdd = async () => {
    if (!newText.trim() || !serviceId || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/service-etapes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, designation: newText.trim() }),
      })
      const json = await res.json()
      if (json.etape) {
        setEtapes(prev => [...prev, json.etape])
        setNewText('')
        setTimeout(() => newInputRef.current?.focus(), 50)
      }
    } catch (e) {
      console.error('[etapes] add error:', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Modifier une étape ──
  const handleEdit = async (etapeId: string) => {
    if (!editText.trim() || !serviceId || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/service-etapes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: etapeId, service_id: serviceId, designation: editText.trim() }),
      })
      const json = await res.json()
      if (json.etape) {
        setEtapes(prev => prev.map(e => e.id === etapeId ? json.etape : e))
      }
    } catch (e) {
      console.error('[etapes] edit error:', e)
    } finally {
      setSaving(false)
      setEditingId(null)
    }
  }

  // ── Supprimer une étape ──
  const handleDelete = async (etapeId: string) => {
    if (!serviceId) return
    setEtapes(prev => prev.filter(e => e.id !== etapeId))
    try {
      await fetch(`/api/service-etapes?id=${etapeId}&service_id=${serviceId}`, { method: 'DELETE' })
    } catch (e) {
      console.error('[etapes] delete error:', e)
      loadEtapes() // revert on error
    }
  }

  // ── Drag & drop ──
  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return

    const newEtapes = [...etapes]
    const dragged = newEtapes[dragIndex]
    newEtapes.splice(dragIndex, 1)
    newEtapes.splice(index, 0, dragged)
    setEtapes(newEtapes)
    setDragIndex(index)
  }

  const handleDragEnd = async () => {
    setDragIndex(null)
    if (!serviceId) return
    // Persist new order
    const ordre = etapes.map((e, i) => ({ id: e.id, ordre: i }))
    try {
      await fetch('/api/service-etapes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, action: 'reorder', ordre }),
      })
    } catch (e) {
      console.error('[etapes] reorder error:', e)
    }
  }

  // ── Début édition inline ──
  const startEdit = (etape: Etape) => {
    setEditingId(etape.id)
    setEditText(etape.designation)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  if (!serviceId) {
    return (
      <div style={{ padding: '12px 0', fontSize: 12, color: 'var(--v22-text-muted)', fontStyle: 'italic' }}>
        Sauvegardez le motif pour pouvoir ajouter des étapes.
      </div>
    )
  }

  return (
    <div>
      <label className="v22-form-label" style={{ marginBottom: 6 }}>
        {'📋'} Étapes par défaut
      </label>
      <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginBottom: 10 }}>
        Ces étapes seront copiées sur chaque devis utilisant ce motif
      </div>

      {loading ? (
        <div style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--v22-text-muted)' }}>
          Chargement...
        </div>
      ) : (
        <>
          {/* Liste des étapes */}
          {etapes.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {etapes.map((etape, index) => (
                <div
                  key={etape.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--v22-border)',
                    background: dragIndex === index ? 'var(--v22-yellow-light)' : 'var(--v22-surface)',
                    cursor: 'grab',
                    fontSize: 13,
                  }}
                >
                  {/* Drag handle */}
                  <span style={{ color: 'var(--v22-text-muted)', cursor: 'grab', fontSize: 14, userSelect: 'none' }}>
                    ≡
                  </span>

                  {/* Numéro */}
                  <span style={{ color: 'var(--v22-text-muted)', fontSize: 11, minWidth: 18, textAlign: 'center' }}>
                    {index + 1}.
                  </span>

                  {/* Texte ou input d'édition */}
                  {editingId === etape.id ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={() => handleEdit(etape.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleEdit(etape.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="v22-form-input"
                      style={{ flex: 1, padding: '4px 8px', fontSize: 13 }}
                    />
                  ) : (
                    <span
                      style={{ flex: 1, cursor: 'text' }}
                      onClick={() => startEdit(etape)}
                    >
                      {etape.designation}
                    </span>
                  )}

                  {/* Actions */}
                  {editingId !== etape.id && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => startEdit(etape)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: 'var(--v22-text-muted)' }}
                        title="Modifier"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => handleDelete(etape.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: '2px 4px', color: 'var(--v22-red)' }}
                        title="Supprimer"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Champ ajout */}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              ref={newInputRef}
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Ex: Couper l'arrivée d'eau..."
              className="v22-form-input"
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              onClick={handleAdd}
              disabled={!newText.trim() || saving}
              className="v22-btn v22-btn-sm"
              style={{ opacity: (!newText.trim() || saving) ? 0.4 : 1, whiteSpace: 'nowrap' }}
            >
              + Ajouter
            </button>
          </div>

          {etapes.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--v22-text-muted)', marginTop: 6, fontStyle: 'italic' }}>
              Aucune étape. Les étapes décrivent le déroulement de l'intervention pour le client.
            </div>
          )}
        </>
      )}
    </div>
  )
}
