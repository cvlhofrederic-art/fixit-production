'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from '../useThemeVars'
import { Clock } from 'lucide-react'

export function PointageEquipesSection({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `pointage_${userId}`
  interface Pointage {
    id: string; employe: string; poste: string; chantier: string; date: string
    heureArrivee: string; heureDepart: string; pauseMinutes: number; heuresTravaillees: number; notes: string
  }
  const [pointages, setPointages] = useState<Pointage[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [filterEmploye, setFilterEmploye] = useState('')
  const [form, setForm] = useState({ employe: '', poste: '', chantier: '', date: new Date().toISOString().split('T')[0], heureArrivee: '08:00', heureDepart: '17:00', pauseMinutes: 60, notes: '' })

  const save = (data: Pointage[]) => { setPointages(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const calcH = (a: string, d: string, p: number) => {
    const [ah, am] = a.split(':').map(Number); const [dh, dm] = d.split(':').map(Number)
    return Math.max(0, ((dh * 60 + dm) - (ah * 60 + am) - p) / 60)
  }
  const addPointage = () => {
    save([...pointages, { id: Date.now().toString(), ...form, heuresTravaillees: Math.round(calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes) * 100) / 100 }])
    setShowForm(false)
  }
  const deleteP = (id: string) => save(pointages.filter(p => p.id !== id))
  const employes = [...new Set(pointages.map(p => p.employe))].filter(Boolean)
  const filtered = pointages.filter(p => (!filterDate || p.date === filterDate) && (!filterEmploye || p.employe === filterEmploye))
  const totalH = filtered.reduce((s, p) => s + p.heuresTravaillees, 0)
  const heuresByEmp = employes.map(e => ({ employe: e, heures: pointages.filter(p => p.employe === e).reduce((s, p) => s + p.heuresTravaillees, 0), jours: new Set(pointages.filter(p => p.employe === e).map(p => p.date)).size }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          {isV5 ? (
            <>
              <h1><Clock size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.pointage.title')}</h1>
              <p>{t('proDash.btp.pointage.subtitle')}</p>
            </>
          ) : (
            <>
              <h2 className="v22-page-title"><Clock size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.pointage.title')}</h2>
              <p className="v22-page-sub">{t('proDash.btp.pointage.subtitle')}</p>
            </>
          )}
        </div>
        <button className={isV5 ? "v5-btn v5-btn-action" : "v22-btn v22-btn-action"} onClick={() => setShowForm(true)}>{t('proDash.btp.pointage.pointer')}</button>
      </div>

      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'}>
          {isV5 ? (
            <div className="v5-st">Nouveau pointage</div>
          ) : (
            <div className="v22-card-head"><div className="v22-card-title">Nouveau pointage</div></div>
          )}
          <div className={isV5 ? undefined : 'v22-card-body'} style={isV5 ? { padding: '1rem 1.25rem' } : undefined}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.employe')}</label><input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder={t('proDash.btp.pointage.employePlaceholder')} /></div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.poste')}</label>
                <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.poste} onChange={e => setForm({...form, poste: e.target.value})}>
                  <option value="">{t('proDash.btp.pointage.selectionner')}</option>
                  {[{k:'chefChantier'},{k:'macon'},{k:'electricien'},{k:'plombier'},{k:'charpentier'},{k:'peintre'},{k:'manoeuvre'}].map(p => <option key={p.k} value={t(`proDash.btp.pointage.${p.k}`)}>{t(`proDash.btp.pointage.${p.k}`)}</option>)}
                </select>
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.chantier')}</label><input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} /></div>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.date')}</label><input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.arrivee')}</label><input type="time" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.heureArrivee} onChange={e => setForm({...form, heureArrivee: e.target.value})} /></div>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.depart')}</label><input type="time" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.heureDepart} onChange={e => setForm({...form, heureDepart: e.target.value})} /></div>
              <div className={isV5 ? 'v5-fg' : undefined}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.pauseMin')}</label><input type="number" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.pauseMinutes} onChange={e => setForm({...form, pauseMinutes: Number(e.target.value)})} /></div>
              <div className={isV5 ? 'v5-fg' : undefined} style={{ gridColumn: 'span 2' }}><label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.notes')}</label><input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <div style={{ marginTop: 12, background: '#FEF5E4', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#B8860B' }}>
              <Clock size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.pointage.heures')} <strong>{calcH(form.heureArrivee, form.heureDepart, form.pauseMinutes).toFixed(2)}h</strong>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={addPointage} disabled={!form.employe}>{t('proDash.btp.pointage.enregistrer')}</button>
              <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: tv.bg, color: tv.text, border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{t('proDash.btp.pointage.annuler')}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: 16 }}>
        <div className={isV5 ? 'v5-card' : 'v22-card'}>
          <div className={isV5 ? undefined : 'v22-card-body'} style={{ paddingBottom: 8, ...(isV5 ? { padding: '1rem 1.25rem' } : {}) }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.date')}</label>
                <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
              </div>
              <div className={isV5 ? 'v5-fg' : undefined}>
                <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.pointage.employe').replace(' *', '')}</label>
                <select className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ width: 160 }} value={filterEmploye} onChange={e => setFilterEmploye(e.target.value)}>
                  <option value="">{t('proDash.btp.pointage.tous')}</option>
                  {employes.map(e => <option key={e}>{e}</option>)}
                </select>
              </div>
              <span className={isV5 ? undefined : 'v22-card-meta'} style={{ paddingBottom: 2, ...(isV5 ? { fontSize: 12, color: 'var(--v5-text-secondary)' } : {}) }}>{filtered.length} {t('proDash.btp.pointage.pointages')} &mdash; <strong>{totalH.toFixed(1)}h</strong></span>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {isV5 ? (
              <table className="v5-dt">
                <thead>
                  <tr>
                    <th>{t('proDash.btp.pointage.colEmploye')}</th>
                    <th>{t('proDash.btp.pointage.colPoste')}</th>
                    <th>{t('proDash.btp.pointage.colChantier')}</th>
                    <th>{t('proDash.btp.pointage.colDate')}</th>
                    <th>{t('proDash.btp.pointage.colArrivee')}</th>
                    <th>{t('proDash.btp.pointage.colDepart')}</th>
                    <th>{t('proDash.btp.pointage.colHeures')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: '#999', fontSize: 13 }}><div style={{ marginBottom: 6, opacity: 0.4, fontSize: 28 }}>{'⏱️'}</div>{t('proDash.btp.pointage.aucunPointage')}</td></tr>
                  ) : filtered.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.employe}</td>
                      <td>{p.poste}</td>
                      <td>{p.chantier}</td>
                      <td>{new Date(p.date).toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                      <td>{p.heureArrivee}</td>
                      <td>{p.heureDepart}</td>
                      <td style={{ fontWeight: 700, color: 'var(--v5-primary-yellow-dark)' }}>{p.heuresTravaillees}h</td>
                      <td><button onClick={() => deleteP(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 14 }}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${tv.border}` }}>
                    {[t('proDash.btp.pointage.colEmploye'), t('proDash.btp.pointage.colPoste'), t('proDash.btp.pointage.colChantier'), t('proDash.btp.pointage.colDate'), t('proDash.btp.pointage.colArrivee'), t('proDash.btp.pointage.colDepart'), t('proDash.btp.pointage.colHeures'), ''].map(h => (
                      <th key={h || '_'} style={{ textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px 16px', color: '#999', fontSize: 13 }}><div style={{ marginBottom: 6, opacity: 0.4, fontSize: 28 }}>{'⏱️'}</div>{t('proDash.btp.pointage.aucunPointage')}</td></tr>
                  ) : filtered.map(p => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${tv.border}` }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{p.employe}</td>
                      <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.poste}</td>
                      <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{p.chantier}</td>
                      <td style={{ padding: '8px 12px', color: '#4A5E78' }}>{new Date(p.date).toLocaleDateString(dateLocale, { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                      <td style={{ padding: '8px 12px' }}>{p.heureArrivee}</td>
                      <td style={{ padding: '8px 12px' }}>{p.heureDepart}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: tv.primary }}>{p.heuresTravaillees}h</td>
                      <td style={{ padding: '8px 12px' }}><button onClick={() => deleteP(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 14 }}>&times;</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#0D1B2E', marginBottom: 12 }}>{t('proDash.btp.pointage.recapEmployes')}</div>
          {heuresByEmp.length === 0 ? (
            <p className={isV5 ? undefined : 'v22-card-meta'} style={{ fontSize: 12, ...(isV5 ? { color: 'var(--v5-text-muted)' } : {}) }}>{t('proDash.btp.pointage.aucuneDonnee')}</p>
          ) : heuresByEmp.map(e => (
            <div key={e.employe} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${isV5 ? '#E8E8E8' : tv.border}` }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1B2E' }}>{e.employe}</div>
                <div style={{ fontSize: 11, color: '#8A9BB0' }}>{e.jours} {t('proDash.btp.pointage.jours')}</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: tv.primary }}>{e.heures.toFixed(1)}h</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
