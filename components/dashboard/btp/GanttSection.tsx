'use client'

import { useState } from 'react'
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
  if (dateFin && new Date(dateFin) < new Date()) return 'en_retard'
  return 'en_cours'
}

// Exact HTML mockup colors
const PALETTE = ['#42A5F5', '#66BB6A', '#FFA726', '#FFCA28', '#AB47BC', '#EF5350', '#42A5F5']
function getChantierColor(index: number): string { return PALETTE[index % PALETTE.length] }

function computeAvancement(dateDebut: string, dateFin: string): number {
  const s = new Date(dateDebut).getTime(), e = new Date(dateFin).getTime(), n = Date.now()
  if (n <= s) return 0
  if (n >= e) return 100
  return Math.round(((n - s) / (e - s)) * 100)
}

/** For a given row & month, return left/right % for the bar segment, or null if no overlap */
function getSegment(rowStart: number, rowEnd: number, mStart: number, mEnd: number) {
  if (rowEnd <= mStart || rowStart >= mEnd) return null
  const segStart = Math.max(rowStart, mStart)
  const segEnd = Math.min(rowEnd, mEnd)
  const span = mEnd - mStart
  return { left: ((segStart - mStart) / span) * 100, right: ((mEnd - segEnd) / span) * 100 }
}

export function GanttSection({ userId, orgRole }: { userId: string; orgRole?: string }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isV5 = orgRole === 'pro_societe' || orgRole === 'artisan'
  const tv = useThemeVars(isV5)
  const dateLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const isPt = locale === 'pt'

  const SUBTASKS_KEY = `gantt_subtasks_${userId}`
  const { items: chantiers, loading } = useBTPData<ChantierItem>({ table: 'chantiers', artisanId: userId, userId })

  const [sousTaches, setSousTaches] = useState<SousTache[]>(() => {
    try { return JSON.parse(localStorage.getItem(SUBTASKS_KEY) || '[]') } catch { return [] }
  })
  const saveST = (d: SousTache[]) => { setSousTaches(d); localStorage.setItem(SUBTASKS_KEY, JSON.stringify(d)) }
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

  // Build rows
  const active = chantiers.filter(c => c.dateDebut && c.dateFin && c.statut !== 'Terminé')
  const rows: GanttRow[] = []
  active.forEach((c, idx) => {
    rows.push({
      id: c.id, nom: c.titre, responsable: c.equipe || c.client || '',
      debut: c.dateDebut, fin: c.dateFin, avancement: computeAvancement(c.dateDebut, c.dateFin),
      statut: mapChantierStatut(c.statut, c.dateFin), couleur: getChantierColor(idx), isChantier: true,
    })
    sousTaches.filter(st => st.chantierId === c.id).forEach(st => {
      const overdue = st.avancement < 100 && new Date(st.fin) < new Date()
      rows.push({
        id: st.id, nom: st.nom, chantierId: c.id, responsable: st.responsable,
        debut: st.debut, fin: st.fin, avancement: st.avancement,
        statut: st.avancement >= 100 ? 'terminé' : overdue ? 'en_retard' : st.avancement > 0 ? 'en_cours' : 'planifié',
        couleur: st.couleur, isChantier: false,
      })
    })
  })

  // Timeline months
  const allDates = rows.flatMap(r => [new Date(r.debut), new Date(r.fin)]).filter(d => !isNaN(d.getTime()))
  const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => d.getTime()))) : new Date()
  const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => d.getTime()))) : new Date(Date.now() + 90 * 86400000)

  const months: { label: string; start: Date; end: Date }[] = []
  if (rows.length > 0) {
    const d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      const start = new Date(d)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      months.push({ label: start.toLocaleDateString(dateLocale, { month: 'short' }).replace('.', '').toUpperCase(), start, end })
      d.setMonth(d.getMonth() + 1)
    }
  }

  // "Today" position in each month (% within the month cell, or null)
  const todayInMonth = (m: { start: Date; end: Date }) => {
    const now = Date.now(), ms = m.start.getTime(), me = m.end.getTime()
    if (now < ms || now > me) return null
    return ((now - ms) / (me - ms)) * 100
  }

  const statusColor = (s: GanttRow['statut']) =>
    s === 'en_cours' ? '#42A5F5' : s === 'en_retard' ? '#EF5350' : s === 'terminé' ? '#BDBDBD' : '#AB47BC'

  const statLabels: Record<string, string> = {
    planifié: t('proDash.btp.gantt.planifie'),
    en_cours: t('proDash.btp.gantt.enCours'),
    terminé: t('proDash.btp.gantt.termine'),
    en_retard: t('proDash.btp.gantt.enRetard'),
  }

  const subTasks = rows.filter(r => !r.isChantier)
  const todayLabel = new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long' })

  // CSS-in-JS matching HTML mockup exactly
  const S = {
    gantt: { overflowX: 'auto' as const, border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff' },
    grid: { display: 'grid' as const, gridTemplateColumns: `180px repeat(${months.length}, 1fr)`, minWidth: 900 },
    hdr: { display: 'contents' as const },
    hdrCell: { padding: '6px 8px', fontSize: 10, fontWeight: 700 as const, textTransform: 'uppercase' as const, color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'center' as const },
    hdrFirst: { padding: '6px 8px', paddingLeft: 12, fontSize: 10, fontWeight: 700 as const, textTransform: 'uppercase' as const, color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8', textAlign: 'left' as const },
    row: { display: 'contents' as const },
    cell: { padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, position: 'relative' as const },
    nameCell: { padding: 8, paddingLeft: 12, borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600 as const, display: 'flex' as const, alignItems: 'center' as const },
    bar: { height: 20, borderRadius: 3, position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', minWidth: 4 },
    barLabel: { position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)', left: 6, fontSize: 9, fontWeight: 600 as const, color: '#fff', whiteSpace: 'nowrap' as const },
    today: { position: 'absolute' as const, top: 0, bottom: 0, width: 2, background: '#E53935', zIndex: 2 },
    diamond: { width: 10, height: 10, background: '#FFC107', transform: 'rotate(45deg)', position: 'absolute' as const, top: '50%', marginTop: -5, zIndex: 3 },
  }

  return (
    <div>
      {/* Header */}
      <div className={isV5 ? 'v5-pg-t' : 'v22-page-header'}>
        <div>
          <h1>{isV5 ? '' : <span className="v22-page-title" />}Planification Gantt</h1>
          <p>{isPt ? 'Vista geral das obras' : 'Vue d\'ensemble des chantiers'} — {months.length >= 2 ? `${months[0].label} → ${months[months.length - 1].label} 2026` : ''}</p>
        </div>
        {active.length > 0 && (
          <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={() => setShowForm(true)}>+ {isPt ? 'Tarefa' : 'Sous-tâche'}</button>
        )}
      </div>

      {/* Add sub-task form */}
      {showForm && (
        <div className={isV5 ? 'v5-card' : 'v22-card'} style={{ marginBottom: '1.25rem' }}>
          <div className={isV5 ? 'v5-st' : 'v22-card-title'}>{isPt ? 'Nova tarefa' : 'Nouvelle sous-tâche'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: '.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Obra' : 'Chantier'}</label>
              <select className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.chantierId} onChange={e => setForm({...form, chantierId: e.target.value})}>
                <option value="">{isPt ? 'Selecionar...' : 'Sélectionner...'}</option>
                {active.map(c => <option key={c.id} value={c.id}>{c.titre}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Nome' : 'Nom'}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} placeholder={isPt ? 'Ex: Demolição' : 'Ex: Démolition'} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Responsável' : 'Responsable'}</label>
              <input className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Início' : 'Début'}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.debut} onChange={e => setForm({...form, debut: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Fim' : 'Fin'}</label>
              <input type="date" className={isV5 ? 'v5-fi' : 'v22-form-input'} value={form.fin} onChange={e => setForm({...form, fin: e.target.value})} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, marginBottom: 4, color: '#666' }}>{isPt ? 'Cor' : 'Couleur'}</label>
              <input type="color" className={isV5 ? 'v5-fi' : 'v22-form-input'} style={{ height: 34, padding: '2px 4px' }} value={form.couleur} onChange={e => setForm({...form, couleur: e.target.value})} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={isV5 ? 'v5-btn v5-btn-p' : 'v22-btn v22-btn-action'} onClick={addSousTache} disabled={!form.nom || !form.debut || !form.fin}>{isPt ? 'Adicionar' : 'Ajouter'}</button>
            <button className={isV5 ? 'v5-btn' : 'v22-btn'} style={{ background: 'none', border: '1px solid #E8E8E8' }} onClick={() => setShowForm(false)}>{isPt ? 'Cancelar' : 'Annuler'}</button>
          </div>
        </div>
      )}

      {/* Gantt Chart — exact HTML mockup structure */}
      {loading ? (
        <div style={{ ...S.gantt, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#999' }}>{isPt ? 'A carregar...' : 'Chargement...'}</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ ...S.gantt, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.4 }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{isPt ? 'Nenhuma obra com datas' : 'Aucun chantier avec des dates'}</div>
          <p style={{ fontSize: 12, color: '#999' }}>{isPt ? 'Crie obras com datas no separador Chantiers' : 'Créez des chantiers avec dates dans l\'onglet Chantiers'}</p>
        </div>
      ) : (
        <>
          <div style={S.gantt}>
            <div style={S.grid}>
              {/* ── Header ── */}
              <div style={S.hdr}>
                <div style={S.hdrFirst}>{isPt ? 'Obra' : 'Chantier'}</div>
                {months.map((m, i) => <div key={i} style={S.hdrCell}>{m.label}</div>)}
              </div>

              {/* ── Rows ── */}
              {rows.map(row => {
                const color = row.isChantier ? row.couleur : (row.couleur || statusColor(row.statut))
                const isRetard = row.statut === 'en_retard'
                const isTermine = row.statut === 'terminé'
                const isPlanifie = row.statut === 'planifié'
                const rStart = new Date(row.debut).getTime()
                const rEnd = new Date(row.fin).getTime()

                // Find which month has the most bar coverage (for placing the % label)
                let labelIdx = -1, bestW = 0
                months.forEach((m, i) => {
                  const seg = getSegment(rStart, rEnd, m.start.getTime(), m.end.getTime())
                  if (seg) { const w = 100 - seg.left - seg.right; if (w > bestW) { bestW = w; labelIdx = i } }
                })

                return (
                  <div key={`${row.isChantier ? 'c' : 't'}-${row.id}`} style={S.row}>
                    {/* Name */}
                    <div style={{
                      ...S.nameCell,
                      ...(isTermine ? { color: '#999', textDecoration: 'line-through' } : {}),
                      ...(isRetard ? { color: '#C62828' } : {}),
                      ...(isPlanifie ? { color: '#999' } : {}),
                      ...(!row.isChantier ? { paddingLeft: 24, fontWeight: 400 as const } : {}),
                    }}>
                      {row.nom}
                      {isTermine && row.isChantier && ' ✓'}
                      {isRetard && ' ⚠️'}
                      {!row.isChantier && (
                        <button onClick={() => deleteSousTache(row.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#E53935', fontSize: 9, padding: '0 4px' }} title="Supprimer">✕</button>
                      )}
                    </div>

                    {/* Month cells */}
                    {months.map((m, mi) => {
                      const seg = getSegment(rStart, rEnd, m.start.getTime(), m.end.getTime())
                      const tp = todayInMonth(m)

                      return (
                        <div key={mi} style={S.cell}>
                          {seg && (
                            <div style={{
                              ...S.bar,
                              left: `${seg.left}%`,
                              right: `${seg.right}%`,
                              background: isTermine ? '#BDBDBD' : color,
                              opacity: isPlanifie ? 0.5 : 1,
                            }}>
                              {mi === labelIdx && (
                                <span style={{ ...S.barLabel, color: color === '#FFCA28' ? '#333' : '#fff' }}>
                                  {row.avancement}%
                                </span>
                              )}
                            </div>
                          )}

                          {/* Today red line — shown once per row in the right month cell */}
                          {tp !== null && (
                            <div style={{ ...S.today, left: `${tp}%` }} />
                          )}

                          {/* Diamond milestone at end of last segment */}
                          {row.isChantier && seg && !getSegment(rStart, rEnd, months[mi + 1]?.start.getTime() || Infinity, months[mi + 1]?.end.getTime() || Infinity) && seg.right > 5 && (
                            <div style={{ ...S.diamond, right: `${Math.max(1, seg.right - 3)}%` }} />
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
            🔴 {isPt ? `Linha vermelha = hoje (${todayLabel})` : `Ligne rouge = aujourd'hui (${todayLabel})`} &nbsp;&bull;&nbsp; 🔶 {isPt ? 'Losango = jalon clé' : 'Losange = jalon clé'}
          </div>

          {/* Sub-task table */}
          {subTasks.length > 0 && (
            <div style={{ ...S.gantt, marginTop: 12 }}>
              <div style={{ padding: '8px 12px', fontWeight: 700, fontSize: 11, color: '#333', borderBottom: '1px solid #E8E8E8', background: '#FAFAFA' }}>
                {isPt ? 'Avanço das tarefas' : 'Avancement des tâches'}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {[isPt ? 'Tarefa' : 'Tâche', isPt ? 'Obra' : 'Chantier', isPt ? 'Estado' : 'Statut', isPt ? 'Avanço' : 'Avancement'].map((h, i) => (
                      <th key={i} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', background: '#FAFAFA', borderBottom: '2px solid #E8E8E8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subTasks.map(row => {
                    const ch = chantiers.find(c => c.id === row.chantierId)
                    return (
                      <tr key={row.id}>
                        <td style={{ padding: '8px 12px', borderBottom: '1px solid #F0F0F0', fontSize: 11, fontWeight: 600 }}>
                          {row.nom}
                          {row.responsable && <div style={{ fontSize: 10, color: '#999', fontWeight: 400 }}>{row.responsable}</div>}
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>{ch?.titre || '—'}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11 }}>
                          <span style={{
                            display: 'inline-block', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                            background: row.statut === 'en_cours' ? '#E3F2FD' : row.statut === 'terminé' ? '#F5F5F5' : row.statut === 'en_retard' ? '#FFEBEE' : '#F3E5F5',
                            color: row.statut === 'en_cours' ? '#1565C0' : row.statut === 'terminé' ? '#757575' : row.statut === 'en_retard' ? '#C62828' : '#7B1FA2',
                          }}>{statLabels[row.statut] || row.statut}</span>
                        </td>
                        <td style={{ padding: 8, borderBottom: '1px solid #F0F0F0', fontSize: 11, minWidth: 160 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 6, borderRadius: 3, background: '#E8E8E8' }}>
                              <div style={{ width: `${row.avancement}%`, height: '100%', borderRadius: 3, background: statusColor(row.statut) }} />
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, minWidth: 28 }}>{row.avancement}%</span>
                          </div>
                          <input type="range" min="0" max="100" value={row.avancement}
                            onChange={e => updateAvancement(row.id, Number(e.target.value))}
                            style={{ width: '100%', accentColor: '#FFC107', height: 4, marginTop: 4 }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }}>
            {(['planifié', 'en_cours', 'terminé', 'en_retard'] as const).map(s => (
              <div key={s} style={{ border: '1px solid #E8E8E8', borderRadius: 6, background: '#fff', padding: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#999', marginBottom: 4 }}>{statLabels[s]}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: statusColor(s) }}>{rows.filter(r => r.statut === s).length}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
