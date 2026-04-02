'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Mission, Artisan, Immeuble } from '@/components/syndic-dashboard/types'
import { PrioriteBadge, Badge } from '@/components/syndic-dashboard/types'

interface MissionsPageSectionProps {
  missions: Mission[]
  setMissions: React.Dispatch<React.SetStateAction<Mission[]>>
  artisans: Artisan[]
  immeubles: Immeuble[]
  locale: string
  t: (key: string) => string
  user: User | null
  setPage: (page: string) => void
  showModalMission: boolean
  setShowModalMission: (v: boolean) => void
  selectedMission: Mission | null
  setSelectedMission: (m: Mission | null) => void
  showMissionDetails: boolean
  setShowMissionDetails: (v: boolean) => void
}

export default function MissionsPageSection({
  missions,
  setMissions,
  artisans,
  immeubles,
  locale,
  t,
  user,
  setPage,
  showModalMission,
  setShowModalMission,
  selectedMission,
  setSelectedMission,
  showMissionDetails,
  setShowMissionDetails,
}: MissionsPageSectionProps) {
  const [missionsFilter, setMissionsFilter] = useState<'Toutes' | 'Urgentes' | 'En cours' | 'Terminées'>('Toutes')

  const getFilteredMissions = () => {
    switch (missionsFilter) {
      case 'Urgentes': return missions.filter(m => m.priorite === 'urgente')
      case 'En cours': return missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee')
      case 'Terminées': return missions.filter(m => m.statut === 'terminee')
      default: return missions
    }
  }

  const handleValiderMission = (id: string) => {
    setMissions(prev => prev.map(m => m.id === id ? { ...m, statut: 'acceptee' as const } : m))
  }

  const handleDeleteMission = async (id: string) => {
    if (!confirm(locale === 'pt' ? 'Eliminar esta missão definitivamente? Esta ação é irreversível.' : 'Supprimer cette mission définitivement ? Cette action est irréversible.')) return
    setMissions(prev => prev.filter(m => m.id !== id))
    try {
      const stored = JSON.parse(localStorage.getItem(`fixit_syndic_missions_${user?.id}`) || '[]')
      localStorage.setItem(`fixit_syndic_missions_${user?.id}`, JSON.stringify(stored.filter((m: Mission) => m.id !== id)))
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(['Toutes', 'Urgentes', 'En cours', 'Terminées'] as const).map(f => {
            const filterLabel = locale === 'pt'
              ? { 'Toutes': 'Todas', 'Urgentes': 'Urgentes', 'En cours': 'Em curso', 'Terminées': 'Concluídas' }[f]
              : f
            return (
            <button key={f} onClick={() => setMissionsFilter(f)} className={`text-sm px-3 py-1.5 rounded-lg border transition ${missionsFilter === f ? 'border-[#C9A84C] bg-[#F7F4EE] text-[#C9A84C] font-semibold' : 'border-gray-200 hover:border-[#C9A84C] hover:text-[#C9A84C]'}`}>
              {filterLabel}
              {f === 'Urgentes' && <span className="ml-1.5 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.priorite === 'urgente').length}</span>}
              {f === 'En cours' && <span className="ml-1.5 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{missions.filter(m => m.statut === 'en_cours' || m.statut === 'acceptee').length}</span>}
            </button>
            )
          })}
        </div>
        <button onClick={() => setShowModalMission(true)} className="bg-[#0D1B2E] hover:bg-[#152338] text-white px-4 py-2 rounded-lg text-sm font-semibold transition">
          + {locale === 'pt' ? 'Nova missão' : 'Nouvelle mission'}
        </button>
      </div>
      {getFilteredMissions().length === 0 && (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
          {locale === 'pt' ? 'Nenhuma missão para este filtro' : 'Aucune mission pour ce filtre'}
        </div>
      )}
      <div className="space-y-3">
        {getFilteredMissions().map(m => (
          <div key={m.id} className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100 hover:border-[#E4DDD0] transition">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <PrioriteBadge p={m.priorite} />
                  <Badge statut={m.statut} locale={locale} />
                  <span className="text-xs text-gray-500">#{m.id}</span>
                  {m.locataire && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">👤 {m.locataire}</span>}
                  {m.etage && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">🏢 {m.batiment ? `Bât. ${m.batiment} · ` : ''}Ét. {m.etage}</span>}
                </div>
                <h3 className="font-bold text-gray-900">{m.immeuble}</h3>
                <p className="text-sm text-gray-600">{m.type} · {m.description}</p>
                {m.numLot && <p className="text-xs text-gray-500 mt-0.5">Lot {m.numLot}</p>}
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                {m.montantDevis && <p className="text-sm font-semibold text-gray-900">{m.montantDevis.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</p>}
                {m.montantFacture && <p className="text-xs text-green-600">Facturé : {m.montantFacture.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €</p>}
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center gap-4">
                <span>🔧 {m.artisan}</span>
                {m.dateIntervention && <span>📅 {new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR')}</span>}
                {(m.canalMessages?.length || 0) > 0 && <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full">💬 {m.canalMessages!.length} msg</span>}
              </div>
              <div className="flex gap-2">
                {m.statut === 'en_attente' && (
                  <button onClick={() => handleValiderMission(m.id)} className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-lg hover:bg-green-200 transition font-medium">✅ Valider</button>
                )}
                {m.statut === 'terminee' && (
                  <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition font-medium">📄 Rapport</button>
                )}
                <button onClick={() => { setSelectedMission(m); setShowMissionDetails(true) }} className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-3 py-1 rounded-lg hover:bg-[#EDE8DF] transition font-medium">📋 Ouvrir</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteMission(m.id) }} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-lg hover:bg-red-200 transition font-medium" title={t('syndicDash.common.delete')} aria-label={t('syndicDash.common.delete')}>🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
