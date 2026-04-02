'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { Calendar } from 'lucide-react'

export function GanttSection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const STORAGE_KEY = `gantt_${userId}`
  interface Tache {
    id: string; nom: string; chantier: string; responsable: string
    debut: string; fin: string; avancement: number
    statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'; couleur: string
  }
  const [taches, setTaches] = useState<Tache[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié' as const, couleur: '#3B82F6' })

  const save = (data: Tache[]) => { setTaches(data); localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) }
  const addTache = () => { save([...taches, { ...form, id: Date.now().toString() }]); setShowForm(false); setForm({ nom: '', chantier: '', responsable: '', debut: '', fin: '', avancement: 0, statut: 'planifié', couleur: '#3B82F6' }) }
  const updateAvancement = (id: string, val: number) => save(taches.map(tc => tc.id === id ? { ...tc, avancement: val, statut: val === 100 ? 'terminé' : val > 0 ? 'en_cours' : 'planifié' } : tc))
  const deleteTache = (id: string) => save(taches.filter(tc => tc.id !== id))

  const allDates = taches.flatMap(t => [new Date(t.debut), new Date(t.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 30 * 86400000)
  const totalDays = Math.max(1, (maxDate.getTime() - minDate.getTime()) / 86400000)
  const getBar = (t: Tache) => {
    const start = Math.max(0, (new Date(t.debut).getTime() - minDate.getTime()) / 86400000)
    const duration = Math.max(1, (new Date(t.fin).getTime() - new Date(t.debut).getTime()) / 86400000)
    return { left: `${(start / totalDays) * 100}%`, width: `${(duration / totalDays) * 100}%` }
  }
  const ganttStatV22: Record<string, { bg: string; color: string }> = {
    planifié: { bg: '#F0EBE3', color: '#6B7B8D' },
    en_cours: { bg: '#E8F4FD', color: '#1A6FB5' },
    terminé: { bg: '#E6F4F2', color: '#1A7A6E' },
    en_retard: { bg: '#FDE8E8', color: '#B33A3A' },
  }

  return (
    <div>
      <div className="v22-page-header">
        <div>
          <h1 className="v22-page-title"><Calendar size={20} style={{ display: 'inline', verticalAlign: 'text-bottom' }} /> {t('proDash.btp.gantt.title')}</h1>
          <p className="v22-page-sub">{taches.length} {t('proDash.btp.gantt.tachesPlanifiees')}</p>
        </div>
        <button className="v22-btn" onClick={() => setShowForm(true)}>{t('proDash.btp.gantt.ajouterTache')}</button>
      </div>
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {showForm && (
        <div className="v22-card">
          <div className="v22-card-head"><span className="v22-card-title">{t('proDash.btp.gantt.nouvelleTache')}</span></div>
          <div className="v22-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.nom')}</label><input className="v22-form-input" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.gantt.nomPlaceholder')} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.chantier')}</label><input className="v22-form-input" value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder={t('proDash.btp.gantt.chantierPlaceholder')} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.responsable')}</label><input className="v22-form-input" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.couleur')}</label><input type="color" className="v22-form-input" style={{ height: 38, padding: '2px 8px' }} value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.debut')}</label><input type="date" className="v22-form-input" value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} /></div>
            <div><label className="v22-form-label">{t('proDash.btp.gantt.fin')}</label><input type="date" className="v22-form-input" value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} /></div>
          </div>
          <div style={{ padding: '0 16px 16px', display: 'flex', gap: 8 }}>
            <button className="v22-btn v22-btn-sm" style={{ background: 'var(--v22-yellow)', fontWeight: 700 }} onClick={addTache} disabled={!form.nom || !form.debut || !form.fin}>{t('proDash.btp.gantt.ajouter')}</button>
            <button className="v22-btn v22-btn-sm" style={{ background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.gantt.annuler')}</button>
          </div>
        </div>
      )}
      {taches.length === 0 ? (
        <div className="v22-card" style={{ padding: 40, textAlign: 'center' }}><div style={{ marginBottom: 12 }}><Calendar size={40} style={{ color: 'var(--v22-text-mid)' }} /></div><p className="v22-card-meta">{t('proDash.btp.gantt.aucuneTache')}</p></div>
      ) : (
        <div className="v22-card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--v22-border)' }}>
                  {[t('proDash.btp.gantt.colTache'), t('proDash.btp.gantt.colChantier'), t('proDash.btp.gantt.colStatut'), t('proDash.btp.gantt.colPlanning'), t('proDash.btp.gantt.colAvancement'), ''].map(h => (
                    <th key={h || '_'} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {taches.map(tc => {
                  const bar = getBar(tc)
                  const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
                  const sv22 = ganttStatV22[tc.statut] || { bg: '#F0EBE3', color: '#6B7B8D' }
                  return (
                    <tr key={tc.id} style={{ borderBottom: '1px solid var(--v22-border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 600, color: '#0D1B2E', fontSize: 13 }}>{tc.nom}</div>
                        <div style={{ fontSize: 11, color: '#8A9BB0' }}>{tc.responsable}</div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#4A5E78', fontSize: 13 }}>{tc.chantier}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: sv22.bg, color: sv22.color }}>
                          {statLabels[tc.statut] || tc.statut}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', minWidth: 180 }}>
                        <div style={{ position: 'relative', height: 20, background: 'var(--v22-bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 3, height: 14, borderRadius: 3, opacity: 0.85, left: bar.left, width: bar.width, backgroundColor: tc.couleur }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8A9BB0', marginTop: 2 }}>
                          <span>{tc.debut ? new Date(tc.debut).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                          <span>{tc.fin ? new Date(tc.fin).toLocaleDateString(dateLocale, { day: '2-digit', month: 'short' }) : ''}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', width: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input type="range" min="0" max="100" value={tc.avancement} onChange={e => updateAvancement(tc.id, Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--v22-yellow)', height: 4 }} />
                          <span style={{ fontSize: 11, fontWeight: 600, minWidth: 30 }}>{tc.avancement}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => deleteTache(tc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E05A5A', fontSize: 14 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
        {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => {
          const statLabels: Record<string, string> = { planifié: t('proDash.btp.gantt.planifie'), en_cours: t('proDash.btp.gantt.enCours'), terminé: t('proDash.btp.gantt.termine'), en_retard: t('proDash.btp.gantt.enRetard') }
          return (
          <div key={s} className="v22-card" style={{ padding: '12px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{taches.filter(tc => tc.statut === s).length}</div>
            <div className="v22-card-meta" style={{ fontSize: 11, textTransform: 'capitalize' }}>{statLabels[s]}</div>
          </div>
        )})}
      </div>
      </div>
    </div>
  )
}
