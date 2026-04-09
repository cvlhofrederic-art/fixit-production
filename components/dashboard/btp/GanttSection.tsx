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

// Palette de couleurs distinctes par chantier (rotation cyclique)
const PALETTE = ['#3B82F6', '#F59E0B', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16']

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
    s === 'en_cours' ? '#3B82F6' : s === 'en_retard' ? '#EF5350' : s === 'terminé' ? '#9E9E9E' : '#AB47BC'

  const statLabels: Record<string, string> = {
    planifié: t('proDash.btp.gantt.planifie'),
    en_cours: t('proDash.btp.gantt.enCours'),
    terminé: t('proDash.btp.gantt.termine'),
    en_retard: t('proDash.btp.gantt.enRetard'),
  }

  const subTasksOnly = ganttRows.filter(r => !r.isChantier)

  return (
    <div>
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          {isV5 ? (
            <>
              <h1>Planification Gantt</h1>
              <p>{chantiersWithDates.length} {isPt ? 'obra(s)' : 'chantier(s)'} &middot; {sousTaches.length} {isPt ? 'tarefa(s)' : 'tâche(s)'}</p>
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

      {/* Gantt Chart */}
      {chantiersLoading ? (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#999' }}>{isPt ? 'A carregar obras...' : 'Chargement des chantiers...'}</div>
        </div>
      ) : ganttRows.length === 0 ? (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>&#x1F4CA;</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma obra com datas' : 'Aucun chantier avec des dates'}</div>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 20 }}>{isPt ? 'Crie obras com data de início e fim no separador Chantiers para as ver aqui' : 'Créez des chantiers avec dates de début et fin dans l\'onglet Chantiers pour les voir ici'}</p>
        </div>
      ) : (
        <>
          <div className={isV5 ? 'v5-gantt' : 'v22-card'} style={isV5 ? undefined : { overflow: 'auto' }}>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: gridCols }}>
              <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, color: tv.textMid, borderBottom: `1px solid ${tv.border}` }}>{isPt ? 'Obra' : 'Chantier'}</div>
              {months.map((m, i) => <div key={i} style={{ padding: '8px 12px', fontWeight: 600, fontSize: 11, color: tv.textMid, borderBottom: `1px solid ${tv.border}`, textAlign: 'center', textTransform: 'uppercase' }}>{m.label}</div>)}
            </div>

            {/* Rows — one continuous bar per chantier */}
            {ganttRows.map(row => {
              const color = row.couleur || statusColor(row.statut)
              const isRetard = row.statut === 'en_retard'
              const pos = getBarPosition(row)

              return (
                <div key={`${row.isChantier ? 'c' : 't'}-${row.id}`} style={{ display: 'grid', gridTemplateColumns: gridCols, borderBottom: `1px solid ${tv.border}` }}>
                  {/* Name cell */}
                  <div style={{
                    padding: '10px 12px', display: 'flex', alignItems: 'center',
                    ...(row.isChantier ? { fontWeight: 700, fontSize: 13 } : { paddingLeft: 28, fontSize: 12, color: '#555' }),
                    ...(isRetard ? { color: '#C62828' } : {}),
                  }}>
                    {row.isChantier ? '' : '└ '}{row.nom}
                    {isRetard && ' ⚠️'}
                    {!row.isChantier && (
                      <button onClick={() => deleteSousTache(row.id)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 10, verticalAlign: 'middle' }} title="Supprimer">✕</button>
                    )}
                  </div>

                  {/* Chart area — single cell spanning all months */}
                  <div style={{ gridColumn: '2 / -1', position: 'relative', minHeight: row.isChantier ? 36 : 28 }}>
                    {/* Month grid lines */}
                    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
                      {months.map((_, i) => <div key={i} style={{ borderLeft: i > 0 ? `1px solid ${tv.border}22` : 'none' }} />)}
                    </div>

                    {/* Continuous bar — full extent = light color, filled portion = solid color */}
                    <div style={{
                      position: 'absolute',
                      top: row.isChantier ? '15%' : '22%',
                      bottom: row.isChantier ? '15%' : '22%',
                      left: pos.left,
                      right: pos.right,
                      borderRadius: row.isChantier ? 6 : 4,
                      background: color,
                      opacity: 0.92,
                      overflow: 'hidden',
                    }}>
                      {/* Unfilled portion (lighter) overlaid on the right side */}
                      {row.avancement < 100 && (
                        <div style={{
                          position: 'absolute',
                          top: 0, bottom: 0,
                          left: `${row.avancement}%`,
                          right: 0,
                          background: `${color}55`,
                          mixBlendMode: 'lighten',
                        }} />
                      )}
                      {/* Percentage label centered on bar */}
                      <span style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%,-50%)',
                        fontSize: row.isChantier ? 11 : 9, fontWeight: 700,
                        color: '#fff', whiteSpace: 'nowrap', zIndex: 2,
                        textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                      }}>
                        {row.avancement}%
                      </span>
                    </div>

                    {/* Per-chantier progress marker (red line at avancement point) */}
                    {row.isChantier && row.avancement > 0 && row.avancement < 100 && (() => {
                      const taskStart = new Date(row.debut).getTime()
                      const taskEnd = new Date(row.fin).getTime()
                      const progressTime = taskStart + (taskEnd - taskStart) * (row.avancement / 100)
                      const progressPct = ((progressTime - timelineStart) / timelineSpan * 100).toFixed(2)
                      return (
                        <div style={{
                          position: 'absolute', top: 0, bottom: 0,
                          left: `${progressPct}%`, width: 2,
                          background: '#EF5350', zIndex: 3,
                          borderRadius: 1,
                        }} />
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div style={{ fontSize: 11, color: '#999', marginTop: 8, textAlign: 'center' }}>
            🔴 {isPt ? 'Linha vermelha = avanço do chantier' : 'Ligne rouge = avancement du chantier'} &nbsp;&bull;&nbsp; {isPt ? 'Obras terminadas não aparecem' : 'Chantiers terminés masqués'}
          </div>

          {/* Sub-task advancement */}
          {subTasksOnly.length > 0 && (
            <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginTop: '.75rem' }}>
              <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Avanço das tarefas' : 'Avancement des tâches'}</div>
              <table className={isV5 ? 'v5-dt' : undefined} style={isV5 ? undefined : { width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                    <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isPt ? 'Tarefa' : 'Tâche'}</th>
                    <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isPt ? 'Obra' : 'Chantier'}</th>
                    <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isPt ? 'Estado' : 'Statut'}</th>
                    <th style={isV5 ? undefined : { textAlign: 'left', padding: '8px 12px', color: tv.textMid, fontWeight: 600, fontSize: 11 }}>{isPt ? 'Avanço' : 'Avancement'}</th>
                  </tr>
                </thead>
                <tbody>
                  {subTasksOnly.map(row => {
                    const chantier = chantiers.find(c => c.id === row.chantierId)
                    return (
                      <tr key={row.id} style={isV5 ? undefined : { borderBottom: `1px solid ${tv.border}` }}>
                        <td style={{ fontWeight: 600, ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                          {row.nom}
                          <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{row.responsable}</div>
                        </td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>{chantier?.titre || '—'}</td>
                        <td style={isV5 ? undefined : { padding: '8px 12px' }}>
                          <span className={isV5 ? `v5-badge ${
                            row.statut === 'en_cours' ? 'v5-badge-blue' :
                            row.statut === 'terminé' ? 'v5-badge-green' :
                            row.statut === 'en_retard' ? 'v5-badge-red' : 'v5-badge-gray'
                          }` : `v22-tag ${
                            row.statut === 'en_cours' ? 'v22-tag-green' :
                            row.statut === 'terminé' ? 'v22-tag-gray' :
                            row.statut === 'en_retard' ? 'v22-tag-red' : 'v22-tag-amber'
                          }`}>
                            {statLabels[row.statut] || row.statut}
                          </span>
                        </td>
                        <td style={{ minWidth: 180, ...(isV5 ? {} : { padding: '8px 12px' }) }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                              <div style={{ width: `${row.avancement}%`, height: '100%', borderRadius: 3, background: statusColor(row.statut) }} />
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 600, minWidth: 32 }}>{row.avancement}%</span>
                          </div>
                          <input
                            type="range" min="0" max="100" value={row.avancement}
                            onChange={e => updateAvancement(row.id, Number(e.target.value))}
                            style={{ width: '100%', accentColor: isV5 ? 'var(--v5-primary-yellow)' : tv.primary, height: 4, marginTop: 4 }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Stats */}
          {isV5 ? (
            <div className="v5-kpi-g" style={{ marginTop: '.75rem' }}>
              {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
                <div key={s} className="v5-kpi">
                  <div className="v5-kpi-l">{statLabels[s]}</div>
                  <div className="v5-kpi-v">{ganttRows.filter(r => r.statut === s).length}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: '.75rem' }}>
              {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
                <div key={s} className="v22-card" style={{ padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: tv.textMid, marginBottom: 4 }}>{statLabels[s]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>{ganttRows.filter(r => r.statut === s).length}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
