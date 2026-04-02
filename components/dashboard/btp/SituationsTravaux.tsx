'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { BarChart3 } from 'lucide-react'

export function SituationsTravaux({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `situations_${userId}`
  interface Poste { poste: string; quantite: number; unite: string; prixUnit: number; avancement: number }
  interface Situation {
    id: string; chantier: string; client: string; numero: number; date: string
    montantMarche: number; travaux: Poste[]; statut: 'brouillon' | 'envoyée' | 'validée' | 'payée'
  }
  const [situations, setSituations] = useState<Situation[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [selected, setSelected] = useState<Situation | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ chantier: '', client: '', montantMarche: 0 })
  const [newPoste, setNewPoste] = useState<Poste>({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })

  const save = (data: Situation[]) => { setSituations(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const createSit = () => {
    const numero = situations.filter(s => s.chantier === form.chantier).length + 1
    const s: Situation = { id: Date.now().toString(), ...form, numero, date: new Date().toISOString().split('T')[0], travaux: [], statut: 'brouillon' }
    save([...situations, s]); setSelected(s); setShowForm(false)
  }
  const addPoste = () => {
    if (!selected) return
    const updated = { ...selected, travaux: [...selected.travaux, { ...newPoste }] }
    save(situations.map(s => s.id === selected.id ? updated : s)); setSelected(updated)
    setNewPoste({ poste: '', quantite: 0, unite: 'u', prixUnit: 0, avancement: 0 })
  }
  const getTotal = (s: Situation) => s.travaux.reduce((sum, t) => sum + t.quantite * t.prixUnit * (t.avancement / 100), 0)
  const changeStatut = (id: string, statut: Situation['statut']) => {
    const upd = situations.map(s => s.id === id ? { ...s, statut } : s)
    save(upd); if (selected?.id === id) setSelected(prev => prev ? { ...prev, statut } : null)
  }
  const sitStatV22: Record<string, string> = { brouillon: 'v22-tag v22-tag-gray', envoyée: 'v22-tag v22-tag-amber', validée: 'v22-tag v22-tag-yellow', payée: 'v22-tag v22-tag-green' }

  return (
    <div>
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title"><BarChart3 size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.situations.title')}</h1>
          <p className="v22-page-sub">{t('proDash.btp.situations.subtitle')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.situations.nouvelleSituation')}</button>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showForm && (
        <div className="v22-card">
          <div className="v22-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="v22-form-label">{t('proDash.btp.situations.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.situations.client')}</label><input className="v22-form-input" value={form.client} onChange={e => setForm({...form, client: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.situations.montantMarche')}</label><input type="number" className="v22-form-input" value={form.montantMarche} onChange={e => setForm({...form, montantMarche: Number(e.target.value)})} /></div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
            <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={createSit} disabled={!form.chantier || !form.client}>{t('proDash.btp.situations.creer')}</button>
            <button className="v22-btn v22-btn-sm" style={{ background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.situations.annuler')}</button>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {situations.length === 0 ? <div className="v22-card" style={{ padding: 24, textAlign: 'center' }}><p className="v22-card-meta">{t('proDash.btp.situations.aucuneSituation')}</p></div> : situations.map(s => {
            const sitStatLabels: Record<string, string> = { brouillon: t('proDash.btp.situations.brouillon'), envoyée: t('proDash.btp.situations.envoyee'), validée: t('proDash.btp.situations.validee'), payée: t('proDash.btp.situations.payee') }
            return (
            <div key={s.id} onClick={() => setSelected(s)} className="v22-card"
              style={{ padding: 14, cursor: 'pointer', border: selected?.id === s.id ? '2px solid var(--v22-yellow)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t('proDash.btp.situations.situation')} n°{s.numero}</span>
                <span className={sitStatV22[s.statut]} style={{ fontSize: 10 }}>{sitStatLabels[s.statut] || s.statut}</span>
              </div>
              <div className="v22-card-meta" style={{ fontSize: 12 }}>{s.chantier}</div>
              <div className="v22-card-meta" style={{ fontSize: 11 }}>{s.client}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--v22-yellow)', marginTop: 4 }}>{getTotal(s).toLocaleString(dateLocale)} €</div>
            </div>
          )})}
        </div>
        <div>
          {selected ? (
            <div className="v22-card">
              <div className="v22-card-head">
                <span className="v22-card-title">{t('proDash.btp.situations.situation')} n°{selected.numero} — {selected.chantier}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['brouillon', 'envoyée', 'validée', 'payée'] as const).map(s => (
                    <button key={s} onClick={() => changeStatut(selected.id, s)}
                      className={`v22-tab${selected.statut === s ? ' active' : ''}`}
                      style={{ fontSize: 11 }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ borderBottom: '1px solid var(--v22-border)' }}>{[t('proDash.btp.situations.colPoste'), t('proDash.btp.situations.colQte'), t('proDash.btp.situations.colUnite'), t('proDash.btp.situations.colPU'), t('proDash.btp.situations.colAvt'), t('proDash.btp.situations.colMontant')].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>)}</tr></thead>
                  <tbody>{selected.travaux.map((tr, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--v22-border)' }}><td style={{ padding: '8px 12px' }}>{tr.poste}</td><td style={{ padding: '8px 12px' }}>{tr.quantite}</td><td style={{ padding: '8px 12px' }}>{tr.unite}</td><td style={{ padding: '8px 12px' }}>{tr.prixUnit.toLocaleString(dateLocale)}</td><td style={{ padding: '8px 12px' }}>{tr.avancement}%</td><td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--v22-yellow)' }}>{(tr.quantite * tr.prixUnit * tr.avancement / 100).toLocaleString(dateLocale)}</td></tr>
                  ))}</tbody>
                  <tfoot><tr style={{ background: 'var(--v22-bg)', fontWeight: 700 }}><td colSpan={5} style={{ padding: '8px 12px', textAlign: 'right' }}>{t('proDash.btp.situations.total')}</td><td style={{ padding: '8px 12px', color: 'var(--v22-yellow)' }}>{getTotal(selected).toLocaleString(dateLocale)} €</td></tr></tfoot>
                </table>
              </div>
              <div className="v22-card-body" style={{ background: 'var(--v22-bg)', borderTop: '1px solid var(--v22-border)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  <input className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.postePlaceholder')} value={newPoste.poste} onChange={e => setNewPoste({...newPoste, poste: e.target.value})} />
                  <input type="number" className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.qtePlaceholder')} value={newPoste.quantite || ''} onChange={e => setNewPoste({...newPoste, quantite: Number(e.target.value)})} />
                  <select className="v22-form-input" style={{ fontSize: 12 }} value={newPoste.unite} onChange={e => setNewPoste({...newPoste, unite: e.target.value})}>{['u', 'm²', 'm³', 'ml', 'kg', 'h', 'forfait'].map(u => <option key={u}>{u}</option>)}</select>
                  <input type="number" className="v22-form-input" style={{ fontSize: 12 }} placeholder={t('proDash.btp.situations.puPlaceholder')} value={newPoste.prixUnit || ''} onChange={e => setNewPoste({...newPoste, prixUnit: Number(e.target.value)})} />
                  <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={addPoste} disabled={!newPoste.poste}>{t('proDash.btp.situations.ajouter')}</button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="v22-card-meta" style={{ fontSize: 12 }}>{t('proDash.btp.situations.avancement')}</span>
                  <input type="range" min="0" max="100" value={newPoste.avancement} onChange={e => setNewPoste({...newPoste, avancement: Number(e.target.value)})} style={{ flex: 1, accentColor: 'var(--v22-yellow)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, minWidth: 32 }}>{newPoste.avancement}%</span>
                </div>
              </div>
            </div>
          ) : <div className="v22-card" style={{ padding: 40, textAlign: 'center', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}><div style={{ marginBottom: 8 }}><BarChart3 size={40} style={{ color: 'var(--v22-text-mid)' }} /></div><p className="v22-card-meta">{t('proDash.btp.situations.selectionnerSituation')}</p></div>}
        </div>
      </div>
      </div>
    </div>
  )
}
