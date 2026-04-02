'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { PlusCircle, Users, HardHat, Calendar, DollarSign, MapPin, Check } from 'lucide-react'

export function ChantiersBTPSection({ artisan, bookings }: { artisan: any; bookings: any[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_chantiers_${artisan?.id}`
  const [chantiers, setChantiers] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { return [] }
  })
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState<'Tous' | 'En cours' | 'Terminés' | 'En attente'>('Tous')
  const [form, setForm] = useState({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })

  const handleSave = () => {
    if (!form.titre.trim()) return
    const c = { id: Date.now().toString(), ...form, createdAt: new Date().toISOString() }
    const updated = [c, ...chantiers]
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
    setShowModal(false)
    setForm({ titre: '', client: '', adresse: '', dateDebut: '', dateFin: '', budget: '', statut: 'En attente', description: '', equipe: '' })
  }

  const changeStatut = (id: string, statut: string) => {
    const updated = chantiers.map(c => c.id === id ? { ...c, statut } : c)
    setChantiers(updated)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }

  const filtered = filter === 'Tous' ? chantiers : chantiers.filter(c => c.statut === filter)
  const isPt = locale === 'pt'

  const STATUS_V22: Record<string, string> = {
    'En cours': 'v22-tag v22-tag-green',
    'Terminé':  'v22-tag v22-tag-gray',
    'En attente': 'v22-tag v22-tag-amber',
    'Annulé':   'v22-tag v22-tag-red',
  }

  return (
    <div>
      {/* Header */}
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title"><HardHat size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Obras / Chantiers' : 'Chantiers'}</h1>
          <p className="v22-page-sub">{isPt ? `${chantiers.length} obra(s) registada(s)` : `${chantiers.length} chantier(s) enregistré(s)`}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowModal(true)}><PlusCircle size={14} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}</button>
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
            const count = f === 'Tous' ? chantiers.length : chantiers.filter(c => c.statut === (f === 'Terminés' ? 'Terminé' : f)).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`v22-tag ${filter === f ? 'v22-tag-yellow' : 'v22-tag-gray'}`}
                style={{ cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}><HardHat size={40} style={{ color: 'var(--v22-text-mid)' }} /></div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{isPt ? 'Nenhuma obra' : 'Aucun chantier'}</div>
            <p className="v22-card-meta" style={{ marginBottom: 16 }}>{isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}</p>
            <button className="v22-btn" onClick={() => setShowModal(true)}><PlusCircle size={14} /> {isPt ? 'Criar obra' : 'Créer un chantier'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => (
              <div key={c.id} className="v22-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.titre}</span>
                      <span className={STATUS_V22[c.statut] || 'v22-tag v22-tag-gray'} style={{ fontSize: 11 }}>{c.statut}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {c.client && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {c.client}</span>}
                      {c.adresse && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {c.adresse}</span>}
                      {(c.dateDebut || c.dateFin) && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Calendar size={12} /> {c.dateDebut || '?'} → {c.dateFin || '?'}</span>}
                      {c.budget && <span className="v22-card-meta" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}><DollarSign size={12} /> {Number(c.budget).toLocaleString('fr-FR')} €</span>}
                    </div>
                    {c.description && <p className="v22-card-meta" style={{ fontSize: 12, marginTop: 6 }}>{c.description}</p>}
                  </div>
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nouveau chantier */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="v22-card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="v22-card-head">
              <span className="v22-card-title"><HardHat size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}</span>
              <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="v22-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v22-form-label">{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className="v22-form-input" value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={isPt ? 'ex: Immeuble R+3 — Gros œuvre' : 'ex: Immeuble R+3 — Gros œuvre'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Cliente / Dono de obra' : 'Client / Maître d\'ouvrage'}</label>
                  <input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={isPt ? 'Nome do cliente' : 'Nom du client'} />
                </div>
                <div>
                  <label className="v22-form-label">Budget HT (€)</label>
                  <input type="number" className="v22-form-input" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                <input className="v22-form-input" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={isPt ? 'Rua, cidade...' : 'Rue, ville...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="v22-form-label">{isPt ? 'Data de início' : 'Date de début'}</label>
                  <input type="date" className="v22-form-input" value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} />
                </div>
                <div>
                  <label className="v22-form-label">{isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className="v22-form-input" value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="v22-form-label">{isPt ? 'Descrição' : 'Description'}</label>
                <textarea className="v22-form-input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={isPt ? 'Detalhes da obra...' : 'Détails du chantier...'} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className="v22-btn" style={{ flex: 1, background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className="v22-btn" style={{ flex: 1, background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={handleSave} disabled={!form.titre.trim()}><Check size={14} /> {isPt ? 'Criar obra' : 'Créer le chantier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
