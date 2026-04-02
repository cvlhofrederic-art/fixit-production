'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { Lock, Lightbulb } from 'lucide-react'

export function RetenuesGarantieSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `retenues_${userId}`
  interface Retenue {
    id: string; chantier: string; client: string; montantMarche: number; tauxRetenue: number
    montantRetenu: number; dateFinTravaux: string; dateLiberation?: string
    statut: 'active' | 'mainlevée_demandée' | 'libérée'; caution: boolean
  }
  const [retenues, setRetenues] = useState<Retenue[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })

  const save = (data: Retenue[]) => { setRetenues(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addRetenue = () => {
    save([...retenues, { id: Date.now().toString(), ...form, montantRetenu: form.montantMarche * form.tauxRetenue / 100, statut: 'active' }])
    setShowForm(false); setForm({ chantier: '', client: '', montantMarche: 0, tauxRetenue: 5, dateFinTravaux: '', caution: false })
  }
  const changeStatut = (id: string, statut: Retenue['statut']) => save(retenues.map(r => r.id === id ? { ...r, statut, dateLiberation: statut === 'libérée' ? new Date().toISOString().split('T')[0] : r.dateLiberation } : r))

  const totalRetenu = retenues.filter(r => r.statut === 'active').reduce((s, r) => s + r.montantRetenu, 0)
  const totalLibéré = retenues.filter(r => r.statut === 'libérée').reduce((s, r) => s + r.montantRetenu, 0)

  const retStatV22: Record<string, string> = {
    active: 'v22-tag v22-tag-amber',
    mainlevée_demandée: 'v22-tag v22-tag-blue',
    libérée: 'v22-tag v22-tag-green',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="v22-page-header">
        <div>
          <h2 className="v22-page-title"><Lock size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.retenues.title')}</h2>
          <p className="v22-page-sub">{t('proDash.btp.retenues.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.retenues.nouvelleRetenue')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.retenuEnAttente')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#C9A84C', marginTop: 4 }}>{totalRetenu.toLocaleString(dateLocale)} €</div>
        </div>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.libere')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--v22-green)', marginTop: 4 }}>{totalLibéré.toLocaleString(dateLocale)} €</div>
        </div>
        <div className="v22-card" style={{ padding: 16 }}>
          <div className="v22-card-meta">{t('proDash.btp.retenues.chantiersConcernes')}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#0D1B2E', marginTop: 4 }}>{retenues.length}</div>
        </div>
      </div>

      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head">
            <div className="v22-card-title">{t('proDash.btp.retenues.nouvelleRetenueGarantie')}</div>
          </div>
          <div className="v22-card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.client')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.montantMarcheHT')}</label><input type="number" className="v22-form-input" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.tauxRetenue')}</label><input type="number" min="1" max="10" className="v22-form-input" value={form.tauxRetenue} onChange={e => setForm({...form, tauxRetenue: Number(e.target.value)})} /></div>
              <div><label className="v22-form-label">{t('proDash.btp.retenues.finTravaux')}</label><input type="date" className="v22-form-input" value={form.dateFinTravaux} onChange={e => setForm({...form, dateFinTravaux: e.target.value})} /></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 20 }}>
                <input type="checkbox" id="caution_ret" checked={form.caution} onChange={e => setForm({...form, caution: e.target.checked})} style={{ width: 16, height: 16, accentColor: 'var(--v22-yellow)' }} />
                <label htmlFor="caution_ret" style={{ fontSize: 14, color: '#4A5E78' }}>{t('proDash.btp.retenues.cautionBancaire')}</label>
              </div>
            </div>
            {form.montantMarche > 0 && (
              <div style={{ marginTop: 12, background: '#FEF5E4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B8860B' }}>
                <Lightbulb size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.retenues.montantRetenuInfo')} <strong>{(form.montantMarche * form.tauxRetenue / 100).toLocaleString(dateLocale)} €</strong>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className="v22-btn" onClick={addRetenue} disabled={!form.chantier || !form.client}>{t('proDash.btp.retenues.enregistrer')}</button>
              <button className="v22-btn" style={{ background: 'var(--v22-bg)', color: 'var(--v22-text)', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.retenues.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div className="v22-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                {[t('proDash.btp.retenues.colChantier'), t('proDash.btp.retenues.colClient'), t('proDash.btp.retenues.colMarcheHT'), t('proDash.btp.retenues.colRetenu'), t('proDash.btp.retenues.colFinTravaux'), t('proDash.btp.retenues.colStatut'), t('proDash.btp.retenues.colActions')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {retenues.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--v22-text-mid)', fontSize: 13 }}>{t('proDash.btp.retenues.aucuneRetenue')}</td></tr>
              ) : retenues.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0D1B2E' }}>{r.chantier}</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.client}</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.montantMarche.toLocaleString(dateLocale)} €</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#C9A84C' }}>{r.montantRetenu.toLocaleString(dateLocale)} €</td>
                  <td style={{ padding: '10px 14px', color: '#4A5E78' }}>{r.dateFinTravaux ? new Date(r.dateFinTravaux).toLocaleDateString(dateLocale) : '—'}</td>
                  <td style={{ padding: '10px 14px' }}><span className={retStatV22[r.statut] || 'v22-tag'}>{r.statut}</span></td>
                  <td style={{ padding: '10px 14px' }}>
                    {r.statut === 'active' && <button className="v22-btn v22-btn-sm" onClick={() => changeStatut(r.id, 'mainlevée_demandée')}>{t('proDash.btp.retenues.demanderMainlevee')}</button>}
                    {r.statut === 'mainlevée_demandée' && <button className="v22-btn v22-btn-sm" style={{ background: '#E6F4F2', color: '#1A7A6E' }} onClick={() => changeStatut(r.id, 'libérée')}>{t('proDash.btp.retenues.liberer')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
