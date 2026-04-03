'use client'

import React, { useState } from 'react'
import { useLocale } from '@/lib/i18n/context'
import { formatPrice } from '@/lib/utils'
import { type CoproProfile, type Paiement, type ChargesMensuelles, POSTES_CHARGES } from '@/lib/copro-demo-data'

interface Props {
  profile: CoproProfile
  paiements: Paiement[]
  charges: ChargesMensuelles[]
}

export default function CoproMesChargesSection({ profile, paiements, charges }: Props) {
  const locale = useLocale()
  const dateFmtLocale = locale === 'pt' ? 'pt-PT' : 'fr-FR'
  const L = locale === 'pt'

  const [anneeSelect, setAnneeSelect] = useState(2026)
  const [onglet, setOnglet] = useState<'dashboard' | 'postes' | 'calendrier'>('dashboard')

  const annees = [2026, 2025, 2024]
  const chargesAnnee = paiements.filter(p => new Date(p.dateEcheance).getFullYear() === anneeSelect)
  const totalPayeAnnee = chargesAnnee.filter(p => p.statut === 'payee').reduce((s, p) => s + Math.max(p.montant, 0), 0)
  const totalEnAttenteAnnee = chargesAnnee.filter(p => p.statut !== 'payee').reduce((s, p) => s + Math.max(p.montant, 0), 0)
  const totalBudgetAnnee = POSTES_CHARGES.reduce((s, p) => s + p.budget, 0)
  const totalReelAnnee = POSTES_CHARGES.reduce((s, p) => s + p.montantAnnuel, 0)

  const moisLabels = L ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] : ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const chargesParMois = moisLabels.map((m, idx) => {
    const moisStr = `${anneeSelect}-${String(idx + 1).padStart(2, '0')}`
    const c = charges.find(ch => ch.mois === moisStr)
    return { mois: m, montant: c?.montant || 0, statut: c?.statut || null }
  })
  const maxMontant = Math.max(...chargesParMois.map(m => m.montant), 1)

  return (
    <div className="space-y-6">
      {/* Header année */}
      <div className="flex items-center gap-3">
        <div className="text-sm font-medium text-[#4A5E78]">{L ? 'Ano :' : 'Année :'}</div>
        <div className="flex gap-1">
          {annees.map(a => (
            <button
              key={a}
              onClick={() => setAnneeSelect(a)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold transition ${anneeSelect === a ? 'bg-[#0D1B2E] text-white' : 'bg-[#F7F4EE] text-[#4A5E78] hover:bg-[#F7F4EE]'}`}
            >{a}</button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Total pago' : 'Total payé'} {anneeSelect}</div>
          <div className="text-2xl font-black text-green-600">{formatPrice(totalPayeAnnee)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Por pagar' : 'Reste à payer'}</div>
          <div className={`text-2xl font-black ${totalEnAttenteAnnee > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatPrice(totalEnAttenteAnnee)}</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Orçamento anual' : 'Budget annuel'}</div>
          <div className="text-2xl font-black text-[#0D1B2E]">{formatPrice(totalBudgetAnnee)}</div>
          <div className="text-xs text-[#8A9BB0] mt-1">{L ? 'Quota-parte' : 'Quote-part'} {profile.quotePart}%</div>
        </div>
        <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
          <div className="text-xs text-[#8A9BB0] font-medium mb-1">{L ? 'Realizado / Orçamento' : 'Réalisé / Budget'}</div>
          <div className={`text-2xl font-black ${totalReelAnnee > totalBudgetAnnee ? 'text-red-600' : 'text-green-600'}`}>
            {Math.round((totalReelAnnee / totalBudgetAnnee) * 100)}%
          </div>
          <div className="text-xs text-[#8A9BB0] mt-1">{formatPrice(totalReelAnnee)} {L ? 'real' : 'réel'}</div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-[#F7F4EE] rounded-xl p-1">
        {([['dashboard', '📊 Dashboard'], ['postes', L ? '📋 Rubricas' : '📋 Postes'], ['calendrier', L ? '📅 Calendário' : '📅 Calendrier']] as [typeof onglet, string][]).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setOnglet(v)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${onglet === v ? 'bg-white shadow text-[#A8842A]' : 'text-[#8A9BB0] hover:text-[#4A5E78]'}`}
          >{l}</button>
        ))}
      </div>

      {/* Dashboard */}
      {onglet === 'dashboard' && (
        <div className="space-y-4">
          {/* Graphe barres mensuel */}
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
            <div className="text-sm font-bold text-[#4A5E78] mb-4">{L ? '📊 Quotas mensais' : '📊 Charges mensuelles'} {anneeSelect}</div>
            <div className="flex items-end gap-1 h-32">
              {chargesParMois.map((m) => {
                const h = m.montant > 0 ? Math.max((m.montant / maxMontant) * 100, 5) : 5
                const color = m.statut === 'payee' ? '#10b981' : m.statut === 'en_attente' ? '#f59e0b' : m.statut === 'en_retard' ? '#ef4444' : '#e5e7eb'
                return (
                  <div key={m.mois} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t-md transition-all"
                      style={{ height: `${h}%`, backgroundColor: color }}
                      title={`${m.mois}: ${formatPrice(m.montant)}`}
                    />
                    <div className="text-[9px] text-[#8A9BB0] font-medium">{m.mois}</div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />{L ? 'Paga' : 'Payée'}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />{L ? 'Pendente' : 'En attente'}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />{L ? 'Em atraso' : 'En retard'}</span>
            </div>
          </div>

          {/* Répartition */}
          <div className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm">
            <div className="text-sm font-bold text-[#4A5E78] mb-3">{L ? '🥧 Distribuição orçamento' : '🥧 Répartition budget'}</div>
            <div className="space-y-2">
              {POSTES_CHARGES.sort((a, b) => b.montantAnnuel - a.montantAnnuel).map(p => (
                <div key={p.label} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 text-center">{p.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs text-[#4A5E78] mb-0.5">
                      <span className="truncate">{p.label}</span>
                      <span className="font-semibold flex-shrink-0 ml-2">{formatPrice(p.montantAnnuel)}</span>
                    </div>
                    <div className="h-1.5 bg-[#F7F4EE] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(p.montantAnnuel / totalReelAnnee) * 100}%`, backgroundColor: p.couleur }}
                      />
                    </div>
                  </div>
                  <div className="text-[10px] text-[#8A9BB0] flex-shrink-0 w-8 text-right">
                    {Math.round((p.montantAnnuel / totalReelAnnee) * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Postes de charges */}
      {onglet === 'postes' && (
        <div className="space-y-3">
          {POSTES_CHARGES.map(p => {
            const over = p.montantAnnuel > p.budget
            return (
              <div key={p.label} className={`bg-white rounded-xl border p-4 shadow-sm ${over ? 'border-red-200' : 'border-[#E4DDD0]'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{p.emoji}</span>
                    <div>
                      <div className="font-semibold text-[#0D1B2E] text-sm">{p.label}</div>
                      <div className="text-xs text-[#8A9BB0] mt-0.5">{L ? 'Orçamento' : 'Budget'} : {formatPrice(p.budget)} · {L ? 'Real' : 'Réel'} : {formatPrice(p.montantAnnuel)}</div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${over ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {over ? `+${formatPrice(p.montantAnnuel - p.budget)}` : `-${formatPrice(p.budget - p.montantAnnuel)}`}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="h-2 bg-[#F7F4EE] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min((p.montantAnnuel / p.budget) * 100, 100)}%`,
                        backgroundColor: over ? '#ef4444' : p.couleur,
                      }}
                    />
                  </div>
                  <div className="text-[10px] text-[#8A9BB0] mt-1">{Math.round((p.montantAnnuel / p.budget) * 100)}% {L ? 'do orçamento consumido' : 'du budget consommé'}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Calendrier paiements */}
      {onglet === 'calendrier' && (
        <div className="space-y-3">
          <div className="text-xs text-[#8A9BB0] font-medium">{L ? 'Próximos vencimentos' : 'Prochaines échéances'}</div>
          {paiements
            .filter(p => p.statut !== 'payee' && new Date(p.dateEcheance) >= new Date())
            .sort((a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime())
            .map(p => {
              const daysLeft = Math.ceil((new Date(p.dateEcheance).getTime() - Date.now()) / 86400000)
              const urgent = daysLeft <= 14
              return (
                <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${urgent ? 'border-red-200 bg-red-50' : 'border-[#E4DDD0]'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[#0D1B2E] text-sm">{p.description}</div>
                      <div className="text-xs text-[#8A9BB0] mt-0.5">{p.reference} · {L ? 'Venc.' : 'Éch.'} {new Date(p.dateEcheance).toLocaleDateString(dateFmtLocale)}</div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-lg ${p.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>{formatPrice(Math.abs(p.montant))}</div>
                      <div className={`text-[10px] font-bold mt-0.5 ${urgent ? 'text-red-600' : 'text-[#8A9BB0]'}`}>
                        {urgent ? `⚠️ J-${daysLeft}` : `J-${daysLeft}`}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

          <div className="text-xs text-[#8A9BB0] font-medium mt-4">{L ? 'Pagamentos efetuados' : 'Paiements effectués'}</div>
          {paiements
            .filter(p => p.statut === 'payee')
            .sort((a, b) => new Date(b.datePaiement!).getTime() - new Date(a.datePaiement!).getTime())
            .map(p => (
              <div key={p.id} className="bg-white rounded-xl border border-[#E4DDD0] p-4 shadow-sm opacity-70">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[#0D1B2E] text-sm">{p.description}</div>
                    <div className="text-xs text-[#8A9BB0] mt-0.5">{L ? 'Pago em' : 'Payé le'} {new Date(p.datePaiement!).toLocaleDateString(dateFmtLocale)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black text-lg ${p.montant < 0 ? 'text-green-600' : 'text-[#0D1B2E]'}`}>{formatPrice(Math.abs(p.montant))}</div>
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{L ? '✓ Pago' : '✓ Payé'}</span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
