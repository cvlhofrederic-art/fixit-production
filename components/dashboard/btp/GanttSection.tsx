'use client'

import { useState, useEffect } from 'react'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import { useThemeVars } from '../useThemeVars'
import { useBTPData } from '@/lib/hooks/use-btp-data'

interface ChantierItem {
  id: string; titre: string; client: string; dateDebut: string
  dateFin: string; statut: string; equipe: string
}

interface SousTache {
  id: string; nom: string; chantierId: string; responsable: string
  debut: string; fin: string; avancement: number; couleur: string
}

type GanttRow = {
  id: string; nom: string; chantierId?: string; responsable: string
  debut: string; fin: string; avancement: number
  statut: 'planifié' | 'en_cours' | 'terminé' | 'en_retard'
  couleur: string; isChantier: boolean
}

function mapChantierStatut(statut: string, dateFin: string): GanttRow['statut'] {
  if (statut === 'Terminé') return 'terminé'
  if (statut === 'En attente') return 'planifié'
  // "En cours" — check if overdue
  if (dateFin && new Date(dateFin) < new Date()) return 'en_retard'
  return 'en_cours'
}

// Palette from HTML mockup — rotation cyclique
const PALETTE = ['#42A5F5', '#66BB6A', '#FFA726', '#FFCA28', '#AB47BC', '#EF5350', '#42A5F5']

function getChantierColor(index: number): string {
  return PALETTE[index % PALETTE.length]
}

function computeChantierAvancement(dateDebut: string, dateFin: string): number {
  const start = new Date(dateDebut).getTime()
  const end = new Date(dateFin).getTime()
  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100
  return Math.round(((now - start) / (end - start)) * 100)
}

export function GanttSection({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const isPt = locale === 'pt'

  const SUBTASKS_KEY = `gantt_subtasks_${userId}`

  // Load chantiers from Supabase via useBTPData (with 30s cache)
  const { items: supaChantiers, loading: chantiersLoading } = useBTPData<ChantierItem>({
    table: 'chantiers',
    artisanId: userId,
    userId: userId,
  })
  const chantiers = supaChantiers

  // Sub-tasks (manually added, linked to a chantier)
  const [sousTaches, setSousTaches] = useState<SousTache[]>(() => {
    try { return JSON.parse(localStorage.getItem(SUBTASKS_KEY) || '[]') } catch { return [] }
  })
  const saveST = (data: SousTache[]) => { setSousTaches(data); localStorage.setItem(SUBTASKS_KEY, JSON.stringify(data)) }

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nom: '', chantierId: '', responsable: '', debut: '', fin: '', couleur: '#3B82F6' })

  const addSousTache = () => {
    if (!form.nom || !form.debut || !form.fin) return
    saveST([...sousTaches, { ...form, id: Date.now().toString(), avancement: 0 }])
    setShowForm(false)
    setForm({ nom: '', chantierId: '', responsable: '', debut: '', fin: '', couleur: '#3B82F6' })
  }
  const updateAvancement = (id: string, val: number) => saveST(sousTaches.map(st => st.id === id ? { ...st, avancement: val } : st))
  const deleteSousTache = (id: string) => saveST(sousTaches.filter(st => st.id !== id))

  // Build Gantt rows: chantiers (exclude terminé) + sub-tasks grouped
  const chantiersWithDates = chantiers.filter(c => c.dateDebut && c.dateFin && c.statut !== 'Terminé')

  const ganttRows: GanttRow[] = []
  chantiersWithDates.forEach((c, idx) => {
    const couleur = getChantierColor(idx)
    const avancement = computeChantierAvancement(c.dateDebut, c.dateFin)
    // Chantier row
    ganttRows.push({
      id: c.id, nom: c.titre, responsable: c.equipe || c.client || '',
      debut: c.dateDebut, fin: c.dateFin, avancement,
      statut: mapChantierStatut(c.statut, c.dateFin),
      couleur,
      isChantier: true,
    })
    // Sub-tasks for this chantier
    sousTaches.filter(st => st.chantierId === c.id).forEach(st => {
      const isOverdue = st.avancement < 100 && new Date(st.fin) < new Date()
      ganttRows.push({
        id: st.id, nom: st.nom, chantierId: c.id, responsable: st.responsable,
        debut: st.debut, fin: st.fin, avancement: st.avancement,
        statut: st.avancement >= 100 ? 'terminé' : isOverdue ? 'en_retard' : st.avancement > 0 ? 'en_cours' : 'planifié',
        couleur: st.couleur, isChantier: false,
      })
    })
  })
  // Orphan sub-tasks (chantier deleted or terminated)
  sousTaches.filter(st => !st.chantierId || !chantiersWithDates.find(c => c.id === st.chantierId)).forEach(st => {
    // Skip sub-tasks of terminated chantiers
    if (st.chantierId && chantiers.find(c => c.id === st.chantierId && c.statut === 'Terminé')) return
    const isOverdue = st.avancement < 100 && new Date(st.fin) < new Date()
    ganttRows.push({
      id: st.id, nom: st.nom, chantierId: st.chantierId, responsable: st.responsable,
      debut: st.debut, fin: st.fin, avancement: st.avancement,
      statut: st.avancement >= 100 ? 'terminé' : isOverdue ? 'en_retard' : st.avancement > 0 ? 'en_cours' : 'planifié',
      couleur: st.couleur, isChantier: false,
    })
  })

  // Timeline computation
  const allDates = ganttRows.flatMap(r => [new Date(r.debut), new Date(r.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 30 * 86400000)

  const getMonths = () => {
    const months: { label: string; start: Date; end: Date }[] = []
    const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      const start = new Date(d)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      months.push({ label: start.toLocaleDateString(dateLocale, { month: 'short' }).replace('.', ''), start, end })
      d.setMonth(d.getMonth() + 1)
    }
    return months
  }
  const months = ganttRows.length > 0 ? getMonths() : []
  const gridCols = months.length > 0 ? `200px repeat(${months.length}, 1fr)` : '200px 1fr'

  // Timeline total range
  const timelineStart = months.length ? months[0].start.getTime() : Date.now()
  const timelineEnd = months.length ? months[months.length - 1].end.getTime() : Date.now() + 30 * 86400000
  const timelineSpan = timelineEnd - timelineStart || 1

  // Position a bar as % of the total timeline
  const getBarPosition = (row: GanttRow) => {
    const s = new Date(row.debut).getTime()
    const e = new Date(row.fin).getTime()
    const left = Math.max(0, (s - timelineStart) / timelineSpan * 100)
    const right = Math.max(0, (timelineEnd - e) / timelineSpan * 100)
    return { left: `${left.toFixed(2)}%`, right: `${right.toFixed(2)}%` }
  }

  const statusColor = (s: GanttRow['statut']) =>
    s === 'en_cours' ? '#42A5F5' : s === 'en_retard' ? '#EF5350' : s === 'terminé' ? '#BDBDBD' : '#AB47BC'

  const statLabels: Record<string, string> = {
    planifié: t('proDash.btp.gantt.planifie'),
    en_cours: t('proDash.btp.gantt.enCours'),
    terminé: t('proDash.btp.gantt.termine'),
    en_retard: t('proDash.btp.gantt.enRetard'),
  }

  const subTasksOnly = ganttRows.filter(r => !r.isChantier)

  // Today line position (% of timeline)
  const todayPct = months.length > 0 ? Math.max(0, Math.min(100, ((Date.now() - timelineStart) / timelineSpan) * 100)) : 0

  // Per-month bar segments for a row
  const getMonthSegments = (row: GanttRow) => {
    const rowStart = new Date(row.debut).getTime()
    const rowEnd = new Date(row.fin).getTime()
    return months.map(m => {
      const mStart = m.start.getTime()
      const mEnd = m.end.getTime()
      // No overlap
      if (rowEnd <= mStart || rowStart >= mEnd) return null
      // Clamp to month boundaries
      const segStart = Math.max(rowStart, mStart)
      const segEnd = Math.min(rowEnd, mEnd)
      const left = ((segStart - mStart) / (mEnd - mStart)) * 100
      const right = ((mEnd - segEnd) / (mEnd - mStart)) * 100
      return { left, right }
    })
  }

  // Check if "today" falls within a month
  const getTodayInMonth = (m: { start: Date; end: Date }) => {
    const now = Date.now()
    const mStart = m.start.getTime()
    const mEnd = m.end.getTime()
    if (now < mStart || now > mEnd) return null
    return ((now - mStart) / (mEnd - mStart)) * 100
  }

  return (
    <div>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          {isV5 ? (
            <>
              <h1>Planification Gantt</h1>
              <p>{isPt ? 'Vista geral das obras' : 'Vue d\'ensemble des chantiers'} — {months.length > 0 ? `${months[0].label} → ${months[months.length - 1].label} 2026` : ''}</p>
            </>
          ) : (
            <>
              <h1 className="v22-page-title">Planification Gantt</h1>
              <p className="v22-page-sub">{chantiersWithDates.length} {isPt ? 'obra(s)' : 'chantier(s)'} &middot; {sousTaches.length} {isPt ? 'tarefa(s)' : 'tâche(s)'}</p>
            </>
          )}
        </div>
        {chantiersWithDates.length > 0 && (
          <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>+ {isPt ? 'Tarefa' : 'Sous-tâche'}</button>
        )}
      </div>

      {/* Add sub-task form */}
      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Nova tarefa' : 'Nouvelle sous-tâche'}</div>
          <div className={isV5 ? 'v5-fr' : undefined} style={{ marginBottom: '.75rem', ...(isV5 ? {} : { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }) }}>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Obra' : 'Chantier'}</label>
              <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.chantierId} onChange={e => setForm({...form, chantierId: e.target.value})}>
                <option value="">{isPt ? 'Selecionar obra...' : 'Sélectionner un chantier...'}</option>
                {chantiersWithDates.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Nome da tarefa' : 'Nom de la tâche'}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={isPt ? 'Ex: Demolição' : 'Ex: Démolition'} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Responsável' : 'Responsable'}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Cor' : 'Couleur'}</label>
              <input type="color" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ height: 34, padding: '2px 4px' }} value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Início' : 'Début'}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} />
            </div>
            <div className={isV5 ? 'v5-fg' : undefined}>
              <label className={isV5 ? 'v5-fl' : 'v22-form-label'}>{isPt ? 'Fim' : 'Fin'}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={addSousTache} disabled={!form.nom || !form.debut || !form.fin}>{isPt ? 'Adicionar' : 'Ajouter'}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={isV5 ? undefined : { background: 'none', border: `1px solid ${tv.border}` }} onClick={() => setShowForm(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          </div>
        </div>
      )}

      {/* Gantt Chart — HTML mockup design */}
      {chantiersLoading ? (
        <div style={{ overflow: 'hidden', border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#999' }}>{isPt ? 'A carregar obras...' : 'Chargement des chantiers...'}</div>
        </div>
      ) : ganttRows.length === 0 ? (
        <div style={{ overflow: 'hidden', border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma obra com datas' : 'Aucun chantier avec des dates'}</div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>{isPt ? 'Crie obras com data de início e fim no separador Chantiers para as ver aqui' : 'Créez des chantiers avec dates de début et fin dans l\'onglet Chantiers pour les voir ici'}</p>
        </div>
      ) : (
        <>
          {/* Gantt grid container */}
          <div style={{ overflowX: 'auto', border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${months.length}, 1fr)`, minWidth: 900 }}>

              {/* Header row */}
              <div style={{ display: 'contents' }}>
                <div style={{ padding: '6px 8px', paddingLeft: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'left' }}>
                  {isPt ? 'Obra' : 'Chantier'}
                </div>
                {months.map((m, i) => (
                  <div key={i} style={{ padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'center' }}>
                    {m.label}
                  </div>
                ))}
              </div>

              {/* Data rows */}
              {ganttRows.map(row => {
                const color = row.couleur || statusColor(row.statut)
                const isRetard = row.statut === 'en_retard'
                const isTermine = row.statut === 'terminé'
                const isPlanifie = row.statut === 'planifié'
                const segments = getMonthSegments(row)

                // Find which month contains the widest segment to place the label
                let labelMonthIdx = -1
                let maxWidth = 0
                segments.forEach((seg, i) => {
                  if (seg) {
                    const w = 100 - seg.left - seg.right
                    if (w > maxWidth) { maxWidth = w; labelMonthIdx = i }
                  }
                })

                return (
                  <div key={`${row.isChantier ? 'c' : 't'}-${row.id}`} style={{ display: 'contents' }}>
                    {/* Name cell */}
                    <div style={{
                      padding: 8, paddingLeft: 12, borderBottom: '1px solid #F0F0F0', fontSize: 11,
                      fontWeight: 600, display: 'flex', alignItems: 'center',
                      ...(isTermine ? { color: '#999', textDecoration: 'line-through' } : {}),
                      ...(isRetard ? { color: '#C62828' } : {}),
                      ...(isPlanifie ? { color: '#999' } : {}),
                      ...(!row.isChantier ? { paddingLeft: 24, fontWeight: 400 } : {}),
                    }}>
                      {!row.isChantier && <span style={{ marginRight: 4, color: '#ccc' }}>└</span>}
                      {row.nom}
                      {isTermine && row.isChantier && ' ✓'}
                      {isRetard && ' ⚠️'}
                      {!row.isChantier && (
                        <button onClick={() => deleteSousTache(row.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 9, padding: '0 4px' }} title="Supprimer">✕</button>
                      )}
                    </div>

                    {/* Month cells with bar segments */}
                    {months.map((m, mi) => {
                      const seg = segments[mi]
                      const todayInMonth = getTodayInMonth(m)

                      return (
                        <div key={mi} style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, position: 'relative' }}>
                          {seg && (
                            <div style={{
                              position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                              left: `${Math.max(4, seg.left)}%`,
                              right: `${Math.max(4, seg.right)}%`,
                              height: 20, borderRadius: 3, minWidth: 4,
                              background: isTermine ? '#BDBDBD' : color,
                              opacity: isPlanifie ? 0.5 : 1,
                            }}>
                              {/* Label on the widest segment */}
                              {mi === labelMonthIdx && (
                                <span style={{
                                  position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                                  left: 6, fontSize: 9, fontWeight: 600,
                                  color: color === '#FFCA28' ? '#333' : '#fff',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {row.avancement}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Today red line */}
                          {row.isChantier && todayInMonth !== null && (
                            <div style={{
                              position: 'absolute', top: 0, bottom: 0,
                              left: `${todayInMonth}%`, width: 2,
                              background: '#E53935', zIndex: 2,
                            }} />
                          )}

                          {/* Diamond milestone — at end of bar if this is the last month with a segment */}
                          {row.isChantier && seg && mi > 0 && !segments[mi + 1] && seg.right > 10 && (
                            <div style={{
                              width: 10, height: 10, background: '#FFC107',
                              transform: 'rotate(45deg)', position: 'absolute',
                              top: '50%', marginTop: -5,
                              right: `${Math.max(2, seg.right - 5)}%`,
                              zIndex: 3,
                            }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ marginTop: 8, fontSize: 10, color: '#999' }}>
            🔴 {isPt ? 'Linha vermelha = hoje' : 'Ligne rouge = aujourd\'hui'} &nbsp;&bull;&nbsp; 🔶 {isPt ? 'Losango = marco' : 'Losange = jalon clé'}
          </div>

          {/* Sub-task advancement table */}
          {subTasksOnly.length > 0 && (
            <div style={{ overflow: 'hidden', border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', marginTop: 12 }}>
              <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#333', borderBottom: '1px solid #E8E8E8', background: '#FAFAFA' }}>
                {isPt ? 'Avanço das tarefas' : 'Avancement des tâches'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '6px 8px', paddingLeft: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{isPt ? 'Tarefa' : 'Tâche'}</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{isPt ? 'Obra' : 'Chantier'}</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{isPt ? 'Estado' : 'Statut'}</th>
                    <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{isPt ? 'Avanço' : 'Avancement'}</th>
                  </tr>
                </thead>
                <tbody>
                  {subTasksOnly.map(row => {
                    const chantier = chantiers.find(c => c.id === row.chantierId)
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: 8, paddingLeft: 12, borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600 }}>
                          {row.nom}
                          <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{row.responsable}</div>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>{chantier?.titre || '—'}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                            background: row.statut === 'en_cours' ? '#E3F2FD' : row.statut === 'terminé' ? '#F5F5F5' : row.statut === 'en_retard' ? '#FFEBEE' : '#F3E5F5',
                            color: row.statut === 'en_cours' ? '#1565C0' : row.statut === 'terminé' ? '#757575' : row.statut === 'en_retard' ? '#C62828' : '#7B1FA2',
                          }}>
                            {statLabels[row.statut] || row.statut}
                          </span>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                              <div style={{ width: `${row.avancement}%`, height: '100%', borderRadius: 3, background: statusColor(row.statut) }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, minWidth: 28 }}>{row.avancement}%</span>
                          </div>
                          <input
                            type="range" min="0" max="100" value={row.avancement}
                            onChange={e => updateAvancement(row.id, Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#FFC107', height: 4, marginTop: 4 }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
              <div key={s} style={{ border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>{statLabels[s]}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: statusColor(s) }}>{ganttRows.filter(r => r.statut === s).length}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
