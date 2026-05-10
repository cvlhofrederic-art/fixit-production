'use client'

import { useState, useMemo } from 'react'
import type { Mission, Artisan, Immeuble } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'

export default function ComptabiliteTechSection({
  missions,
  artisans,
  immeubles,
}: {
  missions: Mission[]
  artisans: Artisan[]
  immeubles: Immeuble[]
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isPt = locale === 'pt'
  const [filterArtisan, setFilterArtisan] = useState('')
  const [filterImmeuble, setFilterImmeuble] = useState('')
  const [filterStatut, setFilterStatut] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<'all' | '30' | '90' | '365'>('all')

  const now = new Date()

  const filteredMissions = missions.filter(m => {
    if (filterArtisan && m.artisan !== filterArtisan) return false
    if (filterImmeuble && m.immeuble !== filterImmeuble) return false
    if (filterStatut && m.statut !== filterStatut) return false
    if (filterPeriod !== 'all' && m.dateIntervention) {
      const days = parseInt(filterPeriod)
      const mDate = new Date(m.dateIntervention)
      const diffDays = (now.getTime() - mDate.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays > days) return false
    }
    return true
  })

  const totalMontant = filteredMissions.reduce((s, m) => s + (m.montantDevis || 0), 0)
  const terminees = filteredMissions.filter(m => m.statut === 'terminee').length
  const enCours = filteredMissions.filter(m => m.statut === 'en_cours').length

  // Regroupement par artisan
  const byArtisan = filteredMissions.reduce<Record<string, { count: number; montant: number; missions: Mission[] }>>(
    (acc, m) => {
      const key = m.artisan || (isPt ? 'Por atribuir' : 'Non assigné')
      if (!acc[key]) acc[key] = { count: 0, montant: 0, missions: [] }
      acc[key].count++
      acc[key].montant += m.montantDevis || 0
      acc[key].missions.push(m)
      return acc
    }, {}
  )

  // Regroupement par immeuble
  const byImmeuble = filteredMissions.reduce<Record<string, { count: number; montant: number }>>(
    (acc, m) => {
      const key = m.immeuble || (isPt ? 'Não definido' : 'Non défini')
      if (!acc[key]) acc[key] = { count: 0, montant: 0 }
      acc[key].count++
      acc[key].montant += m.montantDevis || 0
      return acc
    }, {}
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#0D1B2E]">📊 {isPt ? 'Contabilidade Técnica' : 'Comptabilité Technique'}</h1>
        <p className="text-sm text-gray-500 mt-1">{isPt ? 'Acompanhamento das intervenções por profissional, condomínio e período' : 'Suivi des interventions par artisan, copropriété et période'}</p>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{isPt ? 'Profissional' : 'Artisan'}</label>
            <select
              value={filterArtisan}
              onChange={e => setFilterArtisan(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            >
              <option value="">{isPt ? 'Todos os profissionais' : 'Tous les artisans'}</option>
              {artisans.map(a => <option key={a.id} value={a.nom}>{a.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{isPt ? 'Edifício' : 'Immeuble'}</label>
            <select
              value={filterImmeuble}
              onChange={e => setFilterImmeuble(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            >
              <option value="">{isPt ? 'Todos os edifícios' : 'Tous les immeubles'}</option>
              {immeubles.map(i => <option key={i.id} value={i.nom}>{i.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{isPt ? 'Estado' : 'Statut'}</label>
            <select
              value={filterStatut}
              onChange={e => setFilterStatut(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            >
              <option value="">{isPt ? 'Todos os estados' : 'Tous les statuts'}</option>
              <option value="en_attente">{isPt ? 'Em espera' : 'En attente'}</option>
              <option value="en_cours">{isPt ? 'Em curso' : 'En cours'}</option>
              <option value="terminee">{isPt ? 'Concluída' : 'Terminée'}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">{isPt ? 'Período' : 'Période'}</label>
            <select
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value as typeof filterPeriod)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
            >
              <option value="all">{isPt ? 'Todo o período' : 'Toute la période'}</option>
              <option value="30">{isPt ? '30 últimos dias' : '30 derniers jours'}</option>
              <option value="90">{isPt ? '90 últimos dias' : '90 derniers jours'}</option>
              <option value="365">{isPt ? '12 últimos meses' : '12 derniers mois'}</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isPt ? 'Intervenções' : 'Interventions', value: filteredMissions.length, icon: '📋', color: 'bg-blue-50 border-blue-100' },
          { label: isPt ? 'Concluídas'   : 'Terminées',     value: terminees, icon: '✅', color: 'bg-green-50 border-green-100' },
          { label: isPt ? 'Em curso'     : 'En cours',      value: enCours, icon: '⚙️', color: 'bg-yellow-50 border-yellow-100' },
          { label: isPt ? 'Montante total' : 'Montant total', value: `${totalMontant.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')} €`, icon: '💶', color: 'bg-[#F7F4EE] border-[#E4DDD0]' },
        ].map(kpi => (
          <div key={kpi.label} className={`${kpi.color} border rounded-2xl p-4`}>
            <div className="text-2xl mb-1">{kpi.icon}</div>
            <div className="text-xl font-bold text-[#0D1B2E]">{kpi.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Répartition par artisan */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D1B2E] mb-4">{isPt ? 'Por profissional' : 'Par artisan'}</h3>
        {Object.keys(byArtisan).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">{isPt ? 'Nenhuma intervenção para os filtros selecionados' : 'Aucune intervention pour les filtres sélectionnés'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F4EE]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Profissional' : 'Artisan'}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Missões' : 'Missions'}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Montante' : 'Montant'}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{isPt ? 'Méd./missão' : 'Moy./mission'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(byArtisan).sort((a, b) => b[1].montant - a[1].montant).map(([name, stats]) => (
                  <tr key={name} className="hover:bg-[#F7F4EE] transition">
                    <td className="px-4 py-3 font-medium text-[#0D1B2E]">{name}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{stats.count}</td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0D1B2E]">{stats.montant.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')} €</td>
                    <td className="px-4 py-3 text-right text-gray-500">{stats.count > 0 ? Math.round(stats.montant / stats.count).toLocaleString(isPt ? 'pt-PT' : 'fr-FR') : 0} €</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr className="bg-[#F7F4EE]">
                  <td className="px-4 py-3 font-bold text-[#0D1B2E]">TOTAL</td>
                  <td className="px-4 py-3 text-center font-bold">{filteredMissions.length}</td>
                  <td className="px-4 py-3 text-right font-bold text-[#C9A84C]">{totalMontant.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')} €</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Répartition par immeuble */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D1B2E] mb-4">{isPt ? 'Por edifício / condomínio' : 'Par immeuble / copropriété'}</h3>
        {Object.keys(byImmeuble).length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">{isPt ? 'Sem dados' : 'Aucune données'}</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byImmeuble).sort((a, b) => b[1].montant - a[1].montant).map(([imm, stats]) => {
              const pct = totalMontant > 0 ? Math.round(stats.montant / totalMontant * 100) : 0
              return (
                <div key={imm} className="flex items-center gap-4">
                  <div className="w-40 flex-shrink-0">
                    <p className="text-sm font-medium text-[#0D1B2E] truncate">{imm}</p>
                    <p className="text-xs text-gray-500">{stats.count} {isPt ? `missã${stats.count > 1 ? 'ões' : 'o'}` : `mission${stats.count > 1 ? 's' : ''}`}</p>
                  </div>
                  <div className="flex-1 bg-[#F7F4EE] rounded-full h-2">
                    <div
                      className="bg-[#F7F4EE]0 h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-sm font-semibold text-[#0D1B2E] w-28 text-right">
                    {stats.montant.toLocaleString(isPt ? 'pt-PT' : 'fr-FR')} €
                  </div>
                  <div className="text-xs text-gray-500 w-10 text-right">{pct}%</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Liste détaillée */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-[#0D1B2E] mb-4">{isPt ? 'Detalhe das intervenções' : 'Détail des interventions'} ({filteredMissions.length})</h3>
        {filteredMissions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">{isPt ? 'Nenhuma intervenção' : 'Aucune intervention'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F4EE]">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Data' : 'Date'}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Edifício' : 'Immeuble'}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Tipo' : 'Type'}</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Profissional' : 'Artisan'}</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Prioridade' : 'Priorité'}</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Estado' : 'Statut'}</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{isPt ? 'Montante' : 'Montant'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMissions.map(m => (
                  <tr key={m.id} className="hover:bg-[#F7F4EE] transition">
                    <td className="px-3 py-3 text-gray-500 whitespace-nowrap">
                      {m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString(locale === 'pt' ? 'pt-PT' : 'fr-FR') : '—'}
                    </td>
                    <td className="px-3 py-3 font-medium text-[#0D1B2E]">{m.immeuble}</td>
                    <td className="px-3 py-3 text-gray-600">{m.type}</td>
                    <td className="px-3 py-3 text-gray-600">{m.artisan || '—'}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.priorite === 'urgente' ? 'bg-red-100 text-red-700' :
                        m.priorite === 'planifiee' ? 'bg-blue-100 text-blue-700' :
                        'bg-[#F7F4EE] text-gray-600'
                      }`}>{m.priorite}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.statut === 'terminee' ? 'bg-green-100 text-green-700' :
                        m.statut === 'en_cours' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{m.statut.replace('_', ' ')}</span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-[#0D1B2E]">
                      {m.montantDevis ? `${m.montantDevis.toLocaleString(locale === 'pt' ? 'pt-PT' : 'fr-FR')} €` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
