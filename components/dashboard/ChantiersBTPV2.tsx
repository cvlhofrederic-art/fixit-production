'use client'

import { useState, useCallback } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { useBTPData } from '@/lib/hooks/use-btp-data'

// ═══════════════════════════════════════════════════════════════════════════════
// CHANTIERS BTP V2 — Supabase + Géolocalisation du chantier
// ═══════════════════════════════════════════════════════════════════════════════

interface ChantierForm {
  titre: string; client: string; adresse: string
  dateDebut: string; dateFin: string; budget: string
  statut: string; description: string; equipe: string
  latitude?: number | null; longitude?: number | null
  geoRayonM: number
}

const EMPTY_FORM: ChantierForm = {
  titre: '', client: '', adresse: '', dateDebut: '', dateFin: '',
  budget: '', statut: 'En attente', description: '', equipe: '',
  latitude: null, longitude: null, geoRayonM: 100,
}

export function ChantiersBTPV2({ artisan }: { artisan: any }) {
  const locale = useLocale()
  const isPt = locale === 'pt'
  const dateLocale = isPt ? 'pt-PT' : 'fr-FR'

  const { items: chantiers, loading, add, update, remove } = useBTPData({
    table: 'chantiers',
    artisanId: artisan?.id || '',
    userId: artisan?.user_id || '',
  })

  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'En attente' | 'Terminés'>('Tous')
  const [form, setForm] = useState<ChantierForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)

  // Géocode l'adresse du chantier
  const geocodeAdresse = useCallback(async (adresse: string) => {
    if (!adresse.trim()) return
    setGeocoding(true)
    try {
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`, { signal: AbortSignal.timeout(3000) })
      if (res.ok) {
        const data = await res.json()
        if (data.features?.length > 0) {
          const [lng, lat] = data.features[0].geometry.coordinates
          setForm(f => ({ ...f, latitude: lat, longitude: lng }))
          return
        }
      }
      // Fallback Nominatim
      const nom = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(adresse)}&format=json&limit=1`, {
        signal: AbortSignal.timeout(3000), headers: { 'User-Agent': 'Fixit/1.0' }
      })
      if (nom.ok) {
        const nomData = await nom.json()
        if (nomData.length > 0) {
          setForm(f => ({ ...f, latitude: parseFloat(nomData[0].lat), longitude: parseFloat(nomData[0].lon) }))
        }
      }
    } catch { /* silent */ }
    finally { setGeocoding(false) }
  }, [])

  const handleSave = async () => {
    if (!form.titre.trim()) return
    setSaving(true)
    if (editId) {
      await update(editId, form)
    } else {
      await add(form)
    }
    setSaving(false)
    setShowModal(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  const handleEdit = (c: any) => {
    setEditId(c.id)
    setForm({
      titre: c.titre, client: c.client, adresse: c.adresse,
      dateDebut: c.dateDebut, dateFin: c.dateFin, budget: c.budget,
      statut: c.statut, description: c.description, equipe: c.equipe,
      latitude: c.latitude, longitude: c.longitude, geoRayonM: c.geoRayonM || 100,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(isPt ? 'Remover obra?' : 'Supprimer ce chantier ?')) return
    await remove(id)
  }

  const changeStatut = async (id: string, statut: string) => {
    await update(id, { statut } as any)
  }

  const filtered = filter === 'Tous'
    ? chantiers
    : chantiers.filter((c: any) => filter === 'Terminés' ? c.statut === 'Terminé' : c.statut === filter)

  const STATUS_V22: Record<string, string> = {
    'En cours': 'v22-tag v22-tag-green',
    'Terminé': 'v22-tag v22-tag-gray',
    'En attente': 'v22-tag v22-tag-amber',
    'Annulé': 'v22-tag v22-tag-red',
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 24 }}>⏳</div>
      <p className="v22-card-meta">{isPt ? 'A carregar...' : 'Chargement...'}</p>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title">🏗️ {isPt ? 'Obras / Chantiers' : 'Chantiers'}</h1>
          <p className="v22-page-sub">{isPt ? `${chantiers.length} obra(s) registada(s)` : `${chantiers.length} chantier(s) enregistré(s)`}</p>
        </div>
        <button className="v22-btn" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true) }}>
          ➕ {isPt ? 'Nova obra' : 'Nouveau chantier'}
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Filtres */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['Tous', 'En cours', 'En attente', 'Terminés'] as const).map(f => {
            const labels: Record<string, string> = {
              'Tous': isPt ? 'Todas' : 'Toutes',
              'En cours': isPt ? 'Em curso' : 'En cours',
              'En attente': isPt ? 'Pendentes' : 'En attente',
              'Terminés': isPt ? 'Concluídas' : 'Terminés',
            }
            const count = f === 'Tous' ? chantiers.length : chantiers.filter((c: any) => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`v22-tag ${filter === f ? 'v22-tag-yellow' : 'v22-tag-gray'}`}
                style={{ cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* Liste */}
        {filtered.length === 0 ? (
          <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma obra' : 'Aucun chantier'}</div>
            <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}</p>
            <button className="v22-btn" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowModal(true) }}>
              ➕ {isPt ? 'Criar obra' : 'Créer un chantier'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((c: any) => (
              <div key={c.id} className="v22-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.titre}</span>
                      <span className={STATUS_V22[c.statut] || 'v22-tag v22-tag-gray'} style={{ fontSize: 11 }}>{c.statut}</span>
                      {c.latitude && <span className="v22-tag v22-tag-green" style={{ fontSize: 10 }}>📍 GPS</span>}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {c.client && <span className="v22-card-meta" style={{ fontSize: 12 }}>👤 {c.client}</span>}
                      {c.adresse && <span className="v22-card-meta" style={{ fontSize: 12 }}>📍 {c.adresse}</span>}
                      {(c.dateDebut || c.dateFin) && <span className="v22-card-meta" style={{ fontSize: 12 }}>📅 {c.dateDebut || '?'} → {c.dateFin || '?'}</span>}
                      {c.budget && <span className="v22-card-meta" style={{ fontSize: 12 }}>💰 {Number(c.budget).toLocaleString(dateLocale)} €</span>}
                    </div>
                    {c.description && <p className="v22-card-meta" style={{ fontSize: 12, marginTop: 6 }}>{c.description}</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="v22-btn v22-btn-sm" onClick={() => handleEdit(c)} style={{ background: 'var(--v22-bg)', border: '1px solid var(--v22-border)', fontSize: 12 }}>
                      ✏️
                    </button>
                    <select
                      value={c.statut}
                      onChange={e => changeStatut(c.id, e.target.value)}
                      className="v22-form-input"
                      style={{ minWidth: 130, fontSize: 13, padding: '6px 10px' }}>
                      {['En attente', 'En cours', 'Terminé', 'Annulé'].map(s => {
                        const sl: Record<string, string> = isPt
                          ? { 'En attente': 'Pendente', 'En cours': 'Em curso', 'Terminé': 'Concluída', 'Annulé': 'Anulada' }
                          : { 'En attente': 'En attente', 'En cours': 'En cours', 'Terminé': 'Terminé', 'Annulé': 'Annulé' }
                        return <option key={s} value={s}>{sl[s]}</option>
                      })}
                    </select>
                    <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 16 }}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal création/édition */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title">🏗️ {editId ? (isPt ? 'Editar obra' : 'Modifier le chantier') : (isPt ? 'Nova obra' : 'Nouveau chantier')}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className="v22-form-input" value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })}
                  placeholder={isPt ? 'ex: Immeuble R+3 — Gros oeuvre' : 'ex: Immeuble R+3 — Gros oeuvre'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Cliente / Dono de obra' : 'Client / Maître d\'ouvrage'}</label>
                  <input className="v22-form-input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
                </div>
                <div>
                  <label className="v22-form-label">💰 Budget HT (€)</label>
                  <input type="number" className="v22-form-input" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="v22-form-label">📍 {isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="v22-form-input" style={{ flex: 1 }} value={form.adresse}
                    onChange={e => setForm({ ...form, adresse: e.target.value })}
                    placeholder={isPt ? 'Rua, cidade...' : 'Rue, ville...'} />
                  <button className="v22-btn v22-btn-sm" onClick={() => geocodeAdresse(form.adresse)}
                    disabled={geocoding || !form.adresse.trim()}
                    style={{ whiteSpace: 'nowrap' }}>
                    {geocoding ? '⏳' : '📍'} {form.latitude ? '✅' : 'GPS'}
                  </button>
                </div>
                {form.latitude && (
                  <div style={{ fontSize: 11, color: '#22C55E', marginTop: 4 }}>
                    ✅ GPS : {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
                  </div>
                )}
              </div>

              {/* Rayon pour le pointage géo */}
              <div>
                <label className="v22-form-label">📡 {isPt ? 'Raio para pointagem GPS' : 'Rayon pointage GPS'}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="range" min={25} max={500} step={25} value={form.geoRayonM}
                    onChange={e => setForm({ ...form, geoRayonM: Number(e.target.value) })}
                    style={{ flex: 1 }} />
                  <span style={{ fontWeight: 700, fontSize: 14, minWidth: 50, textAlign: 'right' }}>{form.geoRayonM}m</span>
                </div>
                <div className="v22-card-meta" style={{ fontSize: 11, marginTop: 2 }}>
                  {isPt
                    ? `Pointagem automática quando obreiro está a menos de ${form.geoRayonM}m`
                    : `Pointage auto si l'ouvrier est à moins de ${form.geoRayonM}m du chantier`}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">📅 {isPt ? 'Data de início' : 'Date de début'}</label>
                  <input type="date" className="v22-form-input" value={form.dateDebut} onChange={e => setForm({ ...form, dateDebut: e.target.value })} />
                </div>
                <div>
                  <label className="v22-form-label">📅 {isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className="v22-form-input" value={form.dateFin} onChange={e => setForm({ ...form, dateFin: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Descrição' : 'Description'}</label>
                <textarea className="v22-form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={3} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }}
                onClick={() => setShowModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }}
                onClick={handleSave} disabled={!form.titre.trim() || saving}>
                {saving ? '⏳' : '✅'} {editId ? (isPt ? 'Guardar' : 'Enregistrer') : (isPt ? 'Criar obra' : 'Créer le chantier')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
