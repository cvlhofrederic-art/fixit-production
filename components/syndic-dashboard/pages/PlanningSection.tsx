'use client'

import { useState } from 'react'
import type { PlanningEvent } from '../types'
import { getRoleLabel } from '../types'
import { EVENT_COLORS } from '../config'

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
  user: any
  immeubles: any[]
  userRole: string
  getAdminToken: () => Promise<string>
}

export default function PlanningSection({
  planningEvents,
  setPlanningEvents,
  teamMembers,
  locale,
  t,
  user,
  immeubles,
  userRole,
  getAdminToken,
}: PlanningSectionProps) {
  // ── Internal state (only used by planning) ──
  const [planningDate, setPlanningDate] = useState(new Date())
  const [showPlanningModal, setShowPlanningModal] = useState(false)
  const [selectedPlanningDay, setSelectedPlanningDay] = useState<string | null>(null)
  const [planningViewFilter, setPlanningViewFilter] = useState('tous')
  const [planningNeedsMigration, setPlanningNeedsMigration] = useState(false)
  const [planningEventForm, setPlanningEventForm] = useState({
    titre: '',
    type: 'visite' as PlanningEvent['type'],
    heure: '09:00',
    dureeMin: 60,
    assigneA: '',
    description: '',
  })

  // ── Derived values ──
  const planningYear = planningDate.getFullYear()
  const planningMonth = planningDate.getMonth()
  const planningMonthLabel = planningDate.toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { month: 'long', year: 'numeric' })
  const planningDaysInMonth = new Date(planningYear, planningMonth + 1, 0).getDate()
  const planningFirstDay = new Date(planningYear, planningMonth, 1).getDay() // 0=dim
  const planningOffset = planningFirstDay === 0 ? 6 : planningFirstDay - 1 // lundi=0
  const todayDay = new Date().getDate()
  const isCurrentMonth = planningYear === new Date().getFullYear() && planningMonth === new Date().getMonth()

  const canAssign = userRole === 'syndic_secretaire' || userRole === 'syndic' || userRole === 'syndic_admin'
  const filteredEvents = planningViewFilter === 'tous'
    ? planningEvents
    : planningEvents.filter(e => e.assigneA === planningViewFilter || e.creePar === planningViewFilter)
  const monthEvents = filteredEvents.filter(e => {
    const d = new Date(e.date + 'T00:00:00')
    return d.getFullYear() === planningYear && d.getMonth() === planningMonth
  })

  // ── Handlers ──
  const handleDeletePlanningEvent = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar este evento do planeamento?' : 'Supprimer cet événement du planning ?')) return
    setPlanningEvents(prev => prev.filter(e => e.id !== id))
    // Supprimer en DB aussi
    try {
      const token = await getAdminToken()
      if (token) {
        await fetch(`/api/syndic/planning-events?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        })
      }
    } catch {}
  }

  return (
    <div className="space-y-4">
      {/* Banner migration DB si table pas encore créée */}
      {planningNeedsMigration && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800 text-sm">{t('syndicDash.planning.migrationRequired')}</p>
            <p className="text-xs text-amber-700 mt-1">{t('syndicDash.planning.migrationDesc')} <a href="https://supabase.com/dashboard" target="_blank" className="underline font-medium">Supabase SQL Editor</a> :</p>
            <pre className="mt-2 bg-amber-100 text-amber-900 text-xs rounded-lg p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS syndic_planning_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cabinet_id UUID NOT NULL,
  titre TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'autre',
  date DATE NOT NULL,
  heure TEXT NOT NULL DEFAULT '09:00',
  duree_min INTEGER DEFAULT 60,
  assigne_a TEXT NOT NULL DEFAULT '',
  assigne_role TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cree_par TEXT NOT NULL DEFAULT '',
  statut TEXT DEFAULT 'planifie',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_planning_events_cabinet ON syndic_planning_events(cabinet_id);`}</pre>
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900 capitalize">Planning — {planningMonthLabel}</h2>
            <button
              onClick={() => { setSelectedPlanningDay(new Date().toISOString().slice(0,10)); setShowPlanningModal(true) }}
              className="flex items-center gap-1 text-xs bg-[#0D1B2E] hover:bg-[#152338] text-white px-3 py-1.5 rounded-lg transition font-medium"
            >
              + Ajouter
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Filtre employé — visible secrétaire/admin */}
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
            <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">←</button>
            <button onClick={() => setPlanningDate(new Date())} className={`text-sm px-3 py-1.5 rounded-lg transition ${isCurrentMonth ? 'border border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C] hover:bg-[#F7F4EE]' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>{locale === 'pt' ? 'Hoje' : 'Aujourd\'hui'}</button>
            <button onClick={() => setPlanningDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition">→</button>
          </div>
        </div>

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

        {/* Grille calendrier */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {(locale === 'pt' ? ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] : ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']).map(d => (
            <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: planningOffset }, (_, i) => (
            <div key={`empty-${i}`} className="min-h-20 p-1 rounded-lg" />
          ))}
          {Array.from({ length: planningDaysInMonth }, (_, i) => i + 1).map(day => {
            const dateStr = `${planningYear}-${String(planningMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayEvents = filteredEvents.filter(e => e.date === dateStr)
            const isToday = isCurrentMonth && day === todayDay
            const total = dayEvents.length // missions artisans exclues du planning
            return (
              <div
                key={day}
                onClick={() => { setSelectedPlanningDay(dateStr); setPlanningEventForm(f => ({ ...f, heure: '09:00' })); setShowPlanningModal(true) }}
                className={`min-h-20 p-1 rounded-lg border text-xs cursor-pointer transition group relative ${isToday ? 'border-[#C9A84C] bg-[#F7F4EE]' : 'border-gray-100 hover:border-[#C9A84C] hover:bg-[#F7F4EE]/40'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-semibold text-xs ${isToday ? 'text-[#C9A84C]' : 'text-gray-700'}`}>{day}</span>
                  {total > 0 && <span className="text-gray-500 text-xs">{total}</span>}
                </div>
                {/* Events */}
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className={`text-xs px-1 py-0.5 rounded mb-0.5 flex items-center gap-0.5 font-medium ${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`} title={`${e.heure} — ${e.titre} (${e.assigneA})`}>
                    <span className="truncate flex-1">{e.heure} {e.titre}</span>
                    <button onClick={ev => { ev.stopPropagation(); handleDeletePlanningEvent(e.id) }} className="flex-shrink-0 opacity-60 hover:opacity-100 font-bold leading-none text-xs" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>×</button>
                  </div>
                ))}
                {/* Missions artisans volontairement exclues du planning (agenda secrétaire) */}
                {total > 2 && <div className="text-gray-500 text-xs">+{total - 2}</div>}
                {/* "+" hint on hover */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition pointer-events-none">
                  <span className="text-[#C9A84C] text-lg font-light">+</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste mensuelle */}
      <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-3">📋 Agenda du mois — {planningMonthLabel}</h3>
        {monthEvents.length === 0 && (
          <p className="text-sm text-gray-500 py-6 text-center border-2 border-dashed border-gray-200 rounded-xl">Aucun événement ce mois</p>
        )}
        <div className="space-y-2">
          {[
            ...monthEvents.map(e => ({ key: `e-${e.id}`, date: e.date, heure: e.heure, label: e.titre, sub: e.assigneA, color: `${EVENT_COLORS[e.type].bg} ${EVENT_COLORS[e.type].text}`, tag: e.type, statut: e.statut, onClick: () => {}, onDelete: () => handleDeletePlanningEvent(e.id) })),
          ].sort((a, b) => (a.date + a.heure).localeCompare(b.date + b.heure)).map(item => (
            <div key={item.key} onClick={item.onClick} className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-[#F7F4EE] rounded-xl text-sm cursor-pointer transition">
              <div className="text-center w-14 flex-shrink-0">
                <p className="font-bold text-[#C9A84C] text-xs">{new Date(item.date + 'T00:00:00').toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR', { day: '2-digit', month: 'short' })}</p>
                <p className="text-gray-500 text-xs">{item.heure}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${item.color}`}>{item.tag}</span>
              <span className="flex-1 font-medium truncate text-gray-800">{item.label}</span>
              <span className="text-gray-500 text-xs flex-shrink-0 hidden md:block">{item.sub}</span>
              <button onClick={ev => { ev.stopPropagation(); item.onDelete() }} className="flex-shrink-0 text-xs bg-red-100 text-red-500 hover:bg-red-200 px-2 py-0.5 rounded-lg transition font-medium" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>🗑️</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
