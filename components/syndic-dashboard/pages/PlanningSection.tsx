'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanningEvent, Immeuble } from '../types'
import { getRoleLabel } from '../types'
import { EVENT_COLORS } from '../config'
import type { User } from '@supabase/supabase-js'

interface TeamMember {
  id: string
  full_name: string
  role: string
}

interface PlanningSectionProps {
  planningEvents: PlanningEvent[]
  setPlanningEvents: React.Dispatch<React.SetStateAction<PlanningEvent[]>>
  teamMembers: TeamMember[]
  locale: string
  t: (key: string) => string
  user: User
  immeubles: Immeuble[]
  userRole: string
  getAdminToken: () => Promise<string>
  // Le modal de création d'événement est rendu par le dashboard parent (page.tsx).
  // `heure` (optionnel) permet de pré-remplir le créneau cliqué dans la vue semaine.
  onOpenPlanningModal: (dateStr: string, heure?: string) => void
}

type Granularity = '60' | '30'

interface EventLayout {
  event: PlanningEvent
  col: number
  totalCols: number
}

const HOUR_START = 7
const HOUR_END = 22
const HOURS_COUNT = HOUR_END - HOUR_START
const PX_PER_HOUR = 48
const PREFS_KEY = 'vitfix.syndic.planning.prefs'
const NOW_TICK_MS = 60_000

function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = x.getDay()
  const diff = day === 0 ? -6 : 1 - day
  x.setDate(x.getDate() + diff)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function heureToMinutes(heure: string): number {
  const [hhRaw, mmRaw] = heure.split(':')
  return (Number(hhRaw) || 0) * 60 + (Number(mmRaw) || 0)
}

function minutesToTopPx(min: number): number {
  return (min - HOUR_START * 60) / 60 * PX_PER_HOUR
}

function topPxForHeure(heure: string): number {
  return minutesToTopPx(heureToMinutes(heure))
}

function heightPxForDuree(dureeMin: number): number {
  return Math.max(22, (dureeMin / 60) * PX_PER_HOUR)
}

// Column-packing : groupe les événements qui se chevauchent (par fermeture
// transitive de l'overlap), puis les distribue en colonnes côte-à-côte.
// Tous les événements d'un même cluster partagent le même `totalCols`.
function layoutEvents(events: PlanningEvent[]): EventLayout[] {
  if (events.length === 0) return []

  const sorted = [...events].sort((a, b) => {
    const sa = heureToMinutes(a.heure)
    const sb = heureToMinutes(b.heure)
    if (sa !== sb) return sa - sb
    return b.dureeMin - a.dureeMin
  })

  type Cluster = { events: PlanningEvent[]; maxEnd: number }
  const clusters: Cluster[] = []
  for (const evt of sorted) {
    const start = heureToMinutes(evt.heure)
    const end = start + evt.dureeMin
    const last = clusters[clusters.length - 1]
    if (last && start < last.maxEnd) {
      last.events.push(evt)
      last.maxEnd = Math.max(last.maxEnd, end)
    } else {
      clusters.push({ events: [evt], maxEnd: end })
    }
  }

  const result: EventLayout[] = []
  for (const cluster of clusters) {
    const cols: PlanningEvent[][] = []
    for (const evt of cluster.events) {
      const start = heureToMinutes(evt.heure)
      let colIdx = -1
      for (let i = 0; i < cols.length; i++) {
        const last = cols[i][cols[i].length - 1]
        const lastEnd = heureToMinutes(last.heure) + last.dureeMin
        if (start >= lastEnd) {
          colIdx = i
          break
        }
      }
      if (colIdx === -1) {
        colIdx = cols.length
        cols.push([])
      }
      cols[colIdx].push(evt)
    }
    const totalCols = cols.length
    for (let i = 0; i < cols.length; i++) {
      for (const evt of cols[i]) {
        result.push({ event: evt, col: i, totalCols })
      }
    }
  }
  return result
}

export default function PlanningSection({
  planningEvents,
  setPlanningEvents,
  teamMembers,
  locale,
  t,
  user,
  userRole,
  getAdminToken,
  onOpenPlanningModal,
}: PlanningSectionProps) {
  const [planningDate, setPlanningDate] = useState(new Date())
  const [deleting, setDeleting] = useState<string | null>(null)
  const [planningViewFilter, setPlanningViewFilter] = useState('tous')
  const [showSettings, setShowSettings] = useState(false)
  const [granularity, setGranularity] = useState<Granularity>('60')
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  const gridScrollRef = useRef<HTMLDivElement | null>(null)
  const hasAutoScrolled = useRef(false)

  // Préfs utilisateur : chargement
  useEffect(() => {
    if (!user?.id) return
    try {
      const raw = localStorage.getItem(`${PREFS_KEY}.${user.id}`)
      if (!raw) return
      const obj = JSON.parse(raw) as { granularity?: Granularity }
      if (obj.granularity === '30' || obj.granularity === '60') {
        setGranularity(obj.granularity)
      }
    } catch {}
  }, [user?.id])

  // Préfs utilisateur : sauvegarde
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`${PREFS_KEY}.${user.id}`, JSON.stringify({ granularity }))
    } catch {}
  }, [granularity, user?.id])

  // Indicateur d'heure actuelle : tick chaque minute
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    const id = setInterval(tick, NOW_TICK_MS)
    return () => clearInterval(id)
  }, [])

  const canAssign = userRole === 'syndic_secretaire' || userRole === 'syndic' || userRole === 'syndic_admin'

  const { weekDays, todayStr, isCurrentWeek, weekLabel } = useMemo(() => {
    const start = startOfWeekMonday(planningDate)
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
    const end = days[6]
    const today = new Date()
    const todayS = fmtDate(today)
    const startS = fmtDate(start)
    const endS = fmtDate(end)
    const fmt = (d: Date) =>
      d.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' })
    return {
      weekDays: days,
      todayStr: todayS,
      isCurrentWeek: todayS >= startS && todayS <= endS,
      weekLabel: `${fmt(start)} – ${fmt(end)}`,
    }
  }, [planningDate, locale])

  const filteredEvents = useMemo(
    () =>
      planningViewFilter === 'tous'
        ? planningEvents
        : planningEvents.filter(
            e => e.assigneA === planningViewFilter || e.creePar === planningViewFilter,
          ),
    [planningEvents, planningViewFilter],
  )

  // Layout côte-à-côte des événements de chaque jour
  const layoutsByDay = useMemo(() => {
    const map = new Map<string, EventLayout[]>()
    for (const d of weekDays) {
      const dateStr = fmtDate(d)
      const dayEvents = filteredEvents.filter(e => e.date === dateStr)
      map.set(dateStr, layoutEvents(dayEvents))
    }
    return map
  }, [weekDays, filteredEvents])

  const slotsPerHour = granularity === '30' ? 2 : 1
  const slotMinutes = 60 / slotsPerHour
  const slotHeight = PX_PER_HOUR / slotsPerHour
  const totalSlots = HOURS_COUNT * slotsPerHour
  const bodyHeight = HOURS_COUNT * PX_PER_HOUR

  const slotIndexToHeure = (i: number): string => {
    const totalMinutes = HOUR_START * 60 + i * slotMinutes
    const hh = Math.floor(totalMinutes / 60)
    const mm = totalMinutes % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  // Auto-scroll horizontal au montage si la vue semaine est sur la semaine
  // actuelle : amène la colonne du jour au centre sur petits écrans.
  useEffect(() => {
    if (hasAutoScrolled.current) return
    if (!isCurrentWeek) return
    const el = gridScrollRef.current
    if (!el) return
    // Trouve l'index du jour courant (0 = Lun, 6 = Dim)
    const todayDay = new Date().getDay()
    const idx = todayDay === 0 ? 6 : todayDay - 1
    // Largeur visible / 7 colonnes pour calculer scrollLeft approximatif
    const totalWidth = el.scrollWidth
    const dayColWidth = (totalWidth - 56) / 7 // 56 = largeur col heures
    const target = idx * dayColWidth - el.clientWidth / 2 + dayColWidth / 2 + 56
    el.scrollTo({ left: Math.max(0, target), behavior: 'auto' })
    hasAutoScrolled.current = true
  }, [isCurrentWeek])

  const handleDeletePlanningEvent = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar este evento do planeamento?' : 'Supprimer cet événement du planning ?')) return
    setDeleting(id)
    setPlanningEvents(prev => prev.filter(e => e.id !== id))
    try {
      const token = await getAdminToken()
      if (token) {
        await fetch(`/api/syndic/planning-events?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      }
    } catch {}
    finally { setDeleting(null) }
  }

  const dayShort = locale === 'pt'
    ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  const nowTopPx = minutesToTopPx(nowMinutes)
  const nowInRange = nowTopPx >= 0 && nowTopPx <= bodyHeight

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">
              {locale === 'pt' ? 'Planeamento' : 'Planning'} — {weekLabel}
            </h2>
            <button
              onClick={() => onOpenPlanningModal(todayStr)}
              className="flex items-center gap-1 text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1.5 rounded-lg transition font-medium"
            >
              + {locale === 'pt' ? 'Adicionar' : 'Ajouter'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canAssign && (
              <select
                value={planningViewFilter}
                onChange={e => setPlanningViewFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#C9A84C] bg-white"
              >
                <option value="tous">👥 {locale === 'pt' ? 'Toda a equipa' : 'Toute l\'équipe'}</option>
                {teamMembers.map(m => (
                  <option key={m.id} value={m.full_name}>{m.full_name}{m.role ? ` — ${getRoleLabel(m.role, locale)}` : ''}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setPlanningDate(d => addDays(startOfWeekMonday(d), -7))}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              aria-label={locale === 'pt' ? 'Semana anterior' : 'Semaine précédente'}
            >
              ←
            </button>
            <button
              onClick={() => setPlanningDate(new Date())}
              className={`text-sm px-3 py-1.5 rounded-lg transition ${isCurrentWeek ? 'border border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C] hover:bg-[#F7F4EE]' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}
            >
              {locale === 'pt' ? 'Hoje' : 'Aujourd\'hui'}
            </button>
            <button
              onClick={() => setPlanningDate(d => addDays(startOfWeekMonday(d), 7))}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              aria-label={locale === 'pt' ? 'Semana seguinte' : 'Semaine suivante'}
            >
              →
            </button>
            <button
              onClick={() => setShowSettings(s => !s)}
              className={`text-sm px-3 py-1.5 border rounded-lg transition ${showSettings ? 'border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C]' : 'border-gray-200 hover:bg-gray-50 text-gray-700'}`}
              title={locale === 'pt' ? 'Definições' : 'Paramètres'}
              aria-label={locale === 'pt' ? 'Definições' : 'Paramètres'}
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Panneau Paramètres */}
        {showSettings && (
          <div className="bg-[#F7F4EE] border border-[#C9A84C]/30 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-gray-900 mb-3">
              ⚙️ {locale === 'pt' ? 'Definições do agenda' : 'Paramètres de l\'agenda'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-gray-700 font-medium">
                {locale === 'pt' ? 'Granularidade' : 'Granularité'}
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setGranularity('60')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${granularity === '60' ? 'bg-[#0D1B2E] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  1 {locale === 'pt' ? 'hora' : 'heure'}
                </button>
                <button
                  onClick={() => setGranularity('30')}
                  className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${granularity === '30' ? 'bg-[#0D1B2E] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                >
                  30 min
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Légende types */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(locale === 'pt'
            ? { reunion: 'Reunião', visite: 'Visita', rdv: 'Reunião', tache: 'Tarefa', autre: 'Outro' }
            : { reunion: 'Réunion', visite: 'Visite', rdv: 'RDV', tache: 'Tâche', autre: 'Autre' }
          ).map(([k, v]) => (
            <span key={k} className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[k].bg} ${EVENT_COLORS[k].text}`}>{v}</span>
          ))}
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#F7F4EE] text-[#C9A84C]">🔧 {locale === 'pt' ? 'Missão artesão' : 'Mission artisan'}</span>
        </div>

        {/* Wrapper scroll horizontal pour mobile */}
        <div
          ref={gridScrollRef}
          className="border border-gray-200 rounded-xl overflow-x-auto bg-white"
        >
          <div className="min-w-[768px]">
            {/* Ligne des jours */}
            <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-gray-50 border-b border-gray-200">
              <div className="border-r border-gray-200" />
              {weekDays.map((d, i) => {
                const isToday = fmtDate(d) === todayStr
                return (
                  <div
                    key={i}
                    className={`text-center py-2 border-r border-gray-200 last:border-r-0 ${isToday ? 'bg-[#F7F4EE]' : ''}`}
                  >
                    <p className="text-[10px] uppercase tracking-wide font-medium text-gray-500">{dayShort[i]}</p>
                    <p className={`text-base font-bold leading-tight ${isToday ? 'text-[#C9A84C]' : 'text-gray-900'}`}>
                      {d.getDate()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Corps : col heures + 7 col jours */}
            <div
              className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] relative"
              style={{ height: bodyHeight }}
            >
              {/* Colonne heures */}
              <div className="border-r border-gray-200 relative bg-gray-50/40">
                {Array.from({ length: HOURS_COUNT }, (_, i) => HOUR_START + i).map(h => (
                  <div
                    key={h}
                    className="absolute right-1.5 text-[10px] text-gray-400 leading-none tabular-nums"
                    style={{ top: (h - HOUR_START) * PX_PER_HOUR + 3 }}
                  >
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
                {/* Pastille rouge "now" sur la col heures, alignée à droite */}
                {isCurrentWeek && nowInRange && (
                  <div
                    className="absolute right-0 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"
                    style={{ top: nowTopPx - 4, transform: 'translateX(50%)' }}
                    aria-hidden
                  />
                )}
              </div>

              {/* Colonnes jours */}
              {weekDays.map((d, dayIdx) => {
                const dateStr = fmtDate(d)
                const isToday = dateStr === todayStr
                const layouts = layoutsByDay.get(dateStr) || []
                return (
                  <div
                    key={dayIdx}
                    className={`border-r border-gray-200 last:border-r-0 relative overflow-hidden ${isToday ? 'bg-[#F7F4EE]/30' : ''}`}
                  >
                    {/* Slots cliquables (cible + grille) */}
                    {Array.from({ length: totalSlots }, (_, i) => {
                      const heure = slotIndexToHeure(i)
                      const isHourLine = i % slotsPerHour === 0
                      return (
                        <div
                          key={i}
                          onClick={() => onOpenPlanningModal(dateStr, heure)}
                          style={{ height: slotHeight }}
                          className={`hover:bg-[#F7F4EE]/60 cursor-pointer transition-colors ${i === 0 ? '' : isHourLine ? 'border-t border-gray-200' : 'border-t border-dashed border-gray-100'}`}
                        />
                      )
                    })}

                    {/* Ligne rouge "now" sur la colonne du jour courant */}
                    {isToday && nowInRange && (
                      <div
                        className="absolute left-0 right-0 pointer-events-none z-30"
                        style={{ top: nowTopPx - 1 }}
                        aria-hidden
                      >
                        <div className="h-0.5 bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
                      </div>
                    )}

                    {/* Événements du jour (layout côte-à-côte) */}
                    {layouts.map(({ event: e, col, totalCols }) => {
                      const color = EVENT_COLORS[e.type] || EVENT_COLORS.autre
                      return (
                        <div
                          key={e.id}
                          className={`absolute rounded-md px-1.5 py-0.5 text-[11px] overflow-hidden border ${color.bg} ${color.text} ${color.border} shadow-sm hover:shadow-md hover:z-20 transition-shadow cursor-default`}
                          style={{
                            top: topPxForHeure(e.heure),
                            height: heightPxForDuree(e.dureeMin),
                            left: `calc(2px + ${(col / totalCols) * 100}%)`,
                            width: `calc(${100 / totalCols}% - 4px)`,
                            zIndex: 10,
                          }}
                          title={`${e.heure} — ${e.titre}${e.assigneA ? ` (${e.assigneA})` : ''}`}
                        >
                          <div className="flex items-start justify-between gap-1 h-full">
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold truncate leading-tight">{e.titre}</p>
                              <p className="text-[10px] opacity-80 leading-tight tabular-nums">
                                {e.heure}{e.assigneA ? ` · ${e.assigneA}` : ''}
                              </p>
                            </div>
                            <button
                              onClick={ev => { ev.stopPropagation(); handleDeletePlanningEvent(e.id) }}
                              disabled={deleting === e.id}
                              className="flex-shrink-0 opacity-60 hover:opacity-100 font-bold text-xs leading-none disabled:cursor-default"
                              title={t('syndicDash.common.delete')}
                              aria-label={t('syndicDash.common.delete')}
                            >
                              {deleting === e.id ? '…' : '×'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
