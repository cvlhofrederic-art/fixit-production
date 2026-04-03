'use client'

import { useState, useMemo } from 'react'
import type { Mission } from '../types'
import { Badge, StatCard } from '../types'
import { useTranslation, useLocale } from '@/lib/i18n/context'
import type { User } from '@supabase/supabase-js'

interface Transfert {
  id: string
  statut: string
  transferePar?: string
  destinataire?: string
  missionId?: string
  immeuble?: string
  type?: string
  artisan?: string
  locataire?: string
  batiment?: string
  etage?: string
  numLot?: string
  travailEffectue?: string
  note?: string
  montantFacture?: number
  montantDevis?: number
  dateTransfert: string
  raisonRefus?: string
}

export default function FacturationPageWithTransferts({ missions, user, userRole, onOpenMission }: {
  missions: Mission[]
  user: User
  userRole: string
  onOpenMission: (m: Mission) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const [activeSubTab, setActiveSubTab] = useState<'factures' | 'transferts'>('factures')
  const [filterStatut, setFilterStatut] = useState<string>('')

  // Charger tous les dossiers transférés (depuis tous les rôles tech/gestionnaire)
  const allTransferts = useMemo(() => {
    const keys = ['syndic_tech', 'syndic_gestionnaire', 'syndic', 'syndic_admin']
    const all: Transfert[] = []
    keys.forEach(k => {
      try {
        const items = JSON.parse(localStorage.getItem(`syndic_transferts_${k}`) || '[]')
        all.push(...items)
      } catch {}
    })
    return all.sort((a, b) => new Date(b.dateTransfert).getTime() - new Date(a.dateTransfert).getTime())
  }, [])

  const [transferts, setTransferts] = useState(allTransferts)

  const validerTransfert = (id: string) => {
    const updated = transferts.map(t => t.id === id ? { ...t, statut: 'validé' } : t)
    setTransferts(updated)
    // Re-save toutes les clés
    const byRole: Record<string, any[]> = {}
    updated.forEach(t => {
      const k = `syndic_transferts_${t.transferePar?.includes('Tech') ? 'syndic_tech' : 'syndic_gestionnaire'}`
      if (!byRole[k]) byRole[k] = []
      byRole[k].push(t)
    })
    Object.entries(byRole).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)))
  }

  const refuserTransfert = (id: string, raison: string) => {
    const updated = transferts.map(t => t.id === id ? { ...t, statut: 'refusé', raisonRefus: raison } : t)
    setTransferts(updated)
  }

  const destColors: Record<string, string> = {
    comptable: 'bg-blue-100 text-blue-700',
    valideur: 'bg-[#F7F4EE] text-[#C9A84C]',
    syndic: 'bg-green-100 text-green-700',
  }
  const destLabels: Record<string, string> = {
    comptable: '🧮 Comptabilité',
    valideur: '✅ Valideur',
    syndic: '🏛️ Syndic',
  }
  const statutColors: Record<string, string> = {
    en_attente_validation: 'bg-orange-100 text-orange-700',
    validé: 'bg-green-100 text-green-700',
    refusé: 'bg-red-100 text-red-700',
  }

  const filtered = filterStatut ? transferts.filter(t => t.statut === filterStatut) : transferts

  const totalDevis = missions.filter(m => m.montantDevis).reduce((s, m) => s + (m.montantDevis || 0), 0)
  const totalFacture = missions.filter(m => m.montantFacture).reduce((s, m) => s + (m.montantFacture || 0), 0)
  const enAttente = transferts.filter(t => t.statut === 'en_attente_validation').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard emoji="💶" label="Facturé (missions)" value={`${totalFacture.toLocaleString(dateFmtLocale)} €`} sub={`${missions.filter(m => m.montantFacture).length} factures`} color="green" />
        <StatCard emoji="📋" label="Devis en cours" value={`${totalDevis.toLocaleString(dateFmtLocale)} €`} sub={`${missions.filter(m => m.montantDevis && !m.montantFacture).length} devis`} color="blue" />
        <StatCard emoji="📤" label="Dossiers transférés" value={String(transferts.length)} sub={`${enAttente} en attente`} color="purple" />
        <StatCard emoji="✅" label="Validés comptabilité" value={String(transferts.filter(t => t.statut === 'validé').length)} color="green" />
      </div>

      {/* Sub tabs */}
      <div className="flex gap-1 bg-[#F7F4EE] rounded-xl p-1 w-fit">
        <button onClick={() => setActiveSubTab('factures')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'factures' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500'}`}>📄 Factures & Devis</button>
        <button onClick={() => setActiveSubTab('transferts')} className={`relative px-4 py-2 rounded-lg text-sm font-medium transition ${activeSubTab === 'transferts' ? 'bg-white shadow text-[#0D1B2E]' : 'text-gray-500'}`}>
          📤 Dossiers transférés
          {enAttente > 0 && <span className="absolute -top-1 -right-1 bg-[#C9A84C] text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">{enAttente}</span>}
        </button>
      </div>

      {/* FACTURES */}
      {activeSubTab === 'factures' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <h3 className="font-bold text-[#0D1B2E] mb-4">Factures & devis des missions</h3>
          <div className="space-y-2">
            {missions.filter(m => m.montantFacture || m.montantDevis).length === 0 ? (
              <div className="text-center py-8 text-gray-500">Aucune facture ni devis sur les missions</div>
            ) : missions.filter(m => m.montantFacture || m.montantDevis).map(m => (
              <div key={m.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl hover:bg-[#F7F4EE] transition cursor-pointer" onClick={() => onOpenMission(m)}>
                <div>
                  <p className="font-semibold text-[#0D1B2E] text-sm">{m.immeuble} — {m.type}</p>
                  <p className="text-xs text-gray-500">{m.artisan} · {m.locataire ? `👤 ${m.locataire}` : ''} {m.etage ? `· Ét. ${m.etage}` : ''}</p>
                  <p className="text-xs text-gray-500">{m.dateIntervention ? new Date(m.dateIntervention).toLocaleDateString(dateFmtLocale) : m.dateCreation}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-[#0D1B2E]">{(m.montantFacture || m.montantDevis)?.toLocaleString(dateFmtLocale)} €</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.montantFacture ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{m.montantFacture ? 'Facturé' : 'Devis'}</span>
                  {(m as any).transfertCompta && <span className="text-xs bg-[#F7F4EE] text-[#C9A84C] px-2 py-0.5 rounded-full">📤 Transféré</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRANSFERTS */}
      {activeSubTab === 'transferts' && (
        <div className="space-y-4">
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-600">Filtrer :</span>
            {[['', 'Tous'], ['en_attente_validation', '⏳ En attente'], ['validé', '✅ Validés'], ['refusé', '❌ Refusés']].map(([val, label]) => (
              <button key={val} onClick={() => setFilterStatut(val)} className={`px-3 py-1 rounded-full text-sm font-medium ${filterStatut === val ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-gray-600 hover:bg-gray-200'}`}>{label}</button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-2xl">
              <div className="text-4xl mb-2">📤</div>
              <p>Aucun dossier transféré pour l'instant</p>
              <p className="text-sm mt-1">Les gestionnaires techniques peuvent transférer des dossiers depuis les ordres de mission</p>
            </div>
          ) : filtered.map((t: Transfert) => (
            <div key={t.id} className={`bg-white rounded-2xl shadow-sm p-5 border-l-4 ${t.statut === 'en_attente_validation' ? 'border-orange-400' : t.statut === 'validé' ? 'border-green-400' : 'border-red-400'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statutColors[t.statut] || 'bg-[#F7F4EE] text-gray-700'}`}>{t.statut.replace('_', ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${(t.destinataire && destColors[t.destinataire]) || 'bg-[#F7F4EE] text-gray-700'}`}>{(t.destinataire && destLabels[t.destinataire]) || t.destinataire}</span>
                    <span className="text-xs text-gray-500">Mission #{t.missionId}</span>
                  </div>
                  <h3 className="font-bold text-[#0D1B2E]">{t.immeuble} — {t.type}</h3>
                  <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                    {t.artisan && <span>🔧 {t.artisan}</span>}
                    {t.locataire && <span>👤 {t.locataire}</span>}
                    {t.batiment && <span>🏢 Bât. {t.batiment}</span>}
                    {t.etage && <span>🏗️ Ét. {t.etage}</span>}
                    {t.numLot && <span>🔢 Lot {t.numLot}</span>}
                  </div>
                  {t.travailEffectue && <p className="text-xs text-gray-500 mt-1 italic">"{t.travailEffectue.slice(0, 80)}{t.travailEffectue.length > 80 ? '…' : ''}"</p>}
                  {t.note && <p className="text-xs bg-yellow-50 text-yellow-700 rounded px-2 py-1 mt-1">📝 Note : {t.note}</p>}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  {t.montantFacture && <p className="font-bold text-lg text-[#0D1B2E]">{t.montantFacture.toLocaleString(dateFmtLocale)} €</p>}
                  {t.montantDevis && !t.montantFacture && <p className="font-bold text-lg text-amber-700">Devis {t.montantDevis.toLocaleString(dateFmtLocale)} €</p>}
                  <p className="text-xs text-gray-500 mt-1">{new Date(t.dateTransfert).toLocaleDateString(dateFmtLocale)} {new Date(t.dateTransfert).toLocaleTimeString(dateFmtLocale, { hour: '2-digit', minute: '2-digit' })}</p>
                  <p className="text-xs text-gray-500">Par : {t.transferePar}</p>
                </div>
              </div>

              {t.statut === 'en_attente_validation' && (
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => validerTransfert(t.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-semibold transition"
                  >
                    ✅ Valider & intégrer en comptabilité
                  </button>
                  <button
                    onClick={() => {
                      const raison = window.prompt('Raison du refus ?') || 'Informations manquantes'
                      refuserTransfert(t.id, raison)
                    }}
                    className="px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition"
                  >
                    ❌ Refuser
                  </button>
                </div>
              )}

              {t.statut === 'validé' && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-sm text-green-600 font-medium">✅ Validé et intégré en comptabilité</span>
                </div>
              )}

              {t.statut === 'refusé' && (
                <div className="pt-3 border-t border-gray-100">
                  <span className="text-sm text-red-600">❌ Refusé : {t.raisonRefus}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
