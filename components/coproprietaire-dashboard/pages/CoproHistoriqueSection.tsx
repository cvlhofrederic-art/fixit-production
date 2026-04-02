'use client'

import React, { useState } from 'react'
import { formatPrice, formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ChargesMensuelles {
  id: string
  mois: string
  montant: number
  statut: 'payee' | 'en_attente' | 'en_retard'
  datePaiement?: string
  dateEcheance: string
}

interface HistoriqueEntry {
  id: string
  type: 'paiement' | 'vote' | 'document' | 'signalement' | 'message'
  titre: string
  description: string
  date: string
  montant?: number
}

interface CoproProfile {
  id: string
  nom: string
  prenom: string
  email: string
  telephone: string
  immeuble: string
  batiment: string
  etage: string
  numLot: string
  tantiemes: number
  quotePart: number
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  locale: string
  profile: CoproProfile
  charges: ChargesMensuelles[]
  historique: HistoriqueEntry[]
}

const HISTORIQUE_TYPE_EMOJI: Record<string, string> = {
  paiement: '💶',
  vote: '🗳️',
  document: '📄',
  signalement: '🔔',
  message: '💬',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproHistoriqueSection({ t, locale, profile, charges, historique }: Props) {
  const [histoFilter, setHistoFilter] = useState<string>('tous')
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'

  return (
    <div className="space-y-6">
      {/* Recap */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.tantiemes}</p>
          <p className="text-xl font-bold text-[#0D1B2E]">{profile.tantiemes}</p>
          <p className="text-xs text-[#C9A84C]">/ 10 000</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.quotePart}</p>
          <p className="text-xl font-bold text-[#0D1B2E]">{profile.quotePart}%</p>
          <p className="text-xs text-[#8A9BB0]">{t.desCharges}</p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.totalPaye2025}</p>
          <p className="text-xl font-bold text-green-600">
            {formatPrice(historique.filter(h => h.type === 'paiement' && h.date.startsWith('2025') && h.montant && h.montant > 0).reduce((s, h) => s + (h.montant || 0), 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.evenements}</p>
          <p className="text-xl font-bold text-[#0D1B2E]">{historique.length}</p>
          <p className="text-xs text-[#8A9BB0]">{t.enregistres}</p>
        </div>
      </div>

      {/* Graphique charges (CSS) */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm p-5">
        <h2 className="font-bold text-[#0D1B2E] mb-4">{t.evolutionCharges}</h2>
        <div className="flex items-end gap-2 h-40">
          {charges.sort((a, b) => a.mois.localeCompare(b.mois)).map(c => {
            const maxCharge = Math.max(...charges.map(ch => ch.montant))
            const height = maxCharge > 0 ? (c.montant / maxCharge) * 100 : 0
            return (
              <div key={c.id} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-[#8A9BB0] font-medium">{formatPrice(c.montant)}</span>
                <div
                  className={`w-full rounded-t-md transition-all ${c.statut === 'payee' ? 'bg-[#C9A84C]' : 'bg-[rgba(201,168,76,0.25)]'}`}
                  style={{ height: `${height}%`, minHeight: '4px' }}
                />
                <span className="text-xs text-[#8A9BB0]">{c.mois.slice(5)}/{c.mois.slice(2, 4)}</span>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-[#8A9BB0]">
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[#C9A84C] rounded" /> {t.chartPayee}</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 bg-[rgba(201,168,76,0.25)] rounded" /> {t.chartEnAttente}</span>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {['tous', 'paiement', 'vote', 'document', 'signalement', 'message'].map(f => (
          <button
            key={f}
            onClick={() => setHistoFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              histoFilter === f ? 'bg-[#0D1B2E] text-white' : 'bg-white text-[#4A5E78] border border-[#E4DDD0] hover:bg-[#F7F4EE]'
            }`}
          >
            {f === 'tous' ? 'Tous' : `${HISTORIQUE_TYPE_EMOJI[f] || ''} ${f.charAt(0).toUpperCase() + f.slice(1)}`}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm">
        <div className="divide-y divide-[#E4DDD0]">
          {(() => {
            const filtered = historique
              .filter(h => histoFilter === 'tous' || h.type === histoFilter)
              .sort((a, b) => b.date.localeCompare(a.date))
            let lastMonth = ''
            return filtered.map(h => {
              const month = new Date(h.date).toLocaleDateString(dateFmtLocale, { month: 'long', year: 'numeric' })
              const showHeader = month !== lastMonth
              lastMonth = month
              return (
                <React.Fragment key={h.id}>
                  {showHeader && (
                    <div className="px-5 py-2 bg-[#F7F4EE]">
                      <p className="text-xs font-bold text-[#8A9BB0] uppercase">{month}</p>
                    </div>
                  )}
                  <div className="px-5 py-3 flex items-start gap-3">
                    <span className="text-lg mt-0.5">{HISTORIQUE_TYPE_EMOJI[h.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0D1B2E]">{h.titre}</p>
                      <p className="text-xs text-[#8A9BB0]">{h.description}</p>
                      <p className="text-xs text-[#8A9BB0] mt-0.5">{formatDate(h.date)}</p>
                    </div>
                    {h.montant !== undefined && (
                      <span className={`text-sm font-bold ${h.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>
                        {h.montant < 0 ? '+' : '-'}{formatPrice(Math.abs(h.montant))}
                      </span>
                    )}
                  </div>
                </React.Fragment>
              )
            })
          })()}
        </div>
      </div>
    </div>
  )
}
