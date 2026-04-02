'use client'

import React, { useState } from 'react'
import { toast } from 'sonner'
import { formatPrice, formatDate } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Paiement {
  id: string
  type: 'charges_trimestrielles' | 'appel_fonds' | 'travaux' | 'regularisation'
  description: string
  montant: number
  dateEcheance: string
  datePaiement?: string
  statut: 'payee' | 'en_attente' | 'en_retard'
  trimestre?: string
  reference: string
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  t: Record<string, string>
  locale: string
  paiements: Paiement[]
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CoproPaiementsSection({ t, locale, paiements }: Props) {
  const [paiementTab, setPaiementTab] = useState<'en_attente' | 'payee'>('en_attente')

  return (
    <div className="space-y-6">
      {/* Resume */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.totalPaye}</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatPrice(paiements.filter(p => p.statut === 'payee' && p.datePaiement?.startsWith('2026')).reduce((s, p) => s + p.montant, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.enAttente}</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">
            {formatPrice(paiements.filter(p => p.statut === 'en_attente').reduce((s, p) => s + p.montant, 0))}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <p className="text-xs text-[#8A9BB0] font-medium">{t.enRetard}</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatPrice(paiements.filter(p => p.statut === 'en_retard').reduce((s, p) => s + p.montant, 0))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setPaiementTab('en_attente')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${paiementTab === 'en_attente' ? 'bg-[#0D1B2E] text-white' : 'bg-white text-[#4A5E78] border border-[#E4DDD0] hover:bg-[#F7F4EE]'}`}
        >
          {t.aPayer} ({paiements.filter(p => p.statut !== 'payee').length})
        </button>
        <button
          onClick={() => setPaiementTab('payee')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${paiementTab === 'payee' ? 'bg-[#0D1B2E] text-white' : 'bg-white text-[#4A5E78] border border-[#E4DDD0] hover:bg-[#F7F4EE]'}`}
        >
          {t.historiquePaiements} ({paiements.filter(p => p.statut === 'payee').length})
        </button>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-xl border border-[#E4DDD0] shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-[#F7F4EE] border-b border-[#E4DDD0]">
            <tr>
              <th className="text-left text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.reference}</th>
              <th className="text-left text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.description}</th>
              <th className="text-right text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.montant}</th>
              <th className="text-left text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.echeance}</th>
              <th className="text-left text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.statut}</th>
              <th className="text-right text-xs font-medium text-[#8A9BB0] px-5 py-3">{t.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4DDD0]">
            {paiements
              .filter(p => paiementTab === 'payee' ? p.statut === 'payee' : p.statut !== 'payee')
              .sort((a, b) => b.dateEcheance.localeCompare(a.dateEcheance))
              .map(p => (
                <tr key={p.id} className="hover:bg-[#F7F4EE] transition">
                  <td className="px-5 py-3 text-xs font-mono text-[#8A9BB0]">{p.reference}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-[#0D1B2E]">{p.description}</p>
                    <p className="text-xs text-[#8A9BB0] capitalize">{p.type.replace(/_/g, ' ')}</p>
                  </td>
                  <td className={`px-5 py-3 text-right text-sm font-bold ${p.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>
                    {formatPrice(p.montant)}
                  </td>
                  <td className="px-5 py-3 text-sm text-[#4A5E78]">{formatDate(p.dateEcheance)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      p.statut === 'payee' ? 'bg-green-100 text-green-700' :
                      p.statut === 'en_retard' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {p.statut === 'payee' ? t.statutPaye : p.statut === 'en_retard' ? t.statutEnRetard : t.statutEnAttente}
                    </span>
                    {p.datePaiement && <p className="text-xs text-[#8A9BB0] mt-1">le {formatDate(p.datePaiement)}</p>}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {p.statut === 'payee' && (
                      <button
                        onClick={() => toast.info(locale === 'pt' ? `A descarregar o recibo ${p.reference}...` : `Téléchargement du reçu ${p.reference}...`)}
                        className="text-xs text-[#C9A84C] hover:text-[#A8842A] font-medium"
                      >
                        {t.recu}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
