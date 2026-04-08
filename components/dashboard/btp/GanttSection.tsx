'use client'

import { useState } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export function GanttSection({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
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

  // Generate month columns from minDate to maxDate
  const getMonths = () => {
    const months: { label: string; start: Date; end: Date }[] = []
    const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      const start = new Date(d)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      months.push({
        label: start.toLocaleDateString(dateLocale, { month: 'short' }).replace('.', ''),
        start, end,
      })
      d.setMonth(d.getMonth() + 1)
    }
    return months
  }
  const months = taches.length > 0 ? getMonths() : []
  const gridCols = months.length > 0 ? `180px repeat(${months.length}, 1fr)` : '180px 1fr'

  // For each task, compute which months it spans and bar positions within those months
  const getTaskBars = (tc: Tache) => {
    const taskStart = new Date(tc.debut)
    const taskEnd = new Date(tc.fin)
    const bars: { monthIdx: number; left: string; right: string; showLabel: boolean }[] = []

    months.forEach((m, idx) => {
      const mStart = m.start.getTime()
      const mEnd = m.end.getTime()
      const mDuration = mEnd - mStart

      if (taskEnd.getTime() < mStart || taskStart.getTime() > mEnd) return

      const barStart = Math.max(0, (taskStart.getTime() - mStart) / mDuration)
      const barEnd = Math.max(0, (mEnd - taskEnd.getTime()) / mDuration)
      const isMiddleMonth = taskStart.getTime() <= mStart && taskEnd.getTime() >= mEnd

      bars.push({
        monthIdx: idx,
        left: `${(barStart * 100).toFixed(1)}%`,
        right: `${(barEnd * 100).toFixed(1)}%`,
        showLabel: isMiddleMonth || bars.length === 0,
      })
    })

    return bars
  }

  // Color class based on status
  const statusColorClass = (tc: Tache): string => {
    switch (tc.statut) {
      case 'en_cours': return 'blue'
      case 'terminé': return 'gray'
      case 'en_retard': return 'red'
      case 'planifié': return 'purple'
      default: return 'blue'
    }
  }

  // Today line position in a given month
  const getTodayPosition = (monthIdx: number): string | null => {
    const now = new Date()
    const m = months[monthIdx]
    if (!m) return null
    if (now < m.start || now > m.end) return null
    const pct = ((now.getTime() - m.start.getTime()) / (m.end.getTime() - m.start.getTime())) * 100
    return `${pct.toFixed(1)}%`
  }

  // Status labels
  const statLabels: Record<string, string> = {
    planifié: t('proDash.btp.gantt.planifie'),
    en_cours: t('proDash.btp.gantt.enCours'),
    terminé: t('proDash.btp.gantt.termine'),
    en_retard: t('proDash.btp.gantt.enRetard'),
  }

  return (
    <div>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          {isV5 ? (
            <>
              <h1>Planification Gantt</h1>
              <p>Vue d&apos;ensemble des chantiers</p>
            </>
          ) : (
            <>
              <h1 className="v22-page-title">Planification Gantt</h1>
              <p className="v22-page-sub">Vue d&apos;ensemble des chantiers</p>
            </>
          )}
        </div>
        <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>+ {t('proDash.btp.gantt.ajouterTache')}</button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{t('proDash.btp.gantt.nouvelleTache')}</div>
          <div className={isV5 ? 'v5-fr' : undefined} style={{ marginBottom: '.75rem', ...(isV5 ? {} : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }) }}>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.nom')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={t('proDash.btp.gantt.nomPlaceholder')} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.chantier')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.chantier} onChange={e => setForm({...form, chantier: e.target.value})} placeholder={t('proDash.btp.gantt.chantierPlaceholder')} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.responsable')}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.couleur')}</label>
              <input type="color" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ height: 34, padding: '2px 4px' }} value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.debut')}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{t('proDash.btp.gantt.fin')}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn'} onClick={addTache} disabled={!form.nom || !form.debut || !form.fin}>{t('proDash.btp.gantt.ajouter')}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: '1px solid var(--v22-border)' }} onClick={() => setShowForm(false)}>{t('proDash.btp.gantt.annuler')}</button>
          </div>
        </div>
      )}

      {/* Gantt Chart */}
      {taches.length === 0 ? (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>&#x1F4CA;</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6, color: 'var(--v5-text-primary, #1a1a1a)' }}>{t('proDash.btp.gantt.aucuneTache')}</div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>Ajoutez votre premi\u00E8re t\u00E2che pour visualiser le planning</p>
          <button className={isV5 ? 'v5-btn v5-btn-action' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>+ {t('proDash.btp.gantt.ajouterTache')}</button>
        </div>
      ) : (
        <>
          <div className={isV5 ? 'v5-gantt' : 'v22-card'} style={isV5 ? undefined : { overflow: 'auto' }}>
            <div className={isV5 ? 'v5-gantt-grid' : undefined} style={{ gridTemplateColumns: gridCols, ...(isV5 ? {} : { display: 'grid', gridTemplateColumns: gridCols }) }}>
              {/* Header row */}
              <div className={isV5 ? 'v5-gantt-hdr' : undefined} style={isV5 ? undefined : { display: 'contents' }}>
                <div style={isV5 ? undefined : { padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--v22-text-mid)', borderBottom: '1px solid var(--v22-border)' }}>{t('proDash.btp.gantt.colChantier')}</div>
                {months.map((m, i) => <div key={i} style={isV5 ? undefined : { padding: '8px 12px', fontWeight: 600, fontSize: 11, color: 'var(--v22-text-mid)', borderBottom: '1px solid var(--v22-border)', textAlign: 'center' }}>{m.label}</div>)}
              </div>

              {/* Task rows */}
              {taches.map(tc => {
                const bars = getTaskBars(tc)
                const colorCls = statusColorClass(tc)
                const isTermine = tc.statut === 'terminé'
                const isRetard = tc.statut === 'en_retard'
                const isPlanifie = tc.statut === 'planifié'

                return (
                  <div className={isV5 ? 'v5-gantt-row' : undefined} key={tc.id} style={isV5 ? undefined : { display: 'contents' }}>
                    {/* Task name cell */}
                    <div style={{
                      ...(isV5 ? {} : { padding: '8px 12px', fontSize: 12, borderBottom: '1px solid var(--v22-border)' }),
                      ...(isTermine ? { color: '#999', textDecoration: 'line-through' } : {}),
                      ...(isRetard ? { color: '#C62828' } : {}),
                      ...(isPlanifie ? { color: '#999' } : {}),
                    }}>
                      {tc.nom}
                      {isTermine && ' \u2713'}
                      {isRetard && ' \u26a0\ufe0f'}
                      <button
                        onClick={() => deleteTache(tc.id)}
                        style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 10, verticalAlign: 'middle' }}
                        title="Supprimer"
                      >\u2715</button>
                    </div>

                    {/* Month cells */}
                    {months.map((_, mi) => {
                      const bar = bars.find(b => b.monthIdx === mi)
                      const todayPos = getTodayPosition(mi)
                      // Find the bar where we show the label (roughly middle of the task span)
                      const middleBarIdx = Math.floor(bars.length / 2)
                      const showLabel = bar && bars.indexOf(bar) === middleBarIdx

                      return (
                        <div key={mi} style={{ position: 'relative', ...(isV5 ? {} : { padding: '4px 0', borderBottom: '1px solid var(--v22-border)' }) }}>
                          {bar && (
                            <div
                              className={isV5 ? `v5-gantt-bar ${colorCls}` : undefined}
                              style={{
                                left: bar.left,
                                right: bar.right,
                                ...(isPlanifie ? { opacity: 0.5 } : {}),
                                ...(isV5 ? {} : {
                                  position: 'absolute', top: '20%', bottom: '20%',
                                  left: bar.left, right: bar.right,
                                  borderRadius: 4,
                                  background: colorCls === 'blue' ? '#3B82F6' : colorCls === 'red' ? '#EF5350' : colorCls === 'gray' ? '#9E9E9E' : '#AB47BC',
                                }),
                              }}
                            >
                              {showLabel && (
                                <span className={isV5 ? 'v5-gantt-bar-label' : undefined} style={isV5 ? (colorCls === 'yellow' ? { color: '#333' } : undefined) : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 9, fontWeight: 600, color: '#fff' }}>
                                  {tc.avancement}%
                                </span>
                              )}
                            </div>
                          )}
                          {todayPos && <div className={isV5 ? 'v5-gantt-today' : undefined} style={{ left: todayPos, ...(isV5 ? {} : { position: 'absolute', top: 0, bottom: 0, width: 2, background: '#EF5350', zIndex: 1 }) }} />}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className={isV5 ? 'v5-gantt-legend' : undefined} style={isV5 ? undefined : { fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' }}>
            &#x1F534; Ligne rouge = aujourd&apos;hui &nbsp;&bull;&nbsp; &#x1F536; Losange = jalon cl&eacute;
          </div>

          {/* Advancement sliders */}
          <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginTop: '.75rem' }}>
            <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{t('proDash.btp.gantt.colAvancement')}</div>
            <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={isV5 ? undefined : { borderBottom: '1px solid var(--v22-border)' }}>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.gantt.colTache')}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.gantt.colChantier')}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.gantt.colStatut')}</th>
                  <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: 'var(--v22-text-mid)', fontWeight: 600, fontSize: 11 }}>{t('proDash.btp.gantt.colAvancement')}</th>
                </tr>
              </thead>
              <tbody>
                {taches.map(tc => (
                  <tr key={tc.id} style={isV5 ? undefined : { borderBottom: '1px solid var(--v22-border)' }}>
                    <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                      {tc.nom}
                      <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{tc.responsable}</div>
                    </td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>{tc.chantier}</td>
                    <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                      <span className={isV5 ? `v5-badge ${
                        tc.statut === 'en_cours' ? 'v5-badge-blue' :
                        tc.statut === 'terminé' ? 'v5-badge-green' :
                        tc.statut === 'en_retard' ? 'v5-badge-red' :
                        'v5-badge-gray'
                      }` : `v22-tag ${
                        tc.statut === 'en_cours' ? 'v22-tag-green' :
                        tc.statut === 'terminé' ? 'v22-tag-gray' :
                        tc.statut === 'en_retard' ? 'v22-tag-red' :
                        'v22-tag-amber'
                      }`}>
                        {statLabels[tc.statut] || tc.statut}
                      </span>
                    </td>
                    <td style={{ minWidth: 180, ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                      {isV5 ? (
                        <div className="v5-prog-row">
                          <div className="v5-prog-bg">
                            <div className="v5-prog-fill" style={{
                              width: `${tc.avancement}%`,
                              background: tc.statut === 'en_retard' ? '#EF5350' :
                                          tc.statut === 'terminé' ? '#66BB6A' :
                                          tc.statut === 'en_cours' ? '#42A5F5' : '#AB47BC',
                            }} />
                          </div>
                          <span className="v5-prog-pct">{tc.avancement}%</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                            <div style={{
                              width: `${tc.avancement}%`, height: '100%', borderRadius: 3,
                              background: tc.statut === 'en_retard' ? '#EF5350' :
                                          tc.statut === 'terminé' ? '#66BB6A' :
                                          tc.statut === 'en_cours' ? '#42A5F5' : '#AB47BC',
                            }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, minWidth: 32 }}>{tc.avancement}%</span>
                        </div>
                      )}
                      <input
                        type="range" min="0" max="100" value={tc.avancement}
                        onChange={e => updateAvancement(tc.id, Number(e.target.value))}
                        style={{ width: '100%', accentColor: isV5 ? 'var(--v5-primary-yellow)' : 'var(--v22-yellow)', height: 4, marginTop: 4 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Stats grid */}
          {isV5 ? (
            <div className="v5-kpi-g" style={{ marginTop: '.75rem' }}>
              {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
                <div key={s} className="v5-kpi">
                  <div className="v5-kpi-l">{statLabels[s]}</div>
                  <div className="v5-kpi-v">{taches.filter(tc => tc.statut === s).length}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: '.75rem' }}>
              {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
                <div key={s} className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: 'var(--v22-text-mid)', marginBottom: 4 }}>{statLabels[s]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{taches.filter(tc => tc.statut === s).length}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
