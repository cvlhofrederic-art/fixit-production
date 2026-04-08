'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { PlusCircle, Users, HardHat, Calendar, DollarSign, MapPin, Check } from 'lucide-react'
import type { Artisan, Booking } from '@/lib/types'

interface ChantierItem {
  id: string; titre: string; client: string; adresse: string; dateDebut: string
  dateFin: string; budget: string; statut: string; description: string; equipe: string; createdAt: string
}

export function ChantiersBTPSection({ artisan, bookings, orgRole }: { artisan: Artisan; bookings: Booking[]; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe'
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const storageKey = `fixit_chantiers_${artisan?.id}`
  const [chantiers, setChantiers] = useState<ChantierItem[]>(() => {
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

  const STATUS_V5: Record<string, string> = {
    'En cours': 'v5-badge v5-badge-green',
    'Terminé':  'v5-badge v5-badge-gray',
    'En attente': 'v5-badge v5-badge-orange',
    'Annulé':   'v5-badge v5-badge-red',
  }

  return (
    <div>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          <h1 className={isV5 ? undefined : "v22-page-title"}><HardHat size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Obras / Chantiers' : 'Chantiers'}</h1>
          <p className={isV5 ? undefined : "v22-page-sub"}>{isPt ? `${chantiers.length} obra(s) registada(s)` : `${chantiers.length} chantier(s) enregistré(s)`}</p>
        </div>
        <button className={isV5 ? "v5-btn v5-btn-action" : "v22-btn v22-btn-action"} onClick={() => setShowModal(true)}><PlusCircle size={14} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}</button>
      </div>

      <div style={{ padding: isV5 ? undefined : '20px 24px' }}>
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
                className={isV5
                  ? `v5-badge ${filter === f ? 'v5-badge-yellow' : 'v5-badge-gray'}`
                  : `v22-tag ${filter === f ? 'v22-tag-yellow' : 'v22-tag-gray'}`
                }
                style={{ cursor: 'pointer', fontWeight: filter === f ? 700 : 400 }}>
                {labels[f]} ({count})
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 ? (
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ marginBottom: 12 }}><HardHat size={44} style={{ color: '#CCC' }} /></div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma obra' : 'Aucun chantier'}</div>
            <p style={{ color: '#999', fontSize: 12, marginBottom: 20 }}>{isPt ? 'Registe a sua primeira obra' : 'Créez votre premier chantier'}</p>
            <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowModal(true)}><PlusCircle size={16} /> {isPt ? 'Criar obra' : 'Créer un chantier'}</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map(c => (
              <div key={c.id} className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{c.titre}</span>
                      <span className={(isV5 ? STATUS_V5 : STATUS_V22)[c.statut] || (isV5 ? 'v5-badge v5-badge-gray' : 'v22-tag v22-tag-gray')} style={{ fontSize: 11 }}>{c.statut}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      {c.client && <span className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><Users size={12} /> {c.client}</span>}
                      {c.adresse && <span className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><MapPin size={12} /> {c.adresse}</span>}
                      {(c.dateDebut || c.dateFin) && <span className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><Calendar size={12} /> {c.dateDebut || '?'} &rarr; {c.dateFin || '?'}</span>}
                      {c.budget && <span className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}><DollarSign size={12} /> {Number(c.budget).toLocaleString('fr-FR')} &euro;</span>}
                    </div>
                    {c.description && <p className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, marginTop: 6, ...(isV5 ? { color: 'var(--v5-text-secondary)' } : {}) }}>{c.description}</p>}
                  </div>
                  <select
                    value={c.statut}
                    onChange={e => changeStatut(c.id, e.target.value)}
                    className={isV5 ? 'v5-fi' : 'v22-form-input'}
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
        <div className={isV5 ? 'v5-modal-ov' : undefined} style={isV5 ? undefined : { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className={isV5 ? 'v5-modal' : 'v22-card'} style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            {isV5 ? (
              <div className="v5-modal-h">
                <span><HardHat size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}</span>
                <button className="v5-btn v5-btn-sm" onClick={() => setShowModal(false)}>&times;</button>
              </div>
            ) : (
              <div className="v22-card-head">
                <span className="v22-card-title"><HardHat size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {isPt ? 'Nova obra' : 'Nouveau chantier'}</span>
                <button className="v22-btn v22-btn-sm" onClick={() => setShowModal(false)}>&times;</button>
              </div>
            )}
            <div className={isV5 ? undefined : 'v22-card-body'} style={{ display: 'flex', flexDirection: 'column', gap: 14, ...(isV5 ? { padding: '1rem 1.25rem' } : {}) }}>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome da obra *' : 'Titre du chantier *'}</label>
                <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.titre} onChange={e => setForm({...form, titre: e.target.value})} placeholder={isPt ? 'ex: Immeuble R+3 \u2014 Gros \u0153uvre' : 'ex: Immeuble R+3 \u2014 Gros \u0153uvre'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Cliente / Dono de obra' : 'Client / Ma\u00EEtre d\'ouvrage'}</label>
                  <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.client} onChange={e => setForm({...form, client: e.target.value})} placeholder={isPt ? 'Nome do cliente' : 'Nom du client'} />
                </div>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>Budget HT (&euro;)</label>
                  <input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" />
                </div>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Morada da obra' : 'Adresse du chantier'}</label>
                <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} placeholder={isPt ? 'Rua, cidade...' : 'Rue, ville...'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Data de in\u00EDcio' : 'Date de d\u00E9but'}</label>
                  <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.dateDebut} onChange={e => setForm({...form, dateDebut: e.target.value})} />
                </div>
                <div className={isV5 ? 'v5-fg' : undefined}>
                  <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Data de fim' : 'Date de fin'}</label>
                  <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.dateFin} onChange={e => setForm({...form, dateFin: e.target.value})} />
                </div>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Descri\u00E7\u00E3o' : 'Description'}</label>
                <textarea className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={3} placeholder={isPt ? 'Detalhes da obra...' : 'D\u00E9tails du chantier...'} style={{ resize: 'none' }} />
              </div>
            </div>
            <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ flex: 1, background: 'none', border: isV5 ? '1px solid #E8E8E8' : '1px solid var(--v22-border)' }} onClick={() => setShowModal(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} style={{ flex: 1, ...(isV5 ? {} : { background: 'var(--v22-yellow)', fontWeight: 700 }) }} onClick={handleSave} disabled={!form.titre.trim()}><Check size={14} /> {isPt ? 'Criar obra' : 'Cr\u00E9er le chantier'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
